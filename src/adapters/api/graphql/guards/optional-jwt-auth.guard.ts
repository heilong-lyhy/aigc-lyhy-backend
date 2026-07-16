// src/adapters/api/graphql/guards/optional-jwt-auth.guard.ts
// 可选 JWT 认证守卫：请求未携带 token 时放行，携带有效 token 时注入用户信息
// 用于公开接口需要区分已登录/未登录用户的场景（如点赞）
// 注意：携带无效 token（过期/伪造）时仍抛出认证错误，因为用户意图以登录身份操作

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
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
   * - 无 token（err 为 null, user 为 false, info 为 null）：放行，返回 null
   * - 有效 token（err 为 null, user 存在）：返回用户信息
   * - 无效 token（err 存在，或 info 表示认证失败）：抛出认证错误
   *
   * Passport 通过 info 传递 token 过期/签名错误等认证失败信息，
   * 必须检查 info 以避免将无效 token 持有者当作匿名用户放行。
   */
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    info: unknown,
  ): TUser | null {
    // 显式认证错误（err 存在）
    if (err) {
      throw new UnauthorizedException('认证失败');
    }
    // Passport 通过 info 传递的认证失败（token 过期/签名错误等）
    // 当 info 是 Error 实例或包含 name 字段（如 TokenExpiredError、JsonWebTokenError）时，
    // 表示用户携带了无效 token，应拒绝而非放行为匿名
    if (info instanceof Error) {
      throw new UnauthorizedException(`认证失败: ${info.message}`);
    }
    if (typeof info === 'object' && info !== null && 'name' in info) {
      const infoObj = info as { name: string };
      if (
        infoObj.name === 'TokenExpiredError' ||
        infoObj.name === 'JsonWebTokenError' ||
        infoObj.name === 'NotBeforeError'
      ) {
        throw new UnauthorizedException(`认证失败: ${infoObj.name}`);
      }
    }
    // 无 token 或认证成功
    return user || null;
  }
}
