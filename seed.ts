/**
 * 种子数据脚本：创建数据库 + 灌入演示数据。
 *
 * 用途：第一次跑后端时，没有表也没有数据，APP 拉不到菜单。
 * 本脚本会：① 建库 order_system；② 建表（与实体一致）；③ 灌入示例分类/菜品/套餐/活动/桌号/门店配置。
 *
 * 运行方式（在 server 目录下）：
 *   npx ts-node seed.ts        （需装 ts-node；或用 npm run start 前先 node 编译版）
 * 这里用纯 mysql2 + 手写 SQL，避免依赖 TypeORM 编译链，确保一定能跑通。
 */
import mysql from 'mysql2/promise';
import { config } from './src/config';

async function main() {
  // 1) 先连到 MySQL 实例（不带具体库），建库
  const root = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
  });
  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4`,
  );
  await root.end();

  // 2) 连到目标库，开始建表 + 灌数据
  const db = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  // 3) 依次建表（IF NOT EXISTS，重复运行安全）
  await db.query(`
    CREATE TABLE IF NOT EXISTS category (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(50),
      sort INT DEFAULT 0,
      enabled INT DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS dish (
      id INT PRIMARY KEY AUTO_INCREMENT,
      categoryId INT,
      name VARCHAR(80),
      imageUrl VARCHAR(255),
      originalPrice DECIMAL(10,2),
      currentPrice DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'available',
      enabled INT DEFAULT 1,
      stock INT DEFAULT -1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS combo (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(80),
      imageUrl VARCHAR(255),
      price DECIMAL(10,2),
      participateInActivity INT DEFAULT 1,
      status VARCHAR(20) DEFAULT 'available',
      enabled INT DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS combo_item (
      id INT PRIMARY KEY AUTO_INCREMENT,
      comboId INT,
      dishId INT,
      quantity INT DEFAULT 1,
      FOREIGN KEY (comboId) REFERENCES combo(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(80),
      type VARCHAR(20) DEFAULT 'ratio',
      value DECIMAL(10,4),
      scope VARCHAR(20) DEFAULT 'all',
      applicableItems JSON,
      startDate VARCHAR(10),
      endDate VARCHAR(10),
      startTime VARCHAR(8),
      endTime VARCHAR(8),
      allowStacking INT DEFAULT 0,
      supportDineIn INT DEFAULT 1,
      supportTakeout INT DEFAULT 1,
      enabled INT DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INT PRIMARY KEY AUTO_INCREMENT,
      orderNo VARCHAR(32) UNIQUE,
      type VARCHAR(20) DEFAULT 'dine_in',
      tableNo VARCHAR(20),
      customerName VARCHAR(50),
      phone VARCHAR(20),
      address VARCHAR(255),
      remark VARCHAR(255),
      originalAmount DECIMAL(10,2) DEFAULT 0,
      discountAmount DECIMAL(10,2) DEFAULT 0,
      deliveryFee DECIMAL(10,2) DEFAULT 0,
      payableAmount DECIMAL(10,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      payMethod VARCHAR(10),
      paidAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      payUrl VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS order_item (
      id INT PRIMARY KEY AUTO_INCREMENT,
      orderId INT,
      itemType VARCHAR(20) DEFAULT 'dish',
      refId INT,
      name VARCHAR(80),
      unitPrice DECIMAL(10,2),
      activityPrice DECIMAL(10,2),
      quantity INT DEFAULT 1,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS table_no (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tableNo VARCHAR(20) UNIQUE,
      status VARCHAR(20) DEFAULT 'free',
      qrCode VARCHAR(255),
      sort INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS store_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      shopName VARCHAR(80) DEFAULT '我的小店',
      address VARCHAR(255),
      phone VARCHAR(20),
      minOrderAmount DECIMAL(10,2) DEFAULT 0,
      deliveryFee DECIMAL(10,2) DEFAULT 0,
      wechatAppId VARCHAR(64),
      wechatMchId VARCHAR(64),
      wechatApiKey VARCHAR(255),
      alipayAppId VARCHAR(64),
      alipayPrivateKey VARCHAR(512)
    );
  `);
  console.log('✅ 建表完成');

  // 4) 灌入演示数据（先清后插，保证可重复运行）
  await db.query('DELETE FROM combo_item; DELETE FROM combo; DELETE FROM dish; DELETE FROM category; DELETE FROM activity; DELETE FROM table_no; DELETE FROM store_config;');

  await db.query(
    `INSERT INTO category (id, name, sort) VALUES (1,'热菜',1),(2,'饮品',2),(3,'套餐',3);`,
  );
  await db.query(
    `INSERT INTO dish (id, categoryId, name, imageUrl, originalPrice, currentPrice, status, enabled, stock) VALUES
      (1,1,'红烧肉','',48.00,48.00,'available',1,-1),
      (2,1,'宫保鸡丁','',32.00,32.00,'available',1,-1),
      (3,2,'可乐','',6.00,6.00,'available',1,-1),
      (4,2,'鲜榨橙汁','',12.00,12.00,'available',1,-1);`,
  );
  await db.query(
    `INSERT INTO combo (id, name, imageUrl, price, participateInActivity, status, enabled) VALUES
      (1,'双人餐A', '', 59.00, 1, 'available', 1);`,
  );
  await db.query(
    `INSERT INTO combo_item (comboId, dishId, quantity) VALUES (1,1,1),(1,3,2);`,
  );
  await db.query(
    `INSERT INTO activity (id, name, type, value, scope, allowStacking, supportDineIn, supportTakeout, enabled, startTime, endTime) VALUES
      (1,'全场八折','ratio',0.8,'all',0,1,1,1,'00:00:00','23:59:59'),
      (2,'可乐特价','fixed',3.00,'selected',0,1,1,1,'00:00:00','23:59:59');`,
  ); // applicableItems 由下面 update 补
  await db.query(
    `UPDATE activity SET applicableItems = '[3]' WHERE id = 2;`,
  );
  await db.query(
    `INSERT INTO table_no (tableNo, status, qrCode, sort) VALUES
      ('A01','free','TABLE:A01',1),('A02','free','TABLE:A02',2),('B01','occupied','TABLE:B01',3);`,
  );
  await db.query(
    `INSERT INTO store_config (id, shopName, address, phone, minOrderAmount, deliveryFee) VALUES
      (1,'小蓝餐厅','幸福路 1 号','13800000000',20.00,5.00);`,
  );
  console.log('✅ 演示数据已灌入');

  await db.end();
  console.log('🎉 种子完成，可启动后端：npm run start:dev');
}

main().catch((e) => {
  console.error('种子失败：', e.message);
  process.exit(1);
});
