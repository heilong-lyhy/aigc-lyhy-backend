// src/usecases/blog/create-blog-comment.usecase.ts
// 创建评论用例：文章存在性校验 → 嵌套层级校验 → 创建评论 → 更新文章评论计数
// 跨聚合写入（评论 + 文章计数更新），由 Usecase 持有事务边界
// XSS 清洗由 BlogCommentService.createComment 内部完成

import { Inject, Injectable } from '@nestjs/common';
import type { CreateBlogCommentInput, BlogCommentView } from '@src/modules/blog/blog.types';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface CreateBlogCommentResult {
  readonly comment: BlogCommentView;
}

@Injectable()
export class CreateBlogCommentUsecase {
  constructor(
    private readonly commentService: BlogCommentService,
    private readonly postService: BlogPostService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: CreateBlogCommentInput): Promise<CreateBlogCommentResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // 文章存在性校验：通过 BlogPostService 断言，避免 usecase 直接依赖 QueryService
      await this.postService.assertPostExists(input.postId, transactionContext);

      // createComment 内部完成嵌套层级校验（parentId 存在性 + nestingLevel 上限）
      const view = await this.commentService.createComment(input, transactionContext);

      // 跨聚合：更新文章评论计数
      await this.postService.incrementCommentCount(input.postId, transactionContext);

      return { comment: view };
    });
  }
}
