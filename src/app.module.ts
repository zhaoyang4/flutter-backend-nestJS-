import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './config';

import { Category } from './category.entity';
import { Dish } from './dish.entity';
import { Combo } from './combo.entity';
import { ComboItem } from './combo-item.entity';
import { Activity } from './activity.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { TableNo } from './table-no.entity';
import { StoreConfig } from './store-config.entity';
import { AdminAccount } from './admin-account.entity';
import { RegisteredUser } from './registered_user.entity';

import { MenuService } from './menu.service';
import { PricingService } from './pricing.service';
import { OrderService } from './order.service';
import { PayService } from './pay.service';
import { AuthService } from './auth.service';
import { ManageService } from './manage.service';
import { UserService } from './user.service';

import { MenuController } from './menu.controller';
import { OrderController } from './order.controller';
import { TableController } from './table.controller';
import { PayController } from './pay.controller';
import { StoreController } from './store.controller';
import { OrdersController } from './orders.controller';
import { AuthController } from './auth.controller';
import { ManageController } from './manage.controller';
import { UploadController } from './upload.controller';
import { UserController } from './user.controller';

/**
 * 应用根模块：NestJS 的「装配中心」。
 *
 * 两部分职责：
 * 1) TypeOrmModule.forRoot：全局数据库连接配置（MySQL）。
 *    - synchronize: true 表示启动时按实体自动建表（含字段）。
 *      ⚠️ 仅适合 V1.0 开发/快速上线；生产环境应改为迁移(migration)管理表结构。
 *    - autoLoadEntities: true 让下面 forFeature 注册的实体自动纳入连接。
 * 2) 注册所有业务模块：Service（逻辑）+ Controller（接口）。
 *
 * 依赖注入（DI）小贴士：
 *   我们在各 Service 的 constructor 里用 @InjectRepository 声明要用的实体仓库，
 *   NestJS 启动时会自动把对应的 Repository 实例注入进来，业务代码直接 this.xxxRepo 即可用。
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: config.db.host,
      port: config.db.port,
      username: config.db.username,
      password: config.db.password,
      database: config.db.database,
      charset: 'utf8mb4',
      synchronize: true, // V1.0 快速建表；生产请改用 migration
      autoLoadEntities: true,
      entities: [
        Category,
        Dish,
        Combo,
        ComboItem,
        Activity,
        Order,
        OrderItem,
        TableNo,
        StoreConfig,
        AdminAccount,
        RegisteredUser,
      ],
    }),
    TypeOrmModule.forFeature([
      Category,
      Dish,
      Combo,
      ComboItem,
      Activity,
      Order,
      OrderItem,
      TableNo,
      StoreConfig,
      AdminAccount,
      RegisteredUser,
    ]),
  ],
  controllers: [
    MenuController,
    OrderController,
    TableController,
    PayController,
    StoreController,
    OrdersController,
    AuthController,
    ManageController,
    UploadController,
    UserController,
  ],
  providers: [
    MenuService,
    PricingService,
    OrderService,
    PayService,
    AuthService,
    ManageService,
    UserService,
  ],
})
export class AppModule {}
