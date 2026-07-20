// src/bootstraps/api/main.ts
import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { useContainer } from 'class-validator';
import type { Express, Request, Response, NextFunction } from 'express';
import { Logger } from 'nestjs-pino';
import { initGraphQLSchema } from '@src/adapters/api/graphql/schema/schema.init';
import { ApiModule } from '@src/bootstraps/api/api.module';

/**
 * 应用程序启动函数
 * 使用 NestJS ConfigService 获取配置信息
 */
async function bootstrap() {
  initGraphQLSchema();
  const app = await NestFactory.create(ApiModule);
  app.enableShutdownHooks();

  // 隐匿技术栈：移除 Express 默认的 X-Powered-By 响应头
  const expressApp = app.getHttpAdapter().getInstance() as unknown as Express;
  expressApp.disable('x-powered-by');

  const configService = app.get<ConfigService>(ConfigService);

  // 全局请求体大小限制：拦截超大 multipart/JSON 请求
  // 关键安全意义：
  // - Apollo Server 默认会在内存中缓冲整个 GraphQL upload 文件
  // - 若不限制请求体大小，攻击者上传 10GB 文件即可触发 OOM
  // - 此处以 blogStorage.maxFileSize 为基础上限，留出 5MB 余量给 multipart 元数据
  // - 适用于所有 Content-Type，包括 application/json 和 multipart/form-data
  const uploadMaxFileSize = configService.get<number>('blogStorage.maxFileSize', 10 * 1024 * 1024);
  const maxRequestBodyBytes = uploadMaxFileSize + 5 * 1024 * 1024;
  expressApp.use((req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    if (contentLength > maxRequestBodyBytes) {
      res.status(413).json({ errors: [{ message: '请求体过大' }] });
      return;
    }
    next();
  });

  // 启用 class-validator 的依赖注入支持
  useContainer(app.select(ApiModule), { fallbackOnErrors: true });

  // 全局启用 CORS（按配置限制来源与凭据）
  const corsEnabled = configService.get<boolean>('server.cors.enabled', true);
  if (corsEnabled) {
    const originsStr = configService.get<string>('server.cors.origins', '');
    const origins = originsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    app.enableCors({
      origin: origins.length > 0 ? origins : true,
      credentials: configService.get<boolean>('server.cors.credentials', true),
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'ETag'],
      maxAge: 600,
    });
  }

  // 获取 PinoLogger 实例
  const logger = app.get(Logger);

  // 从配置服务中获取服务器配置
  const host = configService.get<string>('server.host', '127.0.0.1');
  const port = configService.get<number>('server.port', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  await app.listen(port, host);

  // 使用 PinoLogger 记录服务器启动信息
  logger.log(`🚀 NestJS 服务在 http://${host}:${port} 上以 ${nodeEnv} 模式启动成功`);
}

void bootstrap();
