// src/usecases/blog/create-blog-post.usecase.ts
// 创建文章用例：slug 唯一性校验 → 创建文章 + 同步标签关联
// 持有事务边界，通过 TransactionRunner 开启事务
// 通过 BlogPostService（聚合根入口）编排子实体写入，不直接调 BlogPostTagService

import { Inject, Injectable } from '@nestjs/common';
import type { CreateBlogPostInput } from '@modules/blog/blog.types';
import { BlogPostService } from '@modules/blog/blog-post.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';
import type { BlogPostWriteResult } from './blog.types';

@Injectable()
export class CreateBlogPostUsecase {
  constructor(
    private readonly postService: BlogPostService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: CreateBlogPostInput): Promise<BlogPostWriteResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      await this.postService.assertSlugUnique(input.slug, undefined, transactionContext);

      // createPostWithTags 内部完成创建 + 存在性校验
      const view = await this.postService.createPostWithTags(input, transactionContext);

      return { post: view };
    });
  }
}
