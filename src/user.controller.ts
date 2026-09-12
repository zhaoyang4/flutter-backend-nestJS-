import { Controller, Get, Post, Put, Body, Param, ParseIntPipe } from '@nestjs/common';
import { UserService } from './user.service';

/**
 * 注册用户（顾客）接口。
 *
 * 路由：
 *   GET  /api/users            列表（收银端「注册用户管理」页）
 *   POST /api/users            注册新用户（网页端顾客注册）
 *   PUT  /api/users/:id        编辑信息/余额（收银端管理页）
 *   POST /api/users/:id/recharge  会员储值充值（余额累加）
 */
@Controller('api/users')
export class UserController {
  constructor(private readonly svc: UserService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  register(@Body() b: any) {
    return this.svc.register(b);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.updateUser(id, b);
  }

  @Post(':id/recharge')
  recharge(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.recharge(id, b.amount);
  }
}
