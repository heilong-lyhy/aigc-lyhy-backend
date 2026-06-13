// src/infrastructure/throttler/throttler.module.ts
// 速率限制模块：基于 IP / Token 维度限流，使用内存存储
// 当前全局限流已关闭（未注册 APP_GUARD），如需恢复请重新引入 GqlThrottlerGuard 并添加 providers

import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60_000,
        limit: 60,
      },
      {
        name: 'publicWrite',
        ttl: 60_000,
        limit: 10,
      },
    ]),
  ],
})
export class AppThrottlerModule {}
