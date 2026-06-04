// src/usecases/blog/delete-blog-post.usecase.ts
// 删除文章用例：软删除文章 → 级联处理（标记关联评论为不可见，但不硬删）
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验由 BlogPostService.softDeletePost 内部完成，usecase 不重复校验

import { Inject, Injectable } from '@nestjs/common';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface DeleteBlogPostResult {
  readonly deleted: boolean;
}

@Injectable()
export class DeleteBlogPostUsecase {
  constructor(
    private readonly postService: BlogPostService,
    private readonly commentService: BlogCommentService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<DeleteBlogPostResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // 级联处理：标记关联评论为不可见（SPAM），但不硬删
      await this.commentService.markCommentsHiddenByPostId(id, transactionContext);

      // softDeletePost 内部校验存在性，不存在时抛 DomainError(POST_NOT_FOUND)
      await this.postService.softDeletePost(id, transactionContext);

      return { deleted: true };
    });
  }
}
