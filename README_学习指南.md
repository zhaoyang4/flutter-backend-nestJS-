# 点餐系统 V1.0 后端 · 学习指南

> 技术栈：NestJS 10 + TypeORM + MySQL 8
> 定位：顾客端 APP 的后端，负责「菜单数据 + 统一算价 + 订单/支付」这一核心闭环。
> 本文档帮你从零看懂整个后端是怎么搭起来的、每个文件干什么、钱是怎么算的。

---

## 一、整体架构（先建立全局观）

```
顾客端 APP (Flutter)
      │  HTTP JSON
      ▼
┌─────────────────────────────────────────┐
│  NestJS 后端 (本服务, 端口 3000)          │
│                                          │
│  Controller(接口) → Service(逻辑) → Repo │
│      │              │                    │
│      │              └─ PricingService   │ ← 统一算价引擎（价格唯一真相）
│      ▼                                   │
│  TypeORM ──► MySQL (order_system 库)    │
└─────────────────────────────────────────┘
```

**核心思想：前端不算钱。** 所有金额（原价/折扣/配送费/实付）都由后端 `PricingService` 计算，
前端只负责展示。这样价格规则改了（比如活动折扣调整）只动后端，APP 不用发版。

---

## 二、文件清单（按职责分组）

### 1. 入口与配置
| 文件 | 作用 |
|------|------|
| `src/main.ts` | 程序入口。`NestFactory.create` 启动应用，开 CORS，加全局参数校验。 |
| `src/config.ts` | 读取端口、数据库账号等配置（带默认值，适配本地 MySQL）。 |
| `src/app.module.ts` | **装配中心**。注册数据库连接 + 所有实体 + 所有 Controller/Service。 |
| `tsconfig.json` / `nest-cli.json` | TypeScript 编译配置。 |

### 2. 数据模型（TypeORM 实体，每张表一个文件）
| 文件 | 对应需求 | 说明 |
|------|---------|------|
| `category.entity.ts` | 菜品分类 | 菜单分类标签（热菜/饮品…） |
| `dish.entity.ts` | 菜品录入/改价/上下架 | `originalPrice` 原价、`currentPrice` 当前售价（可改）、`stock=-1` 不限制库存 |
| `combo.entity.ts` | 套餐 | 打包价 `price`，`participateInActivity` 是否参与活动 |
| `combo-item.entity.ts` | 套餐绑定菜品 | **中间表**，解决套餐↔菜品的多对多关系 |
| `activity.entity.ts` | 活动折扣 | 折扣方式(ratio/fixed)、适用范围、时间窗、叠加开关、堂食/外卖开关 |
| `order.entity.ts` | 订单 | 统一订单（堂食/外卖），四个金额字段 + 状态流 |
| `order-item.entity.ts` | 订单明细 | 每笔订单含哪些商品、单价、活动价（落库锁定，防篡改） |
| `table-no.entity.ts` | 桌号管理 | 桌号状态、二维码内容 |
| `store-config.entity.ts` | 系统配置 | 起送价、配送费、支付参数预留 |

> 💡 **为什么套餐要拆两张表？** 一个套餐含多个菜品，一个菜品可在多个套餐里，这是多对多，
> 数据库必须加一张中间表 `combo_item`（每行=某套餐含某菜品几份）。

### 3. 业务逻辑（Service）
| 文件 | 作用 |
|------|------|
| `pricing.service.ts` | **算价引擎（最重要的文件）**。给定购物车，算出每项折后价、整单优惠、配送费、实付。 |
| `menu.service.ts` | 把「分类+菜品+套餐+活动+门店配置」聚合成一个结构返回点餐页。 |
| `order.service.ts` | 订单预览/下单/支付二维码/支付回调/列表/详情/完成。 |

### 4. 接口层（Controller）
| 文件 | 路由 |
|------|------|
| `menu.controller.ts` | `GET /api/menu` 拉点餐页数据 |
| `order.controller.ts` | `/api/order/preview`、`/submit`、`/callback`、`/list`、`:orderNo`、`/:orderNo/complete` |
| `table.controller.ts` | `/api/tables`、`/:no/bind`、`/:no/open` 桌号相关 |

### 5. 辅助
| 文件 | 作用 |
|------|------|
| `seed.ts` | 建库 + 建表 + 灌演示数据，一键初始化。 |

