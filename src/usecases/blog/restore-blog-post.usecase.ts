// src/usecases/blog/restore-blog-post.usecase.ts
// 恢复文章用例：从回收站恢复软删除文章
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验与状态校验由 BlogPostService.restorePost 内部完成，usecase 不重复校验
// 级联恢复：将文章删除时标记为 SPAM 的评论恢复为 PENDING 状态

import { Inject, Injectable } from '@nestjs/common';
import type { BlogPostDetailView } from '@src/modules/blog/blog.types';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface RestoreBlogPostResult {
  readonly post: BlogPostDetailView;
}

@Injectable()
export class RestoreBlogPostUsecase {
  constructor(
    private readonly postService: BlogPostService,
    private readonly commentService: BlogCommentService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<RestoreBlogPostResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // 级联恢复：将删除时标记为 SPAM 的评论恢复为 PENDING
      await this.commentService.restoreCommentsByPostId(id, transactionContext);

      const post = await this.postService.restorePost(id, transactionContext);
      return { post };
    });
  }
}
