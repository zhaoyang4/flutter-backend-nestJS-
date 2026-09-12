import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 门店配置表（对应需求「八、系统基础配置」）。
 *
 * 门店级配置通常只有「一条记录」（单门店，V1.0 不做多门店），用 id=1 固定读取即可。
 *
 * 字段分组：
 * 1. 门店基础信息（用于小票打印）：店名、地址、电话。
 * 2. 外卖规则（后台可配置）：minOrderAmount 起送价、deliveryFee 固定配送费。
 * 3. 支付参数（微信/支付宝）：V1.0 先把配置项预留好，接入支付时填 appId/密钥等。
 *
 * 注意：支付密钥属于敏感信息，生产环境应放环境变量或密钥管理，不要硬编码在前端。
 * 这里用 nullable 列预留，方便后续接入真实支付。
 */
@Entity('store_config')
export class StoreConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80, default: '我的小店' })
  shopName: string; // 店名（小票抬头）

  @Column({ nullable: true, length: 255 })
  address: string; // 门店地址

  @Column({ nullable: true, length: 20 })
  phone: string; // 联系电话

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  minOrderAmount: number; // 外卖起送价（未达禁止提交）

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  deliveryFee: number; // 固定配送费

  // —— 微信支付参数（V1.0 预留，接入时填写）——
  @Column({ nullable: true, length: 64 })
  wechatAppId: string;

  @Column({ nullable: true, length: 64 })
  wechatMchId: string;

  @Column({ nullable: true, length: 255 })
  wechatApiKey: string;

  // —— 支付宝支付参数（V1.0 预留）——
  @Column({ nullable: true, length: 64 })
  alipayAppId: string;

  @Column({ nullable: true, length: 512 })
  alipayPrivateKey: string;

  @Column({ default: 0 })
  enablePickupNumber: number; // 是否启用取餐号：1 启用 0 不启用（系统配置页开关控制）
}
