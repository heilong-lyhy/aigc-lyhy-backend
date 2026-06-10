// src/usecases/blog/create-blog-category.usecase.ts
// 创建分类用例：slug 唯一性校验 → parentId 存在性校验 → 创建分类
// 持有事务边界，通过 TransactionRunner 开启事务

import { Inject, Injectable } from '@nestjs/common';
import type { CreateBlogCategoryInput, BlogCategoryView } from '@modules/blog/blog.types';
import { BlogCategoryService } from '@modules/blog/blog-category.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface CreateBlogCategoryResult {
  readonly category: BlogCategoryView;
}

@Injectable()
export class CreateBlogCategoryUsecase {
  constructor(
    private readonly categoryService: BlogCategoryService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: CreateBlogCategoryInput): Promise<CreateBlogCategoryResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      await this.categoryService.assertSlugUnique(input.slug, undefined, transactionContext);
      await this.categoryService.assertParentExists(input.parentId, transactionContext);

      // createCategory 内部完成创建 + 写后读，返回非空 BlogCategoryView
      const view = await this.categoryService.createCategory(input, transactionContext);

      return { category: view };
    });
  }
}
