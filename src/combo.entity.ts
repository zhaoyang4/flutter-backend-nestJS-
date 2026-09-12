import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import { ComboItem } from './combo-item.entity';

export type ComboStatus = 'available' | 'unavailable';

/**
 * 套餐主表（对应需求「套餐创建、绑定菜品、设置售价」）。
 *
 * 套餐与单品的区别：套餐是一个「打包价」，不是里面菜品价格之和。
 * 比如「汉堡+可乐」单买 25 元，套餐卖 19.9 元，这 19.9 直接存 price 字段。
 *
 * 关系建模（一对多）：一个套餐包含多个「套餐项」，所以：
 *   - 本表 Combo 是「一」方；
 *   - combo_item 表是「多」方（见 combo-item.entity.ts）。
 *   - @OneToMany(...) 只是「导航属性」，真正的关联关系由 ComboItem 里的 @ManyToOne 落地。
 *
 * participateInActivity：需求要求「套餐可配置是否参与活动折扣」。
 *   1=参与（结算时套餐价也能被活动再打折），0=不参与（只卖套餐价）。
 */
@Entity('combo')
export class Combo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  name: string; // 套餐名称

  @Column({ nullable: true, length: 255 })
  imageUrl: string; // 套餐图片

  @Column('decimal', { precision: 10, scale: 2 })
  price: number; // 套餐售价（打包价，非菜品之和）

  @Column({ default: 1 })
  participateInActivity: number; // 是否参与活动折扣 1/0

  @Column({ default: 'available' })
  status: ComboStatus; // available / unavailable

  @Column({ default: 1 })
  enabled: number; // 逻辑上下架

  @OneToMany(() => ComboItem, (item) => item.combo, { cascade: true })
  items: ComboItem[]; // 套餐包含哪些菜品（导航用，不生成列）
}
