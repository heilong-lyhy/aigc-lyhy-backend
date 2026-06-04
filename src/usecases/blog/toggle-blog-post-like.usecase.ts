// src/usecases/blog/toggle-blog-post-like.usecase.ts
// 点赞/取消点赞用例：编排 BlogLike 聚合根写入 + BlogPost 聚合根 likeCount 变更
// 持有事务边界，通过 TransactionRunner 开启事务

import { Inject, Injectable } from '@nestjs/common';
import { BlogLikeService } from '@src/modules/blog/blog-like.service';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface ToggleBlogPostLikeResult {
  readonly liked: boolean;
}

@Injectable()
export class ToggleBlogPostLikeUsecase {
  constructor(
    private readonly likeService: BlogLikeService,
    private readonly postService: BlogPostService,
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

      return { liked };
    });
  }
}
