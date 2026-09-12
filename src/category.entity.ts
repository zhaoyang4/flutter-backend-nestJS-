import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 菜品分类表（对应需求「菜品分类新增/编辑」）。
 *
 * 为什么单独一张表？
 *   前端菜单页需要「分类标签栏 + 对应菜品列表」。把分类抽成独立表，
 *   菜品用 categoryId 关联，增删分类不影响菜品数据，符合数据库范式。
 *
 * TypeORM 小贴士：
 *   @Entity('category')  —— 把这个类映射成数据库里的 category 表。
 *   @PrimaryGeneratedColumn() —— 自增主键（INT AUTO_INCREMENT）。
 *   @Column()  —— 普通列。括号里可写类型/约束，如 { length: 50 } 即 VARCHAR(50)。
 */
@Entity('category')
export class Category {
  @PrimaryGeneratedColumn()
  id: number; // 分类ID，主键

  @Column({ length: 50 })
  name: string; // 分类名称，如「热菜」「饮料」

  @Column({ default: 0 })
  sort: number; // 排序权重，数字越小越靠前（菜单展示顺序用）

  @Column({ default: 1 })
  enabled: number; // 是否启用：1=启用 0=停用（逻辑开关，不删数据）
}
