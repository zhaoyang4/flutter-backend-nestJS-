import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type AdminRole = 'admin' | 'cashier';

/**
 * 后台管理员/收银员账号表（对应需求「一、权限&登录」）。
 *
 * 这是「管理端」的地基：收银端（Flutter Windows）登录、角色过滤都靠它。
 * 顾客端那套（admin_account）与此无关——顾客是另一套「注册用户」体系。
 *
 * 安全提示（V1.0 故意从简）：
 *   密码这里**明文**存储，是为了和前端 in-memory 的 AdminStore（admin/123456）对齐，
 *   让你先跑通登录 → 角色过滤 → 菜单可见性这条主链路。
 *   生产环境务必改为 bcrypt 哈希（import bcrypt → hashSync/compareSync），
 *   且绝不要把密码随登录结果返回前端。
 */
@Entity('admin_account')
export class AdminAccount {
  @PrimaryGeneratedColumn()
  id: number; // 主键

  @Column({ length: 40, unique: true })
  username: string; // 登录账号（唯一），如 admin / cashier

  @Column({ length: 100 })
  password: string; // V1.0 明文；生产改 bcrypt 哈希

  @Column({ type: 'varchar', length: 20, default: 'cashier' })
  role: AdminRole; // admin 管理员 / cashier 收银员（驱动菜单过滤）

  @Column({ length: 40, default: '' })
  displayName: string; // 显示名，如「系统管理员」

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date; // 创建时间
}
