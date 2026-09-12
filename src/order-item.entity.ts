import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Order } from './order.entity';

export type OrderItemKind = 'dish' | 'combo';

/**
 * 订单明细表（订单与菜品的「一对多」子表）。
 *
 * 为什么订单要拆主表 + 明细表？
 *   一笔订单可能含多份商品（如 2 份红烧肉 + 1 个套餐）。主表存订单整体信息（金额/状态），
 *   明细表每行存「一种商品 × 数量」。这是电商/点餐系统的标准建模方式。
 *
 * itemType：这行明细是「单品(dish)」还是「套餐(combo)」？
 * refId：对应的菜品 id 或套餐 id（根据 itemType 解释）。
 * unitPrice：下单时锁定的单价（原价），因为菜价后面可能改动，落库才不怕历史订单变价。
 * activityPrice：该商品参与活动后的实际单价（已算完折扣）。行小计 = activityPrice × quantity。
 *
 * 小计计算放在算价引擎里，这里只存结果，保证「订单金额不可被前端篡改」。
 */
@Entity('order_item')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order; // 导航：所属的订单

  @Column()
  orderId: number; // 订单ID（外键列）

  @Column({ default: 'dish' })
  itemType: OrderItemKind; // dish 单品 / combo 套餐

  @Column()
  refId: number; // 菜品id 或 套餐id

  @Column({ length: 80 })
  name: string; // 商品名称快照（防止商品改名后订单显示错乱）

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number; // 原价单价（下单时锁定）

  @Column('decimal', { precision: 10, scale: 2 })
  activityPrice: number; // 活动后单价（实际成交价）

  @Column({ default: 1 })
  quantity: number; // 数量
}
