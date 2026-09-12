import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAccount } from './admin-account.entity';

/**
 * 鉴权服务：登录校验 + 默认账号播种。
 *
 * 两个职责：
 * 1. onModuleInit：NestJS 启动完成后自动调用一次，保证库里至少有
 *    admin/123456（管理员）和 cashier/123456（收银员）两个种子账号。
 *   这样本机启动无需手动跑 seed 脚本也能登录；若已存在则直接跳过。
 *   提示：这是 NestJS 的「生命周期钩子」，类实现 OnModuleInit 后，
 *    框架会在依赖装配完后调用 onModuleInit()。
 *
 * 2. login：比对账号密码，成功返回「角色信息」给前端。
 *    V1.0 不签发 JWT（简单起见），前端拿到 role 就能过滤菜单可见性；
 *    后续要做「接口级鉴权」时，再在这里签发 token + 加 AuthGuard 即可。
 */
@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminAccount)
    private accountRepo: Repository<AdminAccount>,
  ) {}

  /** 模块启动后播种默认账号（幂等）。 */
  async onModuleInit() {
    const count = await this.accountRepo.count();
    if (count > 0) return; // 已有账号就不重复插
    await this.accountRepo.save([
      this.accountRepo.create({
        username: 'admin',
        password: '123456',
        role: 'admin',
        displayName: '系统管理员',
      }),
      this.accountRepo.create({
        username: 'cashier',
        password: '123456',
        role: 'cashier',
        displayName: '收银员 小张',
      }),
    ]);
  }

  /**
   * 登录校验。
   * @returns 登录成功返回 { username, role, displayName }，供前端驱动角色菜单。
   * @throws 401 账号不存在或密码错误。
   */
  async login(username: string, password: string) {
    const acc = await this.accountRepo.findOne({ where: { username } });
    if (!acc || acc.password !== password) {
      throw new UnauthorizedException('账号或密码错误');
    }
    return {
      username: acc.username,
      role: acc.role,
      displayName: acc.displayName,
    };
  }

  /**
   * 修改密码：按 username 更新（对应前端 AdminStore.changePassword / 系统配置页密码管理）。
   * V1.0 明文覆盖；生产环境应改为 bcrypt.compareSync + hashSync。
   */
  async changePassword(username: string, newPassword: string) {
    const acc = await this.accountRepo.findOne({ where: { username } });
    if (!acc) throw new UnauthorizedException('账号不存在');
    acc.password = newPassword;
    await this.accountRepo.save(acc);
    return { ok: true };
  }
}
