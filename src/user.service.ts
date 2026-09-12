import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisteredUser } from './registered_user.entity';

/**
 * 注册用户（顾客）服务：列表 / 注册 / 编辑信息 / 会员储值充值。
 *
 * 对应前端「注册用户管理」页（收银端，管理员查看与编辑储值）与网页端注册。
 * 余额操作分两种语义：
 *   - updateUser(balance)：管理端直接「设置」余额（编辑用）；
 *   - recharge(amount)：会员储值「充值」，余额累加（顾客/收银端充值用）。
 * V1.0 消费扣减留在订单服务，本期先开放充值与编辑。
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(RegisteredUser)
    private userRepo: Repository<RegisteredUser>,
  ) {}

  /** 列表（收银端「注册用户管理」页用）。 */
  async list() {
    return this.userRepo.find({ order: { id: 'ASC' } });
  }

  /** 网页端注册：username 必填且唯一，初始余额 0。 */
  async register(dto: any) {
    this.require(dto.username, 'username');
    const exists = await this.userRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new BadRequestException('用户名已存在');
    return this.userRepo.save(
      this.userRepo.create({ username: dto.username, phone: dto.phone ?? null, balance: 0 }),
    );
  }

  /** 编辑用户信息 / 余额（收银端管理页）。 */
  async updateUser(id: number, dto: any) {
    const u = await this.userRepo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('用户不存在');
    if (dto.username !== undefined) u.username = dto.username;
    if (dto.phone !== undefined) u.phone = dto.phone;
    if (dto.balance != null) u.balance = Number(dto.balance);
    return this.userRepo.save(u);
  }

  /** 会员储值充值：余额 += amount。 */
  async recharge(id: number, amount: number) {
    const u = await this.userRepo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('用户不存在');
    u.balance = Number(u.balance) + Number(amount);
    return this.userRepo.save(u);
  }

  private require(v: any, field: string) {
    if (v == null || v === '') throw new BadRequestException(`缺少必填字段 ${field}`);
  }
}
