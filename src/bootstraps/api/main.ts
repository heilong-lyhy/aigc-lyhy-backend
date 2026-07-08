// src/bootstraps/api/main.ts
import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { useContainer } from 'class-validator';
import cors from 'cors'; // [KEPT:业务保留] - 使用 cors 中间件而非 app.enableCors
import type { Express } from 'express';
import helmet from 'helmet'; // [KEPT:业务保留] - 业务需要 Helmet 安全头
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

  // 获取 ConfigService 实例（提前获取，供 Helmet、graphql-upload、CORS 等统一使用）
  const configService = app.get<ConfigService>(ConfigService);

  // 全局启用 CORS（必须在所有中间件之前注册，确保 Apollo Server /graphql 路由也受 CORS 保护）
  const corsEnabled = configService.get<boolean>('server.cors.enabled', true);
  if (corsEnabled) {
    const originsStr = configService.get<string>('server.cors.origins', '');
    const origins = originsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    app.use(
      cors({
        origin: (origin, callback) => {
          // 允许无 Origin 的请求（如服务端调用、curl 等）
          if (!origin) return callback(null, true);
          if (origins.includes(origin)) return callback(null, true);
          callback(null, false);
        },
        credentials: configService.get<boolean>('server.cors.credentials', true),
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Content-Length', 'ETag'],
        maxAge: 600,
      }),
    );
  }

  // 安全头：Helmet 中间件（CSP 需兼容 GraphQL Playground，按环境调整） // [KEPT:业务保留]
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isDev = nodeEnv !== 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isDev
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
            },
          },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 隐匿技术栈：移除 Express 默认的 X-Powered-By 响应头
  const expressApp = app.getHttpAdapter().getInstance() as unknown as Express;
  expressApp.disable('x-powered-by');

  // 启用 GraphQL 文件上传中间件（graphql-upload v17 ESM-only，使用动态导入） // [KEPT:业务保留]
  const logger = app.get(Logger);
  try {
    const mod = await import('graphql-upload/graphqlUploadExpress.mjs');
    const maxFileSize = configService.get<number>('blogStorage.maxFileSize', 10 * 1024 * 1024);
    app.use(mod.default({ maxFileSize, maxFiles: 1 }));
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.warn(
      `graphql-upload 中间件加载失败，文件上传 mutation 将不可用: ${reason}` +
        (stack ? `\n${stack}` : ''),
    );
  }

  // 启用 class-validator 的依赖注入支持
  useContainer(app.select(ApiModule), { fallbackOnErrors: true });

  // 从配置服务中获取服务器配置
  const host = configService.get<string>('server.host', '127.0.0.1');
  const port = configService.get<number>('server.port', 3000);

  await app.listen(port, host);

  // 使用 PinoLogger 记录服务器启动信息
  logger.log(`🚀 NestJS 服务在 http://${host}:${port} 上以 ${nodeEnv} 模式启动成功`);
}

void bootstrap();
