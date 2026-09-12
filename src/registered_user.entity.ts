import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 注册用户（顾客）表（对应需求「会员储值 V1」与网页端「可选注册」）。
 *
 * 这是和后台 admin_account 完全独立的一套账号：
 *   - admin_account：收银端登录（管理员/收银员），角色过滤用。
 *   - registered_user：顾客在网页端注册，用于外卖点单、会员储值、订单历史。
 *
 * balance：会员储值余额（decimal，默认 0）。充值时 +amount，消费时 -amount（V1.0 消费扣减留订单服务，本期先开放充值与编辑）。
 */
@Entity('registered_user')
export class RegisteredUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 40, unique: true })
  username: string; // 顾客登录名（网页端注册）

  @Column({ nullable: true, length: 20 })
  phone: string; // 手机号（外卖联系用）

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: number; // 会员储值余额

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
