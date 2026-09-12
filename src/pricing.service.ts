import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from './activity.entity';
import { Dish } from './dish.entity';
import { Combo } from './combo.entity';
import { OrderType } from './order.entity';
import { StoreConfig } from './store-config.entity';

/**
 * 购物车每一项的结构（顾客端提交上来的）。
 * type  是 'dish'(单品) 还是 'combo'(套餐)；
 * refId 对应 dish.id 或 combo.id；
 * qty   数量。
 */
export interface CartLine {
  type: 'dish' | 'combo';
  refId: number;
  qty: number;
}

/**
 * 算价结果中，单件商品的明细（供前端展示与落库）。
 */
export interface PricedItem {
  type: 'dish' | 'combo';
  refId: number;
  name: string;
  originalPrice: number; // 原价单价（单品=currentPrice；套餐=price）
  activityPrice: number; // 活动后单价（已经算完折扣）
  discount: number; // 该件省下的钱 = (原价-活动价) × 数量
  qty: number;
  appliedActivityNames: string[]; // 命中了哪些活动（前端展示「活动价」标签用）
}

/**
 * 整个订单的算价汇总。
 */
export interface PriceResult {
  items: PricedItem[]; // 每项商品算价明细
  originalAmount: number; // 原价合计 = Σ(原价×数量)
  discountAmount: number; // 优惠合计 = Σ省下的钱
  deliveryFee: number; // 配送费（仅外卖且达起送价时>0）
  payableAmount: number; // 实付 = 原价 - 优惠 + 配送费
  freeDeliveryShort: number; // 外卖还差多少达起送价（>0 表示不能提交）
}

