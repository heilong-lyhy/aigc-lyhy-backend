// src/usecases/blog/update-blog-comment-status.usecase.ts
// 更新评论审核状态用例：评论存在性校验 → 更新审核状态
// 单聚合写入（评论），持有事务边界
// 存在性校验由 BlogCommentService.updateCommentStatus 内部完成

import { Inject, Injectable } from '@nestjs/common';
import type { UpdateBlogCommentStatusInput, BlogCommentView } from '@modules/blog/blog.types';
import { BlogCommentService } from '@modules/blog/blog-comment.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface UpdateBlogCommentStatusResult {
  readonly comment: BlogCommentView;
}

@Injectable()
export class UpdateBlogCommentStatusUsecase {
  constructor(
    private readonly commentService: BlogCommentService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: UpdateBlogCommentStatusInput): Promise<UpdateBlogCommentStatusResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // updateCommentStatus 内部校验存在性，不存在时抛 DomainError(COMMENT_NOT_FOUND)
      const view = await this.commentService.updateCommentStatus(input, transactionContext);

      return { comment: view };
    });
  }
}
