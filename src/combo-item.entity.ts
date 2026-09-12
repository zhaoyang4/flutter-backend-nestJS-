import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
} from 'typeorm';
import { Combo } from './combo.entity';
import { Dish } from './dish.entity';

/**
 * 套餐项表（套餐与菜品的中间表，解决「多对多」关系）。
 *
 * 为什么需要这张表？
 *   一个套餐可以含多个菜品，一个菜品也可以出现在多个套餐里，
 *   这是典型的多对多关系。数据库里多对多必须拆成一张中间表，
 *   每行记录「某个套餐(comboId) 包含 某个菜品(dishId) 几份(quantity)」。
 *
 * 关系落地：
 *   - @ManyToOne(() => Combo) —— 多端的套餐项「属于」一个套餐（多对一）。
 *   - @ManyToOne(() => Dish)  —— 多端的套餐项也「指向」一个菜品。
 *   - onDelete: 'CASCADE'     —— 删除套餐时，它的套餐项也跟着删（级联删除）。
 *   - cascade: true（在 Combo 那侧）—— 保存套餐时，顺带保存它的套餐项。
 */
@Entity('combo_item')
export class ComboItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Combo, (combo) => combo.items, { onDelete: 'CASCADE' })
  combo: Combo; // 导航属性：所属的套餐对象

  @Column()
  comboId: number; // 套餐ID（外键列，实际落库字段）

  @ManyToOne(() => Dish)
  dish: Dish; // 导航属性：被包含的菜品对象

  @Column()
  dishId: number; // 菜品ID（外键列）

  @Column({ default: 1 })
  quantity: number; // 该菜品在套餐里的份数（如汉堡 x1、可乐 x1）
}