/**
 * 统一算价服务（V1.0 价格唯一真相来源）。
 *
 * 职责：给定购物车 + 订单类型(堂食/外卖)，算出每一项的折后价、整单优惠、
 *       配送费、实付金额。前端只展示，不计算。
 *
 * 与 APP 侧 MockApiService 的算法保持一致（前期用 Mock 让 APP 先跑，
 * 现在后端给出真实算价，切到 HttpApiService 后结果应当一致）。
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(Dish)
    private dishRepo: Repository<Dish>,
    @InjectRepository(Combo)
    private comboRepo: Repository<Combo>,
    @InjectRepository(StoreConfig)
    private storeRepo: Repository<StoreConfig>,
  ) {}

  /**
   * 主入口：算一整笔订单。
   * @param lines 购物车
   * @param orderType 堂食 or 外卖（决定活动是否适用、是否算配送费）
   */
  async calc(lines: CartLine[], orderType: OrderType): Promise<PriceResult> {
    // 1) 取出所有启用中的活动（一次性查库，循环里复用，避免 N+1 查询）
    const activities = await this.activityRepo.find({ where: { enabled: 1 } });

    const items: PricedItem[] = [];
    let originalAmount = 0;
    let discountAmount = 0;

    // 2) 逐个商品算价
    for (const line of lines) {
      const priced = await this.priceOne(line, orderType, activities);
      items.push(priced);
      originalAmount += priced.originalPrice * priced.qty;
      discountAmount += priced.discount;
    }

    // 3) 配送费（仅外卖，且达到起送价才收；否则标记未达起送）
    const store = (await this.storeRepo.findOne({ where: { id: 1 } })) ?? null;
    let deliveryFee = 0;
    let freeDeliveryShort = 0;
    // ⚠️ 坑点：StoreConfig 的 minOrderAmount / deliveryFee 是 decimal 列，
    // TypeORM 查出来是「字符串」而非数字。这里必须 Number() 转成数字，
    // 否则下面 (原价-优惠+配送费) 会变成字符串拼接，触发
    // `.toFixed is not a function`（外卖分支必崩；堂食因 deliveryFee 保持 0 不触发）。
    const minOrder = Number(store?.minOrderAmount ?? 0);
    if (orderType === 'takeout') {
      // 外卖「原价合计」是否达到起送价（V1.0 以原价计起送，简单可预期）
      if (originalAmount >= minOrder) {
        deliveryFee = Number(store?.deliveryFee ?? 0);
      } else {
        freeDeliveryShort = Number((minOrder - originalAmount).toFixed(2));
      }
    }

    // 4) 实付 = 原价 - 优惠 + 配送费（金额都按 2 位小数收口，避免浮点误差）
    const payableAmount = Number(
      (originalAmount - discountAmount + deliveryFee).toFixed(2),
    );

    return {
      items,
      originalAmount: Number(originalAmount.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      deliveryFee,
      payableAmount,
      freeDeliveryShort,
    };
  }

  /**
   * 算「单个商品」的活动价。
   * 关键点：一个商品可能命中多个活动，需要按「叠加规则」决定最终价。
   */
  private async priceOne(
    line: CartLine,
    orderType: OrderType,
    activities: Activity[],
  ): Promise<PricedItem> {
    // 取出商品基础信息（原价）
    let name = '';
    let basePrice = 0;
    let canJoinActivity = true;
    if (line.type === 'dish') {
      const d = await this.dishRepo.findOne({ where: { id: line.refId } });
      if (!d) throw new Error(`菜品不存在: ${line.refId}`);
      name = d.name;
      basePrice = Number(d.currentPrice);
      canJoinActivity = true; // 单品默认可参与活动
    } else {
      const c = await this.comboRepo.findOne({
        where: { id: line.refId },
        relations: ['items'],
      });
      if (!c) throw new Error(`套餐不存在: ${line.refId}`);
      name = c.name;
      basePrice = Number(c.price);
      canJoinActivity = c.participateInActivity === 1; // 套餐需显式开启
    }

    // 筛选出「当前生效 + 适用本商品 + 适用本场景(堂食/外卖)」的活动
    const eligible = activities.filter((a) =>
      this.isApplicable(a, line, orderType, canJoinActivity),
    );

    // 叠加规则：
    //  - 若命中活动里有任意一个 allowStacking=1 → 视为「叠加模式」，全部累加；
    //  - 否则 → 「最优模式」，只取让价格最低的那个活动。
    const finalPrice =
      eligible.length === 0
        ? basePrice
        : this.applyActivities(basePrice, eligible);
    const activityPrice = Number(finalPrice.toFixed(2));
    const saved = Number(((basePrice - activityPrice) * line.qty).toFixed(2));

    return {
      type: line.type,
      refId: line.refId,
      name,
      originalPrice: Number(basePrice.toFixed(2)),
      activityPrice,
      discount: saved,
      qty: line.qty,
      appliedActivityNames: eligible.map((a) => a.name),
    };
  }

  /**
   * 判断活动是否对当前商品/场景有效。
   */
  private isApplicable(
    a: Activity,
    line: CartLine,
    orderType: OrderType,
    canJoinActivity: boolean,
  ): boolean {
    if (a.enabled !== 1) return false; // 总开关关了
    // 场景：堂食单看 supportDineIn，外卖单看 supportTakeout
    if (orderType === 'dine_in' && a.supportDineIn !== 1) return false;
    if (orderType === 'takeout' && a.supportTakeout !== 1) return false;
    // 套餐是否被配置为「不参与活动」
    if (!canJoinActivity) return false;
    // 适用范围：selected 时只命中 applicableItems 内的商品
    if (a.scope === 'selected') {
      const list = a.applicableItems ?? [];
      if (!list.includes(line.refId)) return false;
    }
    // 时间窗：日期区间 + 每日时间段（空值表示该维度不限制）
    return this.inTimeWindow(a);
  }

  /**
   * 时间有效性判断（需求：活动日期 + 时间段）。
   * 用本地日期，格式与存储一致：YYYY-MM-DD / HH:mm:ss。
   */
  private inTimeWindow(a: Activity): boolean {
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = now.toTimeString().slice(0, 8); // HH:mm:ss

    if (a.startDate && a.endDate) {
      if (today < a.startDate || today > a.endDate) return false;
    }
    if (a.startTime && a.endTime) {
      if (time < a.startTime || time > a.endTime) return false;
    }
    return true;
  }

  /**
   * 把若干活动作用到 basePrice 上，返回最终价。
   * - 有 allowStacking → 多个活动依次作用（比例相乘 / 固定价取最低）；
   * - 无 allowStacking → 只取最优惠的一个（最终价最低者）。
   */
  private applyActivities(base: number, activities: Activity[]): number {
    const stacking = activities.some((a) => a.allowStacking === 1);
    if (stacking) {
      let price = base;
      for (const a of activities) price = this.applyOne(price, a);
      return price;
    }
    // 非叠加：每个活动单独算一个候选价，取最低
    let best = base;
    for (const a of activities) {
      const candidate = this.applyOne(base, a);
      if (candidate < best) best = candidate;
    }
    return best;
  }

  /**
   * 单个活动作用于价格：
   *  - ratio：price × value（0.8 = 八折）
   *  - fixed：直接取 value 作为新价（仅当 value < 当前价才更优惠，避免涨价）
   */
  private applyOne(price: number, a: Activity): number {
    if (a.type === 'ratio') {
      return Number((price * Number(a.value)).toFixed(2));
    }
    // fixed：固定特价，但不应高于原价（活动只让利，不让涨价）
    return Number(a.value) < price ? Number(a.value) : price;
  }

  /**
   * 给「单个商品」算活动价（菜单列表页用：决定 Dish/Combo 的 activityPrice）。
   * 无命中活动时返回 null（前端约定 null = 当前无活动）。
   */
  async priceSingle(
    line: CartLine,
    orderType: OrderType,
  ): Promise<number | null> {
    const activities = await this.activityRepo.find({ where: { enabled: 1 } });
    const priced = await this.priceOne(line, orderType, activities);
    // 无折扣时 activityPrice === originalPrice，映射为 null 表示「无活动」
    return priced.activityPrice < priced.originalPrice
      ? priced.activityPrice
      : null;
  }
}
