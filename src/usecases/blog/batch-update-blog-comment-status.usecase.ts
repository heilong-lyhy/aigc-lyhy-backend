// src/usecases/blog/batch-update-blog-comment-status.usecase.ts
// 批量审核评论状态用例：批量校验 → 批量更新审核状态
// 批量操作，不在循环中逐条 await
// 持有事务边界

import { Inject, Injectable } from '@nestjs/common';
import type { BatchUpdateBlogCommentStatusInput } from '@src/modules/blog/blog.types';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface BatchUpdateBlogCommentStatusResult {
  readonly updatedCount: number;
}

@Injectable()
export class BatchUpdateBlogCommentStatusUsecase {
  constructor(
    private readonly commentService: BlogCommentService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(
    input: BatchUpdateBlogCommentStatusInput,
  ): Promise<BatchUpdateBlogCommentStatusResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // batchUpdateCommentStatus 返回实际更新的行数
      const updatedCount = await this.commentService.batchUpdateCommentStatus(
        input,
        transactionContext,
      );

      return { updatedCount };
    });
  }
}
