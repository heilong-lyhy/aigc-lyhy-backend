// src/usecases/blog/create-blog-tag.usecase.ts
// 创建标签用例：slug 唯一性校验 → 创建标签
// 持有事务边界，通过 TransactionRunner 开启事务

import { Inject, Injectable } from '@nestjs/common';
import type { CreateBlogTagInput, BlogTagView } from '@modules/blog/blog.types';
import { BlogTagService } from '@modules/blog/blog-tag.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface CreateBlogTagResult {
  readonly tag: BlogTagView;
}

@Injectable()
export class CreateBlogTagUsecase {
  constructor(
    private readonly tagService: BlogTagService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: CreateBlogTagInput): Promise<CreateBlogTagResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      await this.tagService.assertSlugUnique(input.slug, undefined, transactionContext);

      // createTag 内部完成创建 + 写后读，返回非空 BlogTagView
      const view = await this.tagService.createTag(input, transactionContext);

      return { tag: view };
    });
  }
}
