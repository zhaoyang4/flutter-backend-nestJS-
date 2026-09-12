import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { Dish } from './dish.entity';
import { Combo } from './combo.entity';
import { Activity } from './activity.entity';
import { StoreConfig } from './store-config.entity';
import { PricingService } from './pricing.service';

/**
 * 菜单聚合服务：把「点餐页需要的所有数据」一次性打包给 APP。
 *
 * 顾客端点餐页一次请求就要拿到：分类、菜品、套餐、活动、门店配置（含起送价/配送费）。
 * 后端聚合成一个结构返回，APP 不用发好几个请求，也便于统一算价时的数据一致。
 *
 * 这里还顺手做了「推荐」逻辑（需求七，极简版）：
 *   推荐 = 销量最高（V1.0 暂无销量统计，用 sort/默认排序占位）+ 活动折扣商品优先。
 *   真正的「销量排序」等后期有订单数据后可再升级，V1.0 先保证稳定无 bug。
 */
@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    @InjectRepository(Dish)
    private dishRepo: Repository<Dish>,
    @InjectRepository(Combo)
    private comboRepo: Repository<Combo>,
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(StoreConfig)
    private storeRepo: Repository<StoreConfig>,
    private pricing: PricingService,
  ) {}

  /**
   * 组装点餐页数据（聚合视图，APP 点餐页一次拉全）。
   */
  async getStorefront() {
    const categories = await this.categoryRepo.find({
      where: { enabled: 1 },
      order: { sort: 'ASC' },
    });

    const dishes = await this.dishRepo.find({
      where: { enabled: 1, status: 'available' },
      order: { id: 'ASC' },
    });
    const dishesByCategory = categories.map((c) => ({
      id: c.id,
      name: c.name,
      dishes: dishes
        .filter((d) => d.categoryId === c.id)
        .map((d) => ({
          id: d.id,
          name: d.name,
          imageUrl: d.imageUrl,
          originalPrice: Number(d.originalPrice),
          currentPrice: Number(d.currentPrice),
          status: d.status,
          stock: d.stock,
        })),
    }));

    const combos = await this.comboRepo.find({
      where: { enabled: 1, status: 'available' },
      relations: ['items', 'items.dish'],
    });
    const comboList = combos.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      price: Number(c.price),
      participateInActivity: c.participateInActivity,
      items:
        c.items?.map((it) => ({
          dishId: it.dishId,
          dishName: it.dish?.name ?? '',
          quantity: it.quantity,
        })) ?? [],
    }));

    const activities = await this.activityRepo.find({ where: { enabled: 1 } });
    const activityList = activities.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      value: Number(a.value),
      scope: a.scope,
      applicableItems: a.applicableItems ?? [],
      allowStacking: a.allowStacking,
      supportDineIn: a.supportDineIn,
      supportTakeout: a.supportTakeout,
    }));

    const store = await this.storeRepo.findOne({ where: { id: 1 } });
    const storeConfig = store
      ? {
          shopName: store.shopName,
          minOrderAmount: Number(store.minOrderAmount),
          deliveryFee: Number(store.deliveryFee),
        }
      : { shopName: '我的小店', minOrderAmount: 0, deliveryFee: 0 };

    const discountedDishIds = new Set<number>();
    for (const a of activities) {
      if (a.scope === 'all') dishes.forEach((d) => discountedDishIds.add(d.id));
      else (a.applicableItems ?? []).forEach((id) => discountedDishIds.add(id));
    }
    const recommendDishes = dishes
      .filter((d) => discountedDishIds.has(d.id))
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        name: d.name,
        imageUrl: d.imageUrl,
        currentPrice: Number(d.currentPrice),
      }));

    return {
      categories: dishesByCategory,
      combos: comboList,
      activities: activityList,
      storeConfig,
      recommendDishes,
    };
  }

  // ============================================================
  // 下列方法对齐「前端 HttpApiService 契约」：扁平 REST 资源
  // （/api/categories、/api/dishes、/api/combos、/api/activities、/api/store/config）
  // 字段命名与形状严格匹配前端各 model 的 fromJson。
  // ============================================================

  /** GET /api/store/config → StoreConfig */
  async getStoreConfigFlat() {
    const store = await this.storeRepo.findOne({ where: { id: 1 } });
    return {
      storeName: store?.shopName ?? '我的小店',
      takeoutMinOrder: store ? Number(store.minOrderAmount) : 0,
      takeoutDeliveryFee: store ? Number(store.deliveryFee) : 0,
      phone: store?.phone ?? null,
      address: store?.address ?? null,
      // 把取餐号开关与支付参数也透传给前端，否则收银端保存后刷新会"丢失"
      enablePickupNumber: store ? store.enablePickupNumber === 1 : false,
      wechatAppId: store?.wechatAppId ?? null,
      wechatMchId: store?.wechatMchId ?? null,
      wechatApiKey: store?.wechatApiKey ?? null,
      alipayAppId: store?.alipayAppId ?? null,
      alipayPrivateKey: store?.alipayPrivateKey ?? null,
    };
  }

  /** GET /api/categories → List<Category> */
  async getCategoriesFlat() {
    const categories = await this.categoryRepo.find({
      where: { enabled: 1 },
      order: { sort: 'ASC' },
    });
    return categories.map((c) => ({
      id: String(c.id),
      name: c.name,
      sortOrder: c.sort,
    }));
  }

  /** GET /api/dishes → List<Dish>（含后端计算的 activityPrice） */
  async getDishesFlat() {
    const dishes = await this.dishRepo.find({
      where: { enabled: 1 },
      order: { id: 'ASC' },
    });
    return Promise.all(
      dishes.map(async (d) => ({
        id: String(d.id),
        categoryId: String(d.categoryId),
        name: d.name,
        imageUrl: d.imageUrl ?? null,
        originalPrice: Number(d.originalPrice),
        currentPrice: Number(d.currentPrice),
        status: d.status === 'available' ? 'onSale' : 'offShelf',
        stock: d.stock ?? -1,
        sales: 0,
        description: d.description ?? null,
        enableSpec: d.enableSpec === 1,
        specs: (d.specs as any) ?? [],
        activityPrice: await this.bestActivityPrice(d.id, false, true),
      })),
    );
  }

  /** GET /api/combos → List<Combo>（含后端计算的 activityPrice） */
  async getCombosFlat() {
    const combos = await this.comboRepo.find({
      where: { enabled: 1 },
      relations: ['items', 'items.dish'],
    });
    return Promise.all(
      combos.map(async (c) => ({
        id: String(c.id),
        name: c.name,
        imageUrl: c.imageUrl ?? null,
        price: Number(c.price),
        items: (c.items ?? []).map((it) => ({
          dishId: String(it.dishId),
          dishName: it.dish?.name ?? '',
          quantity: it.quantity,
        })),
        participateActivity: c.participateInActivity === 1,
        status: c.status === 'available' ? 'onSale' : 'offShelf',
        sales: 0,
        activityPrice: await this.bestActivityPrice(
          c.id,
          true,
          c.participateInActivity === 1,
        ),
      })),
    );
  }

  /** GET /api/activities → List<Activity> */
  async getActivitiesFlat() {
    const activities = await this.activityRepo.find({ where: { enabled: 1 } });
    return activities.map((a) => ({
      id: String(a.id),
      name: a.name,
      startDate: a.startDate || '2000-01-01',
      endDate: a.endDate || '2099-12-31',
      startTime: (a.startTime || '00:00:00').slice(0, 5),
      endTime: (a.endTime || '23:59:59').slice(0, 5),
      discountType: a.type, // 'ratio' | 'fixed'，与前端一致
      ratioValue: a.type === 'ratio' ? Number(a.value) : 1,
      fixedPrice: a.type === 'fixed' ? Number(a.value) : 0,
      applyAll: a.scope === 'all',
      dishIds: (a.applicableItems ?? []).map(String),
      stackable: a.allowStacking === 1,
      supportDineIn: a.supportDineIn === 1,
      supportTakeout: a.supportTakeout === 1,
      enabled: a.enabled === 1,
    }));
  }

  /**
   * 计算某商品「当前最优活动价」（堂食 + 外卖场景取最低）。
   * 无命中活动时返回 null（前端表示「当前无活动」）。
   */
  private async bestActivityPrice(
    refId: number,
    isCombo: boolean,
    canJoin: boolean,
  ): Promise<number | null> {
    const type = isCombo ? 'combo' : 'dish';
    const dine = await this.pricing.priceSingle(
      { type, refId, qty: 1 },
      'dine_in',
    );
    const take = await this.pricing.priceSingle(
      { type, refId, qty: 1 },
      'takeout',
    );
    const vals = [dine, take].filter(
      (v): v is number => v != null,
    );
    return vals.length ? Math.min(...vals) : null;
  }
}
