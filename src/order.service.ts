import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { PricingService } from './pricing.service';
import { PayService } from './pay.service';
import { config } from './config';

/**
 * 下单入参结构（APP 提交 JSON 的对应类型）。
 * 注意：takeout 用嵌套对象（前端 HttpApiService 实际发送结构），
 * 同时兼容旧版扁平字段 customerName/phone/address/remark。
 */
export interface SubmitOrderDto {
  type: 'dine_in' | 'takeout';
  items: { type: 'dish' | 'combo'; refId: number; qty: number }[];
  tableNo?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  remark?: string;
  takeout?: { name?: string; phone?: string; address?: string; note?: string };
}

/**
 * 订单服务：处理「算价预览 → 正式下单 → 生成支付二维码 → 支付回调」。
 *
 * 设计要点（紧扣需求）：
 * 1. 所有金额在 submit 时由 PricingService 重算并落库 → 前端无法篡改价格。
 * 2. 外卖未达起送价直接拒绝下单（freeDeliveryShort>0 即不达标）。
 * 3. 支付二维码是「动态 + 限时」：payUrl 附上订单号与时间戳，超时需重新生成。
 * 4. 回调只把 pending → paid，并记支付时间；V1.0 不含退款。
 *
 * 接口契约：
 *   - /api/order/*   ：收银端 / 兼容入口（list / detail / complete / callback）
 *   - /api/orders/*  ：对齐前端 HttpApiService（preview / create / query / confirm）
 *     这两个前缀并存：顾客端走复数资源风格，收银端走单数风格，互不冲突。
 */
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepo: Repository<OrderItem>,
    private pricing: PricingService,
    private payService: PayService,
  ) {}

  /**
   * 算价预览：不落库，只返回金额明细，给结算页展示。
   */
  async preview(dto: SubmitOrderDto) {
    return this.pricing.calc(dto.items, dto.type);
  }

  /**
   * 校验 + 算价 + 落库，返回持久化后的订单实体。
   * submit / createAsOrder 共用，避免重复逻辑。
   */
  private async persistOrder(dto: SubmitOrderDto): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('购物车为空');
    }
    const type = this.normType(dto.type);

    // 1) 后端统一算价（关键：不信任前端传来的金额）
    const price = await this.pricing.calc(dto.items, type);

    // 2) 外卖起送校验
    if (type === 'takeout' && price.freeDeliveryShort > 0) {
      throw new BadRequestException(
        `未达起送价，还差 ¥${price.freeDeliveryShort}`,
      );
    }

    // 3) 外卖收货信息（兼容前端 takeout 对象 / 旧扁平字段）
    const t = dto.takeout ?? {};
    const customerName = t.name ?? dto.customerName;
    const phone = t.phone ?? dto.phone;
    const address = t.address ?? dto.address;
    const remark = t.note ?? dto.remark;

    // 4) 生成订单号（时间戳 + 随机，保证唯一）
    const orderNo = this.genOrderNo();

    // 5) 构造订单主记录
    const order = this.orderRepo.create({
      orderNo,
      type,
      tableNo: dto.tableNo,
      customerName,
      phone,
      address,
      remark,
      originalAmount: price.originalAmount,
      discountAmount: price.discountAmount,
      deliveryFee: price.deliveryFee,
      payableAmount: price.payableAmount,
      status: 'pending',
    });

    // 6) 构造订单明细（把算价结果逐行落库，单价/活动价全部锁定）
    order.items = price.items.map((it) =>
      this.orderItemRepo.create({
        itemType: it.type,
        refId: it.refId,
        name: it.name,
        unitPrice: it.originalPrice,
        activityPrice: it.activityPrice,
        quantity: it.qty,
      }),
    );

    // 7) 保存（级联保存明细）
    const saved = await this.orderRepo.save(order);

    // 8) 生成动态支付二维码内容（限时）
    const payUrl = this.buildPayUrl(saved.orderNo);
    saved.payUrl = payUrl;
    await this.orderRepo.save(saved);

    return saved;
  }

  /** 保留原契约：返回 {orderNo, payableAmount, payUrl, ttlSec}。 */
  async submit(dto: SubmitOrderDto) {
    const saved = await this.persistOrder(dto);
    return {
      orderNo: saved.orderNo,
      payableAmount: saved.payableAmount,
      payUrl: saved.payUrl,
      ttlSec: config.pay.qrTtlSec,
    };
  }

  // ============================================================
  // 前端契约：/api/orders/*（对齐 HttpApiService）
  // 全部返回「前端 Order 形状」，id 用 orderNo（便于 queryOrder 反查）。
  // ============================================================

  /** POST /api/orders/preview → 完整 Order 形状（不落库，仅算价预览）。 */
  async previewAsOrder(dto: SubmitOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('购物车为空');
    }
    const type = this.normType(dto.type);
    const price = await this.pricing.calc(dto.items, type);
    const t = dto.takeout ?? {};
    const items = price.items.map((it) => ({
      dishId: String(it.refId),
      name: it.name,
      imageUrl: null,
      unitPrice: it.activityPrice,
      quantity: it.qty,
      subtotal: Number((it.activityPrice * it.qty).toFixed(2)),
      isCombo: it.type === 'combo',
    }));
    return {
      id: 'preview',
      orderNo: '',
      type: type === 'dine_in' ? 'dineIn' : 'takeout',
      tableNo: dto.tableNo ?? null,
      takeout:
        type === 'takeout'
          ? {
              name: t.name ?? '',
              phone: t.phone ?? '',
              address: t.address ?? '',
              note: t.note ?? null,
            }
          : null,
      items,
      originalAmount: price.originalAmount,
      discountAmount: price.discountAmount,
      deliveryFee: price.deliveryFee,
      payableAmount: price.payableAmount,
      status: 'pending',
      payUrl: null,
      createdAt: new Date().toISOString(),
    };
  }

  /** POST /api/orders → 落库 + 返回完整 Order 形状（含 orderNo / payUrl）。 */
  async createAsOrder(dto: SubmitOrderDto) {
    const saved = await this.persistOrder(dto);
    return this.serializeOrder(saved);
  }

  /** GET /api/orders/:id → 完整 Order 形状（id 即 orderNo）。 */
  async queryAsOrder(orderNo: string) {
    const order = await this.detail(orderNo);
    if (!order) throw new BadRequestException('订单不存在');
    return this.serializeOrder(order);
  }

  /** POST /api/orders/:id/confirm → mock 支付成功（调试用），返回完整 Order。 */
  async confirmAsOrder(orderNo: string) {
    await this.payService.mockPaid(orderNo, 'wechat');
    const order = await this.detail(orderNo);
    if (!order) throw new BadRequestException('订单不存在');
    return this.serializeOrder(order);
  }

  /**
   * Order 实体 → 前端契约形状。
   * 注意：id 用 orderNo（前端 queryOrder 用 Order.id 反查，两者需一致）；
   * type 回传驼峰 'dineIn'/'takeout'（前端 Order.fromJson 只认驼峰）。
   */
  private serializeOrder(order: Order) {
    const items = (order.items ?? []).map((it) => {
      const unit =
        it.activityPrice != null
          ? Number(it.activityPrice)
          : Number(it.unitPrice);
      return {
        dishId: String(it.refId),
        name: it.name,
        imageUrl: null,
        unitPrice: unit,
        quantity: it.quantity,
        subtotal: Number((unit * it.quantity).toFixed(2)),
        isCombo: it.itemType === 'combo',
      };
    });
    const isTakeout = order.type === 'takeout';
    return {
      id: order.orderNo,
      orderNo: order.orderNo,
      type: order.type === 'dine_in' ? 'dineIn' : 'takeout',
      tableNo: order.tableNo ?? null,
      takeout: isTakeout
        ? {
            name: order.customerName ?? '',
            phone: order.phone ?? '',
            address: order.address ?? '',
            note: order.remark ?? null,
          }
        : null,
      items,
      originalAmount: Number(order.originalAmount),
      discountAmount: Number(order.discountAmount),
      deliveryFee: Number(order.deliveryFee),
      payableAmount: Number(order.payableAmount),
      status: order.status,
      payUrl: order.payUrl ?? null,
      createdAt: order.createdAt
        ? order.createdAt.toISOString()
        : new Date().toISOString(),
    };
  }

  /** 订单类型归一化：前端发 'dineIn'（驼峰），后端内部统一用 'dine_in'。 */
  private normType(t: string): 'dine_in' | 'takeout' {
    if (t === 'dineIn' || t === 'dine_in') return 'dine_in';
    if (t === 'takeout') return 'takeout';
    return 'dine_in'; // 兜底，避免空值导致算价场景错乱
  }

  /**
   * 生成「动态支付二维码」内容。
   * V1.0：这里生成的是一个带订单号+过期时间的 token 串（真实接入微信/支付宝时，
   * 改为调支付接口拿回的 code_url / 支付链接）。
   */
  private buildPayUrl(orderNo: string): string {
    const exp = Date.now() + config.pay.qrTtlSec * 1000;
    const token = Buffer.from(`${orderNo}:${exp}`).toString('base64');
    return `pay://order?token=${token}`;
  }

  /**
   * 支付回调：把订单标记为已支付（真实支付平台异步通知时调用）。
   * V1.0 用 GET 方便演示；生产环境应为 POST + 签名校验。
   */
  async handleCallback(orderNo: string, method: 'wechat' | 'alipay') {
    const order = await this.orderRepo.findOne({ where: { orderNo } });
    if (!order) throw new BadRequestException('订单不存在');
    if (order.status === 'paid' || order.status === 'completed') {
      return { ok: true, already: true };
    }
    order.status = 'paid';
    order.payMethod = method;
    order.paidAt = new Date();
    await this.orderRepo.save(order);
    return { ok: true, orderNo, status: order.status };
  }

  /** 订单号生成：日期 + 毫秒尾 + 随机，降低碰撞概率。 */
  private genOrderNo(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
      d.getDate(),
    )}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `NO${datePart}${rand}`;
  }

  /** 收银端：订单列表（按时间倒序，原始实体）。 */
  async list(status?: string) {
    const where = status ? { status } : {};
    return this.orderRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['items'],
    });
  }

  /**
   * 收银端订单列表（序列化版）：复用 serializeOrder 把实体转成前端 Order 形状，
   * 这样收银端 GET /api/orders 与顾客端共用同一套序列化，字段不会错位
   * （之前 /api/order/list 直接吐原始实体才导致与前端 Order.fromJson 不兼容）。
   */
  async listAsOrders(): Promise<any[]> {
    const orders = await this.list();
    return orders.map((o) => this.serializeOrder(o));
  }

  /** 收银端：取消订单（pending/paid → cancelled；终态不可取消）。 */
  async cancel(orderNo: string) {
    const order = await this.detail(orderNo);
    if (!order) throw new BadRequestException('订单不存在');
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new BadRequestException('终态订单不能取消');
    }
    order.status = 'cancelled';
    await this.orderRepo.save(order);
    return { ok: true, status: order.status };
  }

  /** 收银端：订单详情。 */
  async detail(orderNo: string) {
    return this.orderRepo.findOne({
      where: { orderNo },
      relations: ['items'],
    });
  }

  /** 收银端：标记完成（出餐/已交付）。 */
  async complete(orderNo: string) {
    const order = await this.orderRepo.findOne({ where: { orderNo } });
    if (!order) throw new BadRequestException('订单不存在');
    order.status = 'completed';
    await this.orderRepo.save(order);
    return { ok: true, status: order.status };
  }
}
