// src/adapters/api/graphql/blog/blog-like.resolver.ts
// 点赞 GraphQL Resolver：输入解析、权限接入与输出封装

import { JwtPayload } from '@app-types/jwt.types';
import { UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { ToggleBlogPostLikeUsecase } from '@usecases/blog/toggle-blog-post-like.usecase';
import { HasLikedBlogPostUsecase } from '@usecases/blog/blog-read.usecase';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';

interface GraphQLContext {
  req: { user?: JwtPayload };
}

@Resolver()
export class BlogLikeResolver {
  constructor(
    private readonly toggleBlogPostLikeUsecase: ToggleBlogPostLikeUsecase,
    private readonly hasLikedBlogPostUsecase: HasLikedBlogPostUsecase,
  ) {}

  // ─── 公开 Mutation（可选认证：已登录用户使用 JWT accountId 作为标识） ───

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ publicWrite: { limit: 10, ttl: 60_000 } })
  @Mutation(() => Boolean, { description: '点赞/取消点赞文章' })
  async toggleBlogPostLike(
    @Args('postId', { type: () => Int, description: '文章 ID' }) postId: number,
    @Args('userIdentifier', { type: () => String, description: '用户标识（IP 或用户 ID）' })
    userIdentifier: string,
    @Context() context: GraphQLContext,
  ): Promise<boolean> {
    const effectiveIdentifier = this.resolveUserIdentifier(context, userIdentifier);
    const { liked } = await this.toggleBlogPostLikeUsecase.execute(postId, effectiveIdentifier);
    return liked;
  }

  // ─── 公开查询（可选认证） ───

  @UseGuards(OptionalJwtAuthGuard)
  @Query(() => Boolean, { description: '判断用户是否已对文章点赞' })
  async hasLikedBlogPost(
    @Args('postId', { type: () => Int, description: '文章 ID' }) postId: number,
    @Args('userIdentifier', { type: () => String, description: '用户标识' })
    userIdentifier: string,
    @Context() context: GraphQLContext,
  ): Promise<boolean> {
    const effectiveIdentifier = this.resolveUserIdentifier(context, userIdentifier);
    return this.hasLikedBlogPostUsecase.execute(postId, effectiveIdentifier);
  }

  /**
   * 从 GraphQL context 中提取用户标识
   * 已登录用户使用 user:{accountId}，未登录用户使用前端传的 userIdentifier
   */
  private resolveUserIdentifier(context: GraphQLContext, fallback: string): string {
    const user = context.req?.user;
    if (user?.sub) {
      return `user:${user.sub}`;
    }
    return fallback;
  }
}
