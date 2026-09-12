import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { config } from './config';

/**
 * 支付服务（#4 支付对接核心）。
 *
 * 设计要点：
 * 1. 默认 mock 模式（PAY_MOCK !== 'false' 即开启）：不接真实商户号也能生成
 *    可被 qr_flutter 渲染的二维码内容，跑通「下单→扫码→回调→paid→completed」全链路。
 * 2. 真实接入：把 PAY_MOCK=false 并填 wechat/alipay 段密钥后，createPayment 走
 *    微信/支付宝预下单接口，handleNotify 走平台签名校验（本期预留接口，待装 SDK 补全）。
 * 3. 状态机：pending → paid（回调）→ completed（出餐/交付）；超时未支付 → cancelled。
 * 4. 超时取消：OnModuleInit 启动一个轻量扫描器（30s 一次），把超过二维码有效期
 *    仍为 pending 的订单置为 cancelled。生产建议改用 @nestjs/schedule 的 @Cron。
 */
@Injectable()
export class PayService implements OnModuleInit {
  private readonly logger = new Logger(PayService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  onModuleInit() {
    // 轻量超时扫描（不阻塞进程退出）
    const timer = setInterval(() => {
      this.scanExpired().catch((e) =>
        this.logger.warn(`scanExpired error: ${e?.message ?? e}`),
      );
    }, 30_000);
    if (typeof (timer as any).unref === 'function') {
      (timer as any).unref();
    }
    this.logger.log(
      `支付模块已启动，mock=${config.pay.mock}，qrTtl=${config.pay.qrTtlSec}s`,
    );
  }

  /**
   * 为订单生成支付二维码内容（按支付方式）。
   * 返回 qrContent（前端 qr_flutter 渲染）、expireAt、ttlSec。
   */
  async createPayment(orderNo: string, method: 'wechat' | 'alipay') {
    const order = await this.orderRepo.findOne({ where: { orderNo } });
    if (!order) throw new BadRequestException('订单不存在');
    if (order.status !== 'pending') {
      throw new BadRequestException(`订单状态不可支付: ${order.status}`);
    }

    const expireAt = Date.now() + config.pay.qrTtlSec * 1000;
    let qrContent: string;

    if (config.pay.mock) {
      // 占位串：前端 qr_flutter 渲染即可演示扫码支付流程
      qrContent = `mockpay://${method}?orderNo=${orderNo}&amt=${order.payableAmount}&exp=${expireAt}`;
    } else if (method === 'wechat' && config.pay.wechat.enabled) {
      qrContent = await this.wechatPrepay(order);
    } else if (method === 'alipay' && config.pay.alipay.enabled) {
      qrContent = await this.alipayPrepay(order);
    } else {
      throw new BadRequestException('该支付方式未配置或未开启');
    }

    order.payUrl = qrContent;
    await this.orderRepo.save(order);
    return {
      orderNo,
      method,
      qrContent,
      expireAt: new Date(expireAt),
      ttlSec: config.pay.qrTtlSec,
    };
  }

  /** 微信预下单（真实商户号接入点，本期返回占位，待装 SDK 后补全）。 */
  private async wechatPrepay(order: Order): Promise<string> {
    // TODO: 调用微信支付 APIv3 /v3/pay/transactions/native 获取 code_url
    // const { code_url } = await wechatPay.nativePay({ ... });
    throw new BadRequestException('微信真实支付待接入：请安装 SDK 并填密钥');
  }

  /** 支付宝当面付预下单（真实商户号接入点）。 */
  private async alipayPrepay(order: Order): Promise<string> {
    // TODO: 调用 alipay.trade.precreate 获取 qr_code
    throw new BadRequestException('支付宝真实支付待接入：请安装 SDK 并填密钥');
  }

  /**
   * 支付异步回调入口（微信/支付宝 notify 调用）。
   * mock 模式跳过签名直接 markPaid；真实模式需验签 + 校验金额一致。
   */
  async handleNotify(
    method: 'wechat' | 'alipay',
    payload: any,
    signature?: string,
  ) {
    const orderNo = this.extractOrderNo(method, payload);
    if (config.pay.mock) {
      return this.markPaid(orderNo, method);
    }
    const ok =
      method === 'wechat'
        ? this.verifyWechat(payload, signature)
        : this.verifyAlipay(payload, signature);
    if (!ok) throw new BadRequestException('签名校验失败');
    // 真实模式还应校验 payload 中的金额与订单 payableAmount 一致
    return this.markPaid(orderNo, method);
  }

  /** 演示/联调用：模拟支付成功（等价于真实回调触发 markPaid）。 */
  async mockPaid(orderNo: string, method: 'wechat' | 'alipay') {
    return this.markPaid(orderNo, method);
  }

  /** 订单 pending → paid，记录支付方式与支付时间。 */
  private async markPaid(orderNo: string, method: 'wechat' | 'alipay') {
    const order = await this.orderRepo.findOne({ where: { orderNo } });
    if (!order) throw new BadRequestException('订单不存在');
    if (order.status === 'paid' || order.status === 'completed') {
      return { ok: true, already: true, status: order.status };
    }
    if (order.status === 'cancelled') {
      throw new BadRequestException('订单已取消，无法支付');
    }
    order.status = 'paid';
    order.payMethod = method;
    order.paidAt = new Date();
    await this.orderRepo.save(order);
    this.logger.log(`订单 ${orderNo} 支付成功 (${method})`);
    return { ok: true, orderNo, status: order.status };
  }

  private extractOrderNo(method: 'wechat' | 'alipay', payload: any): string {
    if (!payload) throw new BadRequestException('回调数据为空');
    return payload.out_trade_no ?? payload.orderNo ?? payload.order_no;
  }
  private verifyWechat(payload: any, signature?: string): boolean {
    // TODO: 按微信支付 APIv3 规则验签
    return true;
  }
  private verifyAlipay(payload: any, signature?: string): boolean {
    // TODO: 按支付宝规则验签
    return true;
  }

  /** 超时扫描：pending 且创建超过二维码有效期的订单置为 cancelled。 */
  async scanExpired() {
    const ttlMs = config.pay.qrTtlSec * 1000;
    const cutoff = new Date(Date.now() - ttlMs);
    const expired = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :s', { s: 'pending' })
      .andWhere('o.createdAt < :cutoff', { cutoff })
      .getMany();
    for (const o of expired) {
      o.status = 'cancelled';
      await this.orderRepo.save(o);
      this.logger.log(`订单 ${o.orderNo} 超时未支付，已取消`);
    }
    return expired.length;
  }
}
