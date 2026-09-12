import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 图片上传接口（对应需求「图片上传走前后端」与 ROADMAP #7）。
 *
 * 路由：POST /api/upload   multipart/form-data，字段名 file
 * 校验：类型 jpg / jpeg / png / webp，大小 ≤ 2MB
 * 落盘：server/uploads/，返回 { "url": "/uploads/xxx.png" }
 * 访问：main.ts 已用 useStaticAssets 把 /uploads 静态直出（生产用 Nginx 替代）
 *
 * 说明：FileInterceptor 默认用「内存存储」，文件内容在 file.buffer 里，
 * 我们手动写到 uploads 目录即可。V1.0 单文件、≤2MB，内存占用可忽略。
 */
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
// 扩展名白名单（当 mimetype 缺失或不可信时，用扩展名兜底）
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/** 从文件名取小写扩展名（含点号），如 ".PNG" → ".png" */
function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

@Controller('api')
export class UploadController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      fileFilter: (req, file, cb) => {
        // 优先用 MIME 类型判断；如果 MIME 不在白名单里，再用扩展名兜底
        // （某些 Windows 环境下 mimetype 可能缺失或不对，扩展名更可靠）
        const ext = extOf(file.originalname);
        if (ALLOWED_MIME.includes(file.mimetype) || ALLOWED_EXT.has(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('仅支持 jpg / png / webp 格式'), false);
        }
      },
    }),
  )
  upload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('未收到文件');
    const ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
    const name = `dish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), file.buffer);
    return { url: `/uploads/${name}` };
  }
}
