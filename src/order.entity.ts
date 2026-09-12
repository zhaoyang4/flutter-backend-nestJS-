import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

export type OrderType = 'dine_in' | 'takeout';
export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled';
export type PayMethod = 'wechat' | 'alipay';

/**
 * 订单主表（对应需求「六、订单/结账/支付」统一订单体系）。
 *
 * 【统一订单】堂食与外卖共用一张表，用 type 字段区分：
 *   - type='dine_in'：堂食订单，会带 tableNo（桌号）；
 *   - type='takeout'：外卖订单，带收货人/电话/地址，无桌号。
 *
 * 【后端统一算价】这是 V1.0 的关键约束：前端绝不自己算钱，所有金额由后端算。
 *   所以订单落库时直接存好四个金额，前端只负责展示：
 *   - originalAmount 原价合计（菜品/套餐原价 × 数量之和）
 *   - discountAmount 优惠金额（原价 - 折后小计，即活动省下的钱）
 *   - deliveryFee    配送费（仅外卖且达到起送价时收取）
 *   - payableAmount  实付金额 = 原价 - 优惠 + 配送费
 *
 * 【完整状态流】pending(待支付) → paid(已支付) → completed(已完成) / cancelled(已取消)
 *   - 顾客下单生成二维码后处于 pending；
 *   - 支付回调成功改为 paid，再视业务改为 completed（如出餐完成）；
 *   - cancelled 用于超时未支付或顾客取消（V1.0 不含退款）。
 *
 * payMethod / paidAt：记录支付方式与支付时间，便于对账和小票打印。
 * payUrl：动态支付二维码内容（限时有效），V1.0 先生成占位/真实支付链接。
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32, unique: true })
  orderNo: string; // 订单号（业务唯一，如时间戳+随机）

  @Column({ default: 'dine_in' })
  type: OrderType; // dine_in 堂食 / takeout 外卖

  @Column({ nullable: true, length: 20 })
  tableNo: string; // 堂食桌号（外卖为 null）

  @Column({ nullable: true, length: 50 })
  customerName: string; // 外卖收货人

  @Column({ nullable: true, length: 20 })
  phone: string; // 手机号

  @Column({ nullable: true, length: 255 })
  address: string; // 收货地址

  @Column({ nullable: true, length: 255 })
  remark: string; // 备注（如“少放辣”）

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  originalAmount: number; // 原价合计

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number; // 优惠金额

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  deliveryFee: number; // 配送费

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  payableAmount: number; // 实付金额

  @Column({ default: 'pending' })
  status: OrderStatus; // 订单状态

  @Column({ nullable: true, length: 10 })
  payMethod: PayMethod; // 支付方式

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date; // 支付完成时间

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date; // 下单时间

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[]; // 订单包含的明细（导航用）

  @Column({ nullable: true, length: 255 })
  payUrl: string; // 动态支付二维码内容
}
