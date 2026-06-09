// src/infrastructure/throttler/throttler.module.ts
// 速率限制模块：基于 IP / Token 维度限流，使用内存存储

import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { GqlThrottlerGuard } from './gql-throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // 默认限流：每 60 秒最多 60 次请求（测试环境由 GqlThrottlerGuard.shouldSkip 跳过）
        name: 'short',
        ttl: 60_000,
        limit: 60,
      },
      {
        // 公开写接口限流：每 60 秒最多 10 次（测试环境由 GqlThrottlerGuard.shouldSkip 跳过）
        name: 'publicWrite',
        ttl: 60_000,
        limit: 10,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppThrottlerModule {}
