import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { PayService } from './pay.service';

/**
 * 支付接口（#4）。
 *
 * 路由一览：
 *   GET  /api/pay/:orderNo/qrcode?method=wechat|alipay   获取支付二维码内容（前端 qr_flutter 渲染）
 *   POST /api/pay/wechat/notify                           微信异步回调（mock 模式跳过验签）
 *   POST /api/pay/alipay/notify                           支付宝异步回调
 *   POST /api/pay/:orderNo/mock-paid?method=...          演示/联调用：模拟支付成功
 *
 * 说明：原 /api/order/callback 仍保留作为兼容入口，新接入统一走本控制器。
 */
@Controller('api/pay')
export class PayController {
  constructor(private readonly payService: PayService) {}

  /** 获取支付二维码内容（前端用 qr_flutter 渲染）。 */
  @Get(':orderNo/qrcode')
  qrcode(
    @Param('orderNo') orderNo: string,
    @Query('method') method: string,
  ) {
    if (method !== 'wechat' && method !== 'alipay') {
      throw new BadRequestException('method 必须为 wechat 或 alipay');
    }
    return this.payService.createPayment(orderNo, method as 'wechat' | 'alipay');
  }

  /** 微信异步回调。 */
  @Post('wechat/notify')
  wechatNotify(@Body() body: any, @Query('signature') signature?: string) {
    return this.payService.handleNotify('wechat', body, signature);
  }

  /** 支付宝异步回调。 */
  @Post('alipay/notify')
  alipayNotify(@Body() body: any, @Query('signature') signature?: string) {
    return this.payService.handleNotify('alipay', body, signature);
  }

  /** 演示/联调用：模拟支付成功。 */
  @Post(':orderNo/mock-paid')
  mockPaid(
    @Param('orderNo') orderNo: string,
    @Query('method') method: string,
  ) {
    if (method !== 'wechat' && method !== 'alipay') {
      throw new BadRequestException('method 必须为 wechat 或 alipay');
    }
    return this.payService.mockPaid(orderNo, method as 'wechat' | 'alipay');
  }
}
