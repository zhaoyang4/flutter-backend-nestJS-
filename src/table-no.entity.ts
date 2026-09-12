import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type TableStatus = 'free' | 'occupied';

/**
 * 桌号表（对应需求「三、堂食核心模块——桌号管理」）。
 *
 * 桌号是堂食业务的入口：顾客扫码 → 绑定桌号 → 该桌点餐。
 * 每桌贴一张静态二维码（二维码内容就是桌号或桌号ID），顾客扫了即开单。
 *
 * status 状态机：
 *   - 'free'    空闲：可扫码开单；
 *   - 'occupied'已开单：该桌已有人点餐，再次扫码应进入已有点餐会话（V1.0 简化为直接点餐）。
 *
 * qrCode 存二维码的「内容字符串」（不是图片本身）。生成图片是前端/打印端的事，
 * 后端只负责提供这串内容，例如 "TABLE:12"，门店打印时把它变成二维码贴桌上。
 */
@Entity('table_no')
export class TableNo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20, unique: true })
  tableNo: string; // 桌号文本，如 "12" 或 "A03"

  @Column({ default: 'free' })
  status: TableStatus; // free 空闲 / occupied 已开单

  @Column({ nullable: true, length: 255 })
  qrCode: string; // 二维码内容（如 "TABLE:12"），供打印贴桌

  @Column({ default: 0 })
  sort: number; // 排序用
}