---

## 三、算价引擎怎么算（PricingService 详解）

这是 V1.0 的"价格大脑"，前端完全依赖它。算法分四步：

```
1. 查所有启用中的活动（一次查库，循环里复用，避免 N+1 查询）。
2. 逐项算价：
   - 取出商品基础价（单品=currentPrice，套餐=price）。
   - 筛选出「当前时间生效 + 适用本商品 + 适用本场景(堂食/外卖) + 套餐已开启参与」的活动。
   - 叠加规则：
       * 若有任一活动 allowStacking=1 → 多个活动依次作用（比例相乘/特价取低）。
       * 否则 → 只取让价格最低的那个活动。
   - 算出 activityPrice（折后价）和 discount（省下的钱）。
3. 配送费（仅外卖）：达到起送价才收固定配送费；否则标记 freeDeliveryShort（还差多少）。
4. 实付 = 原价合计 − 优惠合计 + 配送费。
```

**活动匹配判断（isApplicable）逐条核对：**
- 总开关 enabled？
- 场景对不对（堂食单看 supportDineIn，外卖单看 supportTakeout）？
- 套餐有没有开 participateInActivity？
- 适用范围：selected 时只命中 applicableItems 里的商品？
- 时间窗：日期区间 + 每日时间段（空值=不限制）？

> 💡 这就是为什么需求里强调"活动可单独控制堂食/外卖、可设叠加"——
> 这些开关全部落在 `activity` 表的字段上，算价引擎逐个判断。

---

## 四、接口契约（与 APP 对齐）

APP 端有 `MockApiService`（前期没后端时用的假数据），真实后端接口与其一一对应：

| APP 调用 | 后端接口 | 返回 |
|---------|---------|------|
| `getMenu()` | `GET /api/menu` | 分类/菜品/套餐/活动/门店配置/推荐 |
| `previewOrder(cart)` | `POST /api/order/preview` | 算价明细（不落库） |
| `submitOrder(cart)` | `POST /api/order/submit` | 订单号 + 支付二维码 token |
| `payCallback(orderNo)` | `GET /api/order/callback` | 标记已支付 |

> 切换方式：把 APP 里 `MockApiService` 换成 `HttpApiService`（已写好），baseUrl 指向本服务即可。

---

## 五、怎么跑起来（本机步骤）

```bash
# 0) 确保 MySQL 已启动（本机用 E:/start_databases.bat 启动，root/root123456）
# 1) 进入后端目录
cd server

# 2) 装依赖（首次）
npm install

# 3) 建库 + 建表 + 灌演示数据
npx ts-node seed.ts
#    注：若 ts-node 在沙箱里调用异常，可改编译后运行：
#    node node_modules/typescript/lib/tsc.js seed.ts --outDir ./seedbuild ...
#    node ./seedbuild/seed.js

# 4) 启动后端
npm run start:dev        # 开发模式，带热重载
#    或编译后运行：npm run build && npm run start:prod

# 5) 验证
curl http://localhost:3000/api/menu
```

**已验证通过的核心接口返回（真实数据）：**
- 菜单：分类+菜品+套餐+活动一次返回 ✅
- 堂食算价（红烧肉48+双人餐59=107，八折）：实付 **85.6** ✅
- 外卖未达起送价（可乐6<20）：`freeDeliveryShort:14`（正确拦截）✅
- 下单：生成订单号 + 动态支付二维码 ✅

---

## 六、给初学者的学习顺序建议

1. 先读 `config.ts` 和 `main.ts`：知道程序从哪起、连哪个库。
2. 再读实体文件（从 `dish.entity.ts` 开始）：理解"一张表 = 一个类 + 字段装饰器"。
3. 重点啃 `pricing.service.ts`：这是业务逻辑最密集的地方，注释最详细。
4. 看 `order.controller.ts` + `order.service.ts`：理解一个 HTTP 请求从进来到落库的全过程。
5. 最后看 `app.module.ts`：理解"依赖注入"——为什么 Service 里 `constructor` 声明一下就能用 Repository。

> 💡 NestJS 的"依赖注入(DI)"是最大难点也是最大优点：你不用自己 `new` 对象，
> 在构造函数里用 `@InjectRepository(Entity)` 声明，框架自动把对应的数据库仓库塞进来。
