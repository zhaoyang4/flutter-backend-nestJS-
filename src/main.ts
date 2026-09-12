import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors(); // V1.0 允许 APP 跨域访问
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  // 静态托管上传目录：/uploads/xxx.png 可直接访问（生产环境用 Nginx 替代此行）
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });
  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`🚀 点餐系统后端已启动: http://localhost:${config.port}`);
}
bootstrap();
