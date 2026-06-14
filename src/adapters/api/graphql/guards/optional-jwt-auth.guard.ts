// src/adapters/api/graphql/guards/optional-jwt-auth.guard.ts
// 可选 JWT 认证守卫：请求未携带 token 时放行，携带有效 token 时注入用户信息
// 用于公开接口需要区分已登录/未登录用户的场景（如点赞）
// 注意：携带无效 token（过期/伪造）时仍抛出认证错误，因为用户意图以登录身份操作

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * 可选 JWT 认证守卫
 * - 未携带 token：放行，不设置 req.user
 * - 携带有效 token：注入 req.user
 * - 携带无效 token（过期/伪造）：抛出认证错误
 * 适用于需要保持公开访问但希望识别已登录用户的接口
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor() {
    super();
  }

  getRequest(context: ExecutionContext): Request {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest();
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const graphqlContext = gqlCtx.getContext<{ req: Request }>();
    return graphqlContext.req;
  }

  /**
   * 处理认证结果：
   * - 无 token（err 为 null, user 为 false）：放行，返回 null
   * - 有效 token（err 为 null, user 存在）：返回用户信息
   * - 无效 token（err 存在）：抛出认证错误
   */
  handleRequest<TUser = unknown>(err: Error | null, user: TUser | false): TUser | null {
    // 无效 token：用户意图以登录身份操作，应告知认证失败
    if (err) {
      throw err;
    }
    // 无 token 或认证成功
    return user || null;
  }
}
