// src/infrastructure/throttler/throttler.module.ts
// 速率限制模块：基于 IP / Token 维度限流，使用内存存储
// 通过 APP_GUARD 全局注册 GqlThrottlerGuard，所有 HTTP/GQL 端点默认限流
// - 'short' 限流器：每分钟 60 次，覆盖所有端点
// - 'publicWrite' 限流器：每分钟 10 次，覆盖写操作（登录/注册/验证等敏感端点）
// 关键安全意义：登录/注册/验证码端点若无限流，攻击者可无限次尝试密码或爆破验证码
//
// 跳过策略：GqlThrottlerGuard.shouldSkip 在 test/e2e 环境直接返回 true，避免影响测试

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './gql-throttler.guard';

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
  providers: [
    GqlThrottlerGuard,
    {
      provide: APP_GUARD,
      useExisting: GqlThrottlerGuard,
    },
  ],
  exports: [GqlThrottlerGuard],
})
export class AppThrottlerModule {}
