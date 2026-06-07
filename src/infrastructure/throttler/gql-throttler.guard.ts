// src/infrastructure/throttler/gql-throttler.guard.ts
// GraphQL 兼容的 ThrottlerGuard：从 GQL context 或 HTTP request 中提取客户端标识作为限流维度
// 优先使用已认证用户的 sub（Token 维度），回退到 IP 维度

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import type { JwtPayload } from '@app-types/jwt.types';

/** GQL context 的结构化类型，用于在方法体内安全访问属性 */
interface GqlContext {
  req: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    connection?: { remoteAddress?: string };
    user?: JwtPayload;
    res?: unknown;
  };
  res?: unknown;
}

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  // 基类 ThrottlerGuard.getTracker 签名要求 Record<string, any>，无法避免
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected override getTracker(req: Record<string, any>): Promise<string> {
    // Token 维度：已认证用户优先使用 user.sub 作为限流标识
    const user = req.user as JwtPayload | undefined;
    if (user?.sub) {
      return Promise.resolve(`user:${user.sub}`);
    }

    // IP 维度：优先使用 X-Forwarded-For（反向代理场景），回退到 remoteAddress
    const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
    const forwarded = headers?.['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : '';

    const conn = req.connection as { remoteAddress?: string } | undefined;
    return Promise.resolve(
      ip || conn?.remoteAddress || (req.ip as string | undefined) || 'unknown',
    );
  }

  // 基类 ThrottlerGuard.getRequestResponse 返回 { req: Record<string, any>; res: Record<string, any> }
  protected override getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext<GqlContext>();
    const gqlReq = ctx.req;

    if (gqlReq) {
      // 基类返回类型要求 Record<string, any>，res 来源为 unknown 需断言
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { req: gqlReq, res: (gqlReq.res ?? ctx.res) as Record<string, any> };
    }

    // Fallback: HTTP context — switchToHttp.getRequest/getResponse 返回 any
    const httpCtx = context.switchToHttp();
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      req: httpCtx.getRequest(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      res: httpCtx.getResponse(),
    };
  }
}
