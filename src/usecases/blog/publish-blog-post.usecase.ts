// src/usecases/blog/publish-blog-post.usecase.ts
// 发布文章用例：调用 BlogPostService.publishPost 完成状态校验 + 发布
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验和状态校验由 BlogPostService.publishPost 内部完成，usecase 不重复校验

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';
import type { BlogPostWriteResult } from './blog.types';

@Injectable()
export class PublishBlogPostUsecase {
  constructor(
    private readonly postService: BlogPostService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<BlogPostWriteResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      const view = await this.postService.publishPost(id, transactionContext);
      if (!view) {
        throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, '发布文章后未找到记录');
      }

      return { post: view };
    });
  }
}
