import { Controller, Post, Patch, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * 登录 / 密码接口（对应前端 AdminStore.login / changePassword）。
 *
 * POST /api/auth/login   { username, password } → { username, role, displayName }
 * PATCH /api/auth/password { username, newPassword } → { ok: true }
 *
 * V1.0 不签发 token，前端靠 role 过滤菜单；后续接 JWT 时再加 AuthGuard。
 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    if (!body.username || !body.password) {
      throw new UnauthorizedException('请输入账号和密码');
    }
    return this.auth.login(body.username, body.password);
  }

  /** 修改密码（对应系统配置页「密码管理」）。 */
  @Patch('password')
  changePassword(@Body() body: { username?: string; newPassword?: string }) {
    if (!body.username || !body.newPassword) {
      throw new UnauthorizedException('缺少账号或新密码');
    }
    return this.auth.changePassword(body.username, body.newPassword);
  }
}
