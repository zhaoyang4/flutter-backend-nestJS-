import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { Dish } from './dish.entity';
import { Combo } from './combo.entity';
import { ComboItem } from './combo-item.entity';
import { Activity } from './activity.entity';
import { TableNo } from './table-no.entity';
import { StoreConfig } from './store-config.entity';

/**
 * 管理端写操作服务（对应收银端 AdminStore 的写方法）。
 *
 * 职责：把「管理员在收银端做的增删改」落到数据库。所有方法都注入对应实体的
 * Repository（TypeORM 的数据访问对象），用 save/remove 完成增删改。
 *
 * 为什么单独一个 ManageService 而不是每个资源一个？
 *   本项目后端是「单根模块」风格（见 app.module.ts），按资源拆太多文件反而碎。
 *   这里按资源分组写方法，注释里标清楚每段管什么，便于你按需求模块对照学习。
 *
 * 返回形状：尽量贴近前端各 model 的 fromJson（id 用数字，前端再 String()），
 * 让阶段 E「前端 AdminStore 对接后端」时页面调用点几乎不动。
 */
@Injectable()
export class ManageService {
  constructor(
    @InjectRepository(Category)
    private catRepo: Repository<Category>,
    @InjectRepository(Dish)
    private dishRepo: Repository<Dish>,
    @InjectRepository(Combo)
    private comboRepo: Repository<Combo>,
    @InjectRepository(ComboItem)
    private comboItemRepo: Repository<ComboItem>,
    @InjectRepository(Activity)
    private actRepo: Repository<Activity>,
    @InjectRepository(TableNo)
    private tableRepo: Repository<TableNo>,
    @InjectRepository(StoreConfig)
    private storeRepo: Repository<StoreConfig>,
  ) {}

  // ============================================================
  // 一、菜品分类（对应需求「二、菜品&套餐——分类增删改」）
  // ============================================================
  async createCategory(name: string, sortOrder = 0) {
    return this.catRepo.save(this.catRepo.create({ name, sort: sortOrder, enabled: 1 }));
  }

  async updateCategory(id: number, name?: string, sortOrder?: number, enabled?: number) {
    const c = await this.catRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('分类不存在');
    if (name != null) c.name = name;
    if (sortOrder != null) c.sort = sortOrder;
    if (enabled != null) c.enabled = enabled;
    return this.catRepo.save(c);
  }

  async deleteCategory(id: number) {
    const c = await this.catRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('分类不存在');
    await this.catRepo.remove(c);
    return { ok: true };
  }

  // ============================================================
  // 二、菜品（录入 / 改价 / 上下架 / 库存 / 删除）
  // ============================================================
  async createDish(dto: any) {
    const d = this.dishRepo.create({
      categoryId: Number(dto.categoryId),
      name: dto.name,
      imageUrl: dto.imageUrl ?? null,
      // 录入时原价=售价；后续改价只动 currentPrice，原价留作划线价
      originalPrice: Number(dto.price),
      currentPrice: Number(dto.price),
      stock: dto.stock ?? -1,
      description: dto.description ?? null,
      enableSpec: dto.enableSpec ? 1 : 0,
      specs: dto.specs ?? null,
      status: 'available',
      enabled: 1,
    });
    return this.dishRepo.save(d);
  }

  async updateDish(id: number, dto: any) {
    const d = await this.dishRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('菜品不存在');
    if (dto.name != null) d.name = dto.name;
    if (dto.categoryId != null) d.categoryId = Number(dto.categoryId);
    if (dto.price != null) d.currentPrice = Number(dto.price);
    if (dto.imageUrl !== undefined) d.imageUrl = dto.imageUrl || null;
    if (dto.stock != null) d.stock = Number(dto.stock);
    if (dto.description !== undefined) d.description = dto.description || null;
    if (dto.enableSpec != null) d.enableSpec = dto.enableSpec ? 1 : 0;
    if (dto.specs !== undefined) d.specs = dto.specs ?? null;
    return this.dishRepo.save(d);
  }

  async deleteDish(id: number) {
    const d = await this.dishRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('菜品不存在');
    await this.dishRepo.remove(d); // 逻辑删除留作后续；V1.0 直接删（演示数据）
    return { ok: true };
  }

