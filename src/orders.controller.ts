import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { OrderService } from './order.service';

/**
 * 顾客端订单接口（对齐前端 HttpApiService 契约）。
 * 前缀 api/orders，路由：
 *   POST /api/orders/preview      算价预览 → 返回完整 Order 形状（不落库）
 *   POST /api/orders              正式下单 → 返回完整 Order 形状（含 orderNo / payUrl）
 *   GET  /api/orders/:id          订单详情（id 即 orderNo）
 *   POST /api/orders/:id/confirm  支付确认（mock 调试用；生产由支付回调驱动）
 */
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orderService: OrderService) {}

  /** 算价预览：返回完整 Order 形状（不落库）。 */
  @Post('preview')
  preview(@Body() dto: any) {
    this.validateCart(dto);
    return this.orderService.previewAsOrder(dto);
  }

  /** 正式下单：返回完整 Order 形状（含 orderNo / payUrl）。 */
  @Post()
  create(@Body() dto: any) {
    this.validateCart(dto);
    return this.orderService.createAsOrder(dto);
  }

  /** 订单列表（收银端 / 顾客端共用）：返回序列化后的前端 Order 形状数组。 */
  @Get()
  list() {
    return this.orderService.listAsOrders();
  }

  /** 订单详情（id 即 orderNo）。 */
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.orderService.queryAsOrder(id);
  }

  /** 支付确认（mock 调试用；生产由支付回调驱动）。 */
  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.orderService.confirmAsOrder(id);
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
