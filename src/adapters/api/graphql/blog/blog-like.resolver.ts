// src/adapters/api/graphql/blog/blog-like.resolver.ts
// 点赞 GraphQL Resolver：输入解析、权限接入与输出封装

import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ToggleBlogPostLikeUsecase } from '@src/usecases/blog/toggle-blog-post-like.usecase';
import { HasLikedBlogPostUsecase } from '@src/usecases/blog/blog-read.usecase';

@Resolver()
export class BlogLikeResolver {
  constructor(
    private readonly toggleBlogPostLikeUsecase: ToggleBlogPostLikeUsecase,
    private readonly hasLikedBlogPostUsecase: HasLikedBlogPostUsecase,
  ) {}

  @Mutation(() => Boolean, { description: '点赞/取消点赞文章' })
  async toggleBlogPostLike(
    @Args('postId', { type: () => Int, description: '文章 ID' }) postId: number,
    @Args('userIdentifier', { type: () => String, description: '用户标识（IP 或用户 ID）' })
    userIdentifier: string,
  ): Promise<boolean> {
    const { liked } = await this.toggleBlogPostLikeUsecase.execute(postId, userIdentifier);
    return liked;
  }

  @Query(() => Boolean, { description: '判断用户是否已对文章点赞' })
  async hasLikedBlogPost(
    @Args('postId', { type: () => Int, description: '文章 ID' }) postId: number,
    @Args('userIdentifier', { type: () => String, description: '用户标识' })
    userIdentifier: string,
  ): Promise<boolean> {
    return this.hasLikedBlogPostUsecase.execute(postId, userIdentifier);
  }
}
