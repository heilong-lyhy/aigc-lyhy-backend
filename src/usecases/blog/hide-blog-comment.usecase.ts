// src/usecases/blog/hide-blog-comment.usecase.ts
// 隐藏评论用例：设置 isHidden = true，违规下架但保留记录
// 单聚合写入（评论），持有事务边界

import { Inject, Injectable } from '@nestjs/common';
import type { BlogCommentView } from '@src/modules/blog/blog.types';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface HideBlogCommentResult {
  readonly comment: BlogCommentView;
}

@Injectable()
export class HideBlogCommentUsecase {
  constructor(
    private readonly commentService: BlogCommentService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<HideBlogCommentResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      const view = await this.commentService.hideComment(id, transactionContext);
      return { comment: view };
    });
  }
}
