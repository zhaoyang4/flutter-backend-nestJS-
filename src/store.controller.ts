import { Controller, Get } from '@nestjs/common';
import { MenuService } from './menu.service';

/**
 * 门店/目录资源接口（对齐前端 HttpApiService 契约）。
 * 前缀 api，路由：
 *   GET /api/store/config   门店配置（起送价/配送费/店名/电话/地址）
 *   GET /api/categories     分类列表
 *   GET /api/dishes         菜品列表（含 activityPrice）
 *   GET /api/combos         套餐列表（含 activityPrice）
 *   GET /api/activities     活动列表
 */
@Controller('api')
export class StoreController {
  constructor(private readonly menu: MenuService) {}

  /** GET /api/store/config → StoreConfig */
  @Get('store/config')
  storeConfig() {
    return this.menu.getStoreConfigFlat();
  }

  /** GET /api/categories → List<Category> */
  @Get('categories')
  categories() {
    return this.menu.getCategoriesFlat();
  }

  /** GET /api/dishes → List<Dish> */
  @Get('dishes')
  dishes() {
    return this.menu.getDishesFlat();
  }

  /** GET /api/combos → List<Combo> */
  @Get('combos')
  combos() {
    return this.menu.getCombosFlat();
  }

  /** GET /api/activities → List<Activity> */
  @Get('activities')
  activities() {
    return this.menu.getActivitiesFlat();
  }
}
