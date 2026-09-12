import { Controller, Get } from '@nestjs/common';
import { MenuService } from './menu.service';

/**
 * 菜单接口：顾客端点餐页拉取数据。
 * GET /api/menu  → 返回分类+菜品+套餐+活动+门店配置（一次拿全）
 */
@Controller('api/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  getStorefront() {
    // 直接调用聚合服务，把打包好的点餐页数据返回 APP
    return this.menuService.getStorefront();
  }
}
