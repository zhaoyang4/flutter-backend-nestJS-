import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { PayService } from './pay.service';

/**
 * 订单接口（对应需求「六、订单/结账/支付」）。
 *
 * 路由一览：
 *   POST /api/order/preview       算价预览（不落库，结算页用）
 *   POST /api/order/submit        正式下单（后端统一算价 + 落库 + 出支付二维码）
 *   GET  /api/order/callback      支付回调（兼容入口，转发到 PayService.mockPaid）
 *   GET  /api/order/list          收银端订单列表
 *   GET  /api/order/:orderNo      收银端订单详情
 *   POST /api/order/:orderNo/complete  收银端标记完成
 *
 * 规范支付接口见 pay.controller（/api/pay/...）。
 */
@Controller('api/order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly payService: PayService,
  ) {}

  /** 算价预览：前端把购物车原样传上来，后端算好金额明细返回。 */
  @Post('preview')
  preview(@Body() dto: any) {
    this.validateCart(dto);
    return this.orderService.preview(dto);
  }

  /** 正式下单：返回订单号 + 支付二维码内容。 */
  @Post('submit')
  submit(@Body() dto: any) {
    this.validateCart(dto);
    if (dto.type !== 'dine_in' && dto.type !== 'takeout') {
      throw new BadRequestException('订单类型非法');
    }
    return this.orderService.submit(dto);
  }

  /**
   * 支付回调（兼容入口，转发到 PayService.mockPaid）。
   * 真实接入微信/支付宝时走 /api/pay/{wechat|alipay}/notify。
   */
  @Get('callback')
  callback(
    @Query('orderNo') orderNo: string,
    @Query('method') method: 'wechat' | 'alipay',
  ) {
    if (!orderNo) throw new BadRequestException('缺少 orderNo');
    return this.payService.mockPaid(
      orderNo,
      method === 'alipay' ? 'alipay' : 'wechat',
    );
  }

  /** 收银端：订单列表（可按 ?status=pending 过滤）。 */
  @Get('list')
  list(@Query('status') status?: string) {
    return this.orderService.list(status);
  }

  /** 收银端：订单详情。 */
  @Get(':orderNo')
  detail(@Param('orderNo') orderNo: string) {
    return this.orderService.detail(orderNo);
  }

  /** 收银端：标记订单完成（出餐/已交付）。 */
  @Post(':orderNo/complete')
  complete(@Param('orderNo') orderNo: string) {
    return this.orderService.complete(orderNo);
  }

  /**
   * 收银端收款：标记订单已支付（对应前端 AdminStore.collectPayment）。
   * 复用 PayService.mockPaid，等价于「收到支付回调」把订单推进到 paid。
   * 后续接真实支付时，这里改成调 createPayment 拿动态码、由 /api/pay/notify 回调触发 markPaid。
   * body: { "method": "wechat" | "alipay" | "cash" }
   */
  @Post(':orderNo/pay')
  collect(@Param('orderNo') orderNo: string, @Body() body: any) {
    const method =
      body?.method === 'alipay'
        ? 'alipay'
        : body?.method === 'cash'
          ? 'wechat' // 现金记账也走 wechat 字段占位，前端小票按 payMethod 展示
          : 'wechat';
    return this.payService.mockPaid(orderNo, method);
  }

  /** 收银端：取消订单（pending/paid → cancelled）。 */
  @Post(':orderNo/cancel')
  cancel(@Param('orderNo') orderNo: string) {
    return this.orderService.cancel(orderNo);
  }

  /** 简单校验购物车结构，避免脏数据进算价逻辑。 */
  private validateCart(dto: any) {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('购物车不能为空');
    }
    for (const it of dto.items) {
      if (it.type !== 'dish' && it.type !== 'combo') {
        throw new BadRequestException('商品类型非法');
      }
      if (!Number.isInteger(it.refId) || it.refId <= 0) {
        throw new BadRequestException('商品ID非法');
      }
      if (!Number.isInteger(it.qty) || it.qty <= 0) {
        throw new BadRequestException('数量非法');
      }
    }
  }
}
