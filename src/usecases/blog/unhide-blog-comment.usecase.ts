// src/usecases/blog/unhide-blog-comment.usecase.ts
// 取消隐藏评论用例：设置 isHidden = false，恢复评论可见性
// 单聚合写入（评论），持有事务边界

import { Inject, Injectable } from '@nestjs/common';
import type { BlogCommentView } from '@src/modules/blog/blog.types';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface UnhideBlogCommentResult {
  readonly comment: BlogCommentView;
}

@Injectable()
export class UnhideBlogCommentUsecase {
  constructor(
    private readonly commentService: BlogCommentService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<UnhideBlogCommentResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      const view = await this.commentService.unhideComment(id, transactionContext);
      return { comment: view };
    });
  }
}
