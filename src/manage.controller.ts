import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ManageService } from './manage.service';

/**
 * 管理端写接口（收银员/管理员在后台做的增删改）。
 *
 * 统一前缀 /api/admin，与「顾客端只读接口 /api/*」区分开，便于以后加鉴权 guard。
 * 路由一览（对齐前端 AdminStore 的写方法，阶段 E 对接时一一对应）：
 *
 *   分类：POST /api/admin/categories        新增
 *         PUT  /api/admin/categories/:id    编辑（name/sortOrder/enabled）
 *         DELETE /api/admin/categories/:id  删除
 *
 *   菜品：POST /api/admin/dishes             新增
 *         PUT  /api/admin/dishes/:id        编辑
 *         DELETE /api/admin/dishes/:id      删除
 *         POST /api/admin/dishes/:id/price  改价
 *         POST /api/admin/dishes/:id/stock  设库存
 *         POST /api/admin/dishes/:id/toggle 上下架
 *
 *   套餐：POST /api/admin/combos            新增（含 items 绑菜）
 *         PUT  /api/admin/combos/:id        编辑
 *         DELETE /api/admin/combos/:id      删除
 *
 *   活动：POST /api/admin/activities         新增
 *         PUT  /api/admin/activities/:id     编辑
 *         DELETE /api/admin/activities/:id   删除
 *
 *   桌号：POST /api/admin/tables            新增
 *         PUT  /api/admin/tables/:id        编辑
 *         DELETE /api/admin/tables/:id      删除
 *
 *   配置：PUT /api/admin/store/config       保存门店配置
 */
@Controller('api/admin')
export class ManageController {
  constructor(private readonly svc: ManageService) {}

  // —— 分类 ——
  @Post('categories')
  createCategory(@Body() b: any) {
    return this.svc.createCategory(b.name, b.sortOrder ?? 0);
  }

  @Put('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.updateCategory(id, b.name, b.sortOrder, b.enabled);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteCategory(id);
  }

  // —— 菜品 ——
  @Post('dishes')
  createDish(@Body() b: any) {
    this.require(b.name, 'name');
    this.require(b.categoryId, 'categoryId');
    this.require(b.price, 'price');
    return this.svc.createDish(b);
  }

  @Put('dishes/:id')
  updateDish(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.updateDish(id, b);
  }

  @Delete('dishes/:id')
  deleteDish(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteDish(id);
  }

  @Post('dishes/:id/price')
  changePrice(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.changeDishPrice(id, b.price);
  }

  @Post('dishes/:id/stock')
  setStock(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.setDishStock(id, b.stock);
  }

  @Post('dishes/:id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.toggleDish(id, b.enabled);
  }

  // —— 套餐 ——
  @Post('combos')
  createCombo(@Body() b: any) {
    this.require(b.name, 'name');
    this.require(b.price, 'price');
    return this.svc.createCombo(b);
  }

  @Put('combos/:id')
  updateCombo(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.updateCombo(id, b);
  }

  @Delete('combos/:id')
  deleteCombo(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteCombo(id);
  }

  // —— 活动 ——
  @Post('activities')
  createActivity(@Body() b: any) {
    this.require(b.name, 'name');
    return this.svc.createActivity(b);
  }

  @Put('activities/:id')
  updateActivity(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.updateActivity(id, b);
  }

  @Delete('activities/:id')
  deleteActivity(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteActivity(id);
  }

  // —— 桌号 ——
  @Post('tables')
  createTable(@Body() b: any) {
    this.require(b.tableNo, 'tableNo');
    return this.svc.createTable(b);
  }

  @Put('tables/:id')
  updateTable(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.updateTable(id, b);
  }

  @Delete('tables/:id')
  deleteTable(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteTable(id);
  }

  // —— 门店配置 ——
  @Put('store/config')
  saveStore(@Body() b: any) {
    return this.svc.saveStoreConfig(b);
  }

  /** 简单必填校验，避免脏数据进服务层。 */
  private require(v: any, field: string) {
    if (v == null || v === '') {
      throw new BadRequestException(`缺少必填字段 ${field}`);
    }
  }
}