  /** 改价：只动 currentPrice。 */
  async changeDishPrice(id: number, price: number) {
    const d = await this.dishRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('菜品不存在');
    d.currentPrice = Number(price);
    return this.dishRepo.save(d);
  }

  /** 设置库存：-1 表示不限量。 */
  async setDishStock(id: number, stock: number) {
    const d = await this.dishRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('菜品不存在');
    d.stock = Number(stock);
    return this.dishRepo.save(d);
  }

  /** 上下架：enabled=1 上架(available) / 0 下架(unavailable)。 */
  async toggleDish(id: number, enabled: number) {
    const d = await this.dishRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('菜品不存在');
    d.enabled = enabled ? 1 : 0;
    d.status = enabled ? 'available' : 'unavailable';
    return this.dishRepo.save(d);
  }

  // ============================================================
  // 三、套餐（创建 / 绑菜 / 设售价 / 删除）
  // ============================================================
  async createCombo(dto: any) {
    const combo = await this.comboRepo.save(
      this.comboRepo.create({
        name: dto.name,
        imageUrl: dto.imageUrl ?? null,
        price: Number(dto.price),
        participateInActivity: dto.participateActivity ? 1 : 0,
        status: 'available',
        enabled: 1,
      }),
    );
    await this.saveComboItems(combo.id, dto.items);
    return combo;
  }

  async updateCombo(id: number, dto: any) {
    const c = await this.comboRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('套餐不存在');
    if (dto.name != null) c.name = dto.name;
    if (dto.price != null) c.price = Number(dto.price);
    if (dto.participateActivity != null) c.participateInActivity = dto.participateActivity ? 1 : 0;
    if (dto.imageUrl !== undefined) c.imageUrl = dto.imageUrl || null;
    await this.comboRepo.save(c);
    if (Array.isArray(dto.items)) await this.saveComboItems(id, dto.items);
    return c;
  }

  async deleteCombo(id: number) {
    const c = await this.comboRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('套餐不存在');
    await this.comboItemRepo.delete({ comboId: id }); // 先删明细，再删主表
    await this.comboRepo.remove(c);
    return { ok: true };
  }

  /** 套餐明细保存：先清旧再插新（简化 upsert）。 */
  private async saveComboItems(comboId: number, items: any[]) {
    if (!Array.isArray(items)) return;
    await this.comboItemRepo.delete({ comboId });
    const rows = items.map((it) =>
      this.comboItemRepo.create({
        comboId,
        dishId: Number(it.dishId),
        quantity: Number(it.quantity ?? 1),
      }),
    );
    if (rows.length) await this.comboItemRepo.save(rows);
  }

  // ============================================================
  // 四、活动折扣（新增 / 编辑 / 停用 / 删除）
  // ============================================================
  async createActivity(dto: any) {
    // 读接口 getActivitiesFlat 返回「扁平字段」(discountType/ratioValue/
    // fixedPrice/applyAll/dishIds/stackable)，前端 Activity.toJson 发的也是同一套。
    // 这里把扁平字段映射到实体列，保证「读」和「写」字段一致，活动不会被存成默认值。
    const type = dto.discountType ?? 'ratio'; // 'ratio' 比例折扣 / 'fixed' 固定特价
    const value =
      type === 'fixed' ? Number(dto.fixedPrice ?? 0) : Number(dto.ratioValue ?? 1);
    const scope = dto.applyAll ? 'all' : 'selected'; // all 全店 / selected 指定商品
    const applicableItems = dto.applyAll ? null : (dto.dishIds ?? []).map(Number);
    return this.actRepo.save(
      this.actRepo.create({
        name: dto.name,
        type,
        value,
        scope,
        applicableItems,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        startTime: dto.startTime ? dto.startTime + ':00' : null,
        endTime: dto.endTime ? dto.endTime + ':00' : null,
        allowStacking: dto.stackable ? 1 : 0,
        supportDineIn: dto.supportDineIn ? 1 : 0,
        supportTakeout: dto.supportTakeout ? 1 : 0,
        enabled: dto.enabled ? 1 : 0,
      }),
    );
  }

