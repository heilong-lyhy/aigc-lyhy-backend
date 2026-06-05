// src/usecases/blog/delete-blog-comment.usecase.ts
// 删除评论用例：软删除评论 → 更新文章评论计数
// 跨聚合写入（评论 + 文章计数更新），由 Usecase 持有事务边界
// 存在性校验由 BlogCommentService.softDeleteComment 内部完成，返回 postId 供计数更新

import { Inject, Injectable } from '@nestjs/common';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface DeleteBlogCommentResult {
  readonly deleted: boolean;
}

@Injectable()
export class DeleteBlogCommentUsecase {
  constructor(
    private readonly commentService: BlogCommentService,
    private readonly postService: BlogPostService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<DeleteBlogCommentResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // softDeleteComment 内部校验存在性，不存在时抛 DomainError(COMMENT_NOT_FOUND)
      // 返回被删除评论的 postId，供跨聚合计数更新使用
      const postId = await this.commentService.softDeleteComment(id, transactionContext);

      // 跨聚合：更新文章评论计数
      await this.postService.decrementCommentCount(postId, transactionContext);

      return { deleted: true };
    });
  }
}
