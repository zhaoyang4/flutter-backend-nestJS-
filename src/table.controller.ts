import {
  Controller,
  Get,
  Param,
  Post,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableNo } from './table-no.entity';

/**
 * 桌号接口（对应需求「三、堂食——桌号管理/扫码开单」）。
 *
 * 路由：
 *   GET  /api/tables              列出所有桌号（收银端管理用）
 *   GET  /api/tables/:no/bind     顾客扫码：绑定桌号，返回该桌是否可点餐
 *   POST /api/tables/:no/open     标记该桌为「已开单」（顾客点餐开始后调用）
 *
 * 说明：桌号二维码内容是 "TABLE:<桌号>"，顾客扫到后请求 bind 即完成绑定。
 */
@Controller('api/tables')
export class TableController {
  constructor(
    @InjectRepository(TableNo)
    private tableRepo: Repository<TableNo>,
  ) {}

  /** 列出全部桌号。 */
  @Get()
  findAll() {
    return this.tableRepo.find({ order: { sort: 'ASC' } });
  }

  /** 顾客扫码绑定桌号：返回桌号信息与当前状态。 */
  @Get(':no/bind')
  async bind(@Param('no') no: string) {
    const table = await this.tableRepo.findOne({ where: { tableNo: no } });
    if (!table) throw new NotFoundException('桌号不存在');
    return {
      tableNo: table.tableNo,
      status: table.status, // free / occupied
      bindOk: true,
    };
  }

  /** 标记桌号已开单。 */
  @Post(':no/open')
  async open(@Param('no') no: string) {
    const table = await this.tableRepo.findOne({ where: { tableNo: no } });
    if (!table) throw new NotFoundException('桌号不存在');
    table.status = 'occupied';
    await this.tableRepo.save(table);
    return { ok: true, tableNo: no, status: 'occupied' };
  }
}
