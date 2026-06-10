// src/usecases/blog/toggle-blog-post-like.usecase.ts
// 点赞/取消点赞用例：编排 BlogLike 聚合根写入 + BlogPost 聚合根 likeCount 变更
// 持有事务边界，通过 TransactionRunner 开启事务
// 返回点赞结果和当前点赞数

import { Inject, Injectable } from '@nestjs/common';
import { BlogLikeService } from '@modules/blog/blog-like.service';
import { BlogPostService } from '@modules/blog/blog-post.service';
import { BlogPostQueryService } from '@modules/blog/queries/blog-post.query.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface ToggleBlogPostLikeResult {
  readonly liked: boolean;
  readonly likeCount: number;
}

@Injectable()
export class ToggleBlogPostLikeUsecase {
  constructor(
    private readonly likeService: BlogLikeService,
    private readonly postService: BlogPostService,
    private readonly postQueryService: BlogPostQueryService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(postId: number, userIdentifier: string): Promise<ToggleBlogPostLikeResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      const { liked } = await this.likeService.toggleLike(
        postId,
        userIdentifier,
        transactionContext,
      );

      if (liked) {
        await this.postService.incrementLikeCount(postId, transactionContext);
      } else {
        await this.postService.decrementLikeCount(postId, transactionContext);
      }

      // 写后读：轻量获取当前点赞数，避免 findPostById 触发 buildDetailView 的 N+1
      const likeCount = await this.postQueryService.getLikeCount(postId, transactionContext);

      return { liked, likeCount };
    });
  }
}