  async updateActivity(id: number, dto: any) {
    const a = await this.actRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('活动不存在');
    if (dto.name != null) a.name = dto.name;
    // 同样按「扁平字段」映射（与 createActivity 一致）
    if (dto.discountType != null) {
      a.type = dto.discountType;
      a.value =
        dto.discountType === 'fixed'
          ? Number(dto.fixedPrice ?? a.value)
          : Number(dto.ratioValue ?? a.value);
    } else {
      if (dto.ratioValue != null) a.value = Number(dto.ratioValue);
      if (dto.fixedPrice != null) a.value = Number(dto.fixedPrice);
    }
    if (dto.applyAll != null) {
      a.scope = dto.applyAll ? 'all' : 'selected';
      if (dto.applyAll) a.applicableItems = null;
    }
    if (dto.dishIds != null) a.applicableItems = dto.dishIds.map(Number);
    if (dto.startDate !== undefined) a.startDate = dto.startDate;
    if (dto.endDate !== undefined) a.endDate = dto.endDate;
    if (dto.startTime !== undefined) a.startTime = dto.startTime ? dto.startTime + ':00' : null;
    if (dto.endTime !== undefined) a.endTime = dto.endTime ? dto.endTime + ':00' : null;
    if (dto.stackable != null) a.allowStacking = dto.stackable ? 1 : 0;
    if (dto.supportDineIn != null) a.supportDineIn = dto.supportDineIn ? 1 : 0;
    if (dto.supportTakeout != null) a.supportTakeout = dto.supportTakeout ? 1 : 0;
    if (dto.enabled != null) a.enabled = dto.enabled ? 1 : 0;
    return this.actRepo.save(a);
  }

  async deleteActivity(id: number) {
    const a = await this.actRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('活动不存在');
    await this.actRepo.remove(a);
    return { ok: true };
  }

  // ============================================================
  // 五、堂食桌号（新增 / 编辑 / 删除）
  // ============================================================
  async createTable(dto: any) {
    const no = String(dto.tableNo);
    const exists = await this.tableRepo.findOne({ where: { tableNo: no } });
    if (exists) throw new BadRequestException('桌号已存在');
    return this.tableRepo.save(
      this.tableRepo.create({
        tableNo: no,
        status: 'free',
        qrCode: dto.qrCode ?? `TABLE:${no}`, // 默认二维码内容
        sort: dto.sort ?? 0,
      }),
    );
  }

  async updateTable(id: number, dto: any) {
    const t = await this.tableRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('桌号不存在');
    if (dto.tableNo != null) t.tableNo = String(dto.tableNo);
    if (dto.qrCode !== undefined) t.qrCode = dto.qrCode;
    if (dto.status != null) t.status = dto.status;
    if (dto.sort != null) t.sort = dto.sort;
    return this.tableRepo.save(t);
  }

  async deleteTable(id: number) {
    const t = await this.tableRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('桌号不存在');
    await this.tableRepo.remove(t);
    return { ok: true };
  }

  // ============================================================
  // 六、系统配置（门店信息 / 外卖规则 / 支付参数 / 取餐号开关）
  // ============================================================
  async saveStoreConfig(dto: any) {
    let s = await this.storeRepo.findOne({ where: { id: 1 } });
    if (!s) s = this.storeRepo.create({ id: 1 });
    if (dto.storeName !== undefined) s.shopName = dto.storeName;
    if (dto.takeoutMinOrder !== undefined) s.minOrderAmount = Number(dto.takeoutMinOrder);
    if (dto.takeoutDeliveryFee !== undefined) s.deliveryFee = Number(dto.takeoutDeliveryFee);
    if (dto.phone !== undefined) s.phone = dto.phone;
    if (dto.address !== undefined) s.address = dto.address;
    if (dto.enablePickupNumber !== undefined) s.enablePickupNumber = dto.enablePickupNumber ? 1 : 0;
    if (dto.wechatAppId !== undefined) s.wechatAppId = dto.wechatAppId;
    if (dto.wechatMchId !== undefined) s.wechatMchId = dto.wechatMchId;
    if (dto.wechatApiKey !== undefined) s.wechatApiKey = dto.wechatApiKey;
    if (dto.alipayAppId !== undefined) s.alipayAppId = dto.alipayAppId;
    if (dto.alipayPrivateKey !== undefined) s.alipayPrivateKey = dto.alipayPrivateKey;
    return this.storeRepo.save(s);
  }
}
