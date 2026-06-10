// src/usecases/blog/update-blog-post.usecase.ts
// 更新文章用例：slug 唯一性校验 → 更新文章 + 同步标签关联
// 持有事务边界，通过 TransactionRunner 开启事务
// 通过 BlogPostService（聚合根入口）编排子实体写入，不直接调 BlogPostTagService

import { Inject, Injectable } from '@nestjs/common';
import type { UpdateBlogPostInput } from '@modules/blog/blog.types';
import { BlogPostService } from '@modules/blog/blog-post.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';
import type { BlogPostWriteResult } from './blog.types';

@Injectable()
export class UpdateBlogPostUsecase {
  constructor(
    private readonly postService: BlogPostService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number, input: UpdateBlogPostInput): Promise<BlogPostWriteResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      if (input.slug !== undefined) {
        await this.postService.assertSlugUnique(input.slug, id, transactionContext);
      }

      // updatePostWithTags 内部已有存在性校验 + 写后读，无需 usecase 重复校验/读取
      const view = await this.postService.updatePostWithTags(id, input, transactionContext);

      return { post: view };
    });
  }
}
