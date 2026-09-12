import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type DishStatus = 'available' | 'unavailable' | 'sold_out';

/**
 * 菜品表（对应需求「菜品录入 / 改价 / 上架下架 / 库存」）。
 *
 * 几个关键字段的设计意图：
 * 1. originalPrice / currentPrice 分离
 *    - originalPrice 是「原价/划线价」，通常不动；
 *    - currentPrice 是「当前售价」，店员随时可改（需求：随时可修改菜品价格）。
 *    - 前端展示时，活动折后价另算，三者关系：原价 ≥ 折后价，售价可独立调。
 *
 * 2. status（售罄/停售）vs enabled（逻辑下架）
 *    - status='sold_out'：库存卖光了，临时标记，补货后可改回。
 *    - enabled=0：店家主动下架，但历史订单里仍引用这条菜品记录（不删除）。
 *    - 这就是为什么需求强调「逻辑下架，不删除历史数据」——用字段标记代替 DELETE。
 *
 * 3. stock = -1 的特殊含义
 *    - V1.0 是「基础库存」：大部分菜品不计数，用 -1 表示「不限制库存」；
 *    - 需要控量的（如限量菜）填正数，下单扣减、取消返还。
 */
@Entity('dish')
export class Dish {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  categoryId: number; // 外键：归属哪个分类（这里用普通列存 id，不强制数据库外键）

  @Column({ length: 80 })
  name: string; // 菜品名称

  @Column({ nullable: true, length: 255 })
  imageUrl: string; // 菜品图片地址（V1.0 先存 URL，后续可接上传）

  @Column('decimal', { precision: 10, scale: 2 })
  originalPrice: number; // 原价

  @Column('decimal', { precision: 10, scale: 2 })
  currentPrice: number; // 当前售价（核心可改价字段）

  @Column({ default: 'available' })
  status: DishStatus; // available 在售 / unavailable 停售 / sold_out 售罄

  @Column({ default: 1 })
  enabled: number; // 是否上架：1=上架 0=下架（逻辑下架）

  @Column({ default: -1 })
  stock: number; // 库存数量：-1 表示不限制

  @Column({ nullable: true, length: 255 })
  description: string; // 菜品描述（顾客端展示用）

  @Column({ default: 0 })
  enableSpec: number; // 是否启用规格：1=启用（顾客端显示规格选择器）0=不启用（录入页开关控制）

  @Column({ type: 'json', nullable: true })
  specs: any; // 规格组配置：[{ name, options: [{ name, extra }] }]，启用规格时由录入页填写

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date; // 创建时间，数据库自动填
}
