import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type ActivityType = 'ratio' | 'fixed';
export type ActivityScope = 'all' | 'selected';

/**
 * 活动折扣表（对应需求「五、活动折扣模块（含叠加规则）」）。
 *
 * 这是整个折扣体系的核心配置，字段尽量贴合需求里的每一项：
 *
 * type  折扣方式：'ratio'=比例折扣（如 0.8 表示打八折）；
 *                  'fixed'=固定特价（直接把商品价定为某个值）。
 * value 配合 type 使用：ratio 时填 0.8；fixed 时填特价金额。
 *
 * scope 适用范围：'all'=全店商品都参与；'selected'=只有指定商品参与。
 * applicableItems：当 scope='selected' 时，存参与活动的菜品/套餐 id 数组（JSON）。
 *
 * 时间控制（需求：活动日期 + 时间段）：
 *   startDate/endDate —— 活动有效的日期区间（含当天）。
 *   startTime/endTime —— 每天生效的时间段，如 10:00:00 ~ 14:00:00。
 *
 * allowStacking（核心配置项：是否允许叠加其他优惠）：
 *   1=允许叠加。算价引擎据此决定：允许叠加时多个活动效果累加；
 *   不允许时，每件商品只取「最优惠的那个活动」。
 *
 * supportDineIn / supportTakeout（适用场景）：
 *   分别控制该活动是否支持堂食 / 外卖（需求：可单独控制）。
 *
 * enabled：活动总开关（启用/停用），对应需求的「活动启用/停用开关」。
 */
@Entity('activity')
export class Activity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  name: string; // 活动名称，如「午市八折」

  @Column({ default: 'ratio' })
  type: ActivityType; // ratio 比例折扣 / fixed 固定特价

  @Column('decimal', { precision: 10, scale: 4 })
  value: number; // ratio 时为折扣比例(0.8)；fixed 时为特价金额

  @Column({ default: 'all' })
  scope: ActivityScope; // all 全店 / selected 指定商品

  @Column({ type: 'json', nullable: true })
  applicableItems: number[]; // scope=selected 时参与活动的商品id列表

  @Column({ length: 10, nullable: true })
  startDate: string; // 活动开始日期 YYYY-MM-DD

  @Column({ length: 10, nullable: true })
  endDate: string; // 活动结束日期 YYYY-MM-DD

  @Column({ length: 8, nullable: true })
  startTime: string; // 每日生效开始时间 HH:mm:ss

  @Column({ length: 8, nullable: true })
  endTime: string; // 每日生效结束时间 HH:mm:ss

  @Column({ default: 0 })
  allowStacking: number; // 1 允许与其他活动叠加

  @Column({ default: 1 })
  supportDineIn: number; // 是否支持堂食

  @Column({ default: 1 })
  supportTakeout: number; // 是否支持外卖

  @Column({ default: 1 })
  enabled: number; // 活动启用开关：1 启用 0 停用

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date; // 创建时间
}
