// src/usecases/blog/update-blog-category.usecase.ts
// 更新分类用例：slug 唯一性校验（排除自身）→ parentId 存在性校验 → parentId 循环引用校验 → 更新分类
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验由 BlogCategoryService.updateCategory 内部完成，usecase 不重复校验

import { Inject, Injectable } from '@nestjs/common';
import type { UpdateBlogCategoryInput, BlogCategoryView } from '@modules/blog/blog.types';
import { BlogCategoryService } from '@modules/blog/blog-category.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface UpdateBlogCategoryResult {
  readonly category: BlogCategoryView;
}

@Injectable()
export class UpdateBlogCategoryUsecase {
  constructor(
    private readonly categoryService: BlogCategoryService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number, input: UpdateBlogCategoryInput): Promise<UpdateBlogCategoryResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      if (input.slug !== undefined) {
        await this.categoryService.assertSlugUnique(input.slug, id, transactionContext);
      }

      if (input.parentId !== undefined) {
        await this.categoryService.assertParentExists(input.parentId, transactionContext);
        // assertNoCircularParent 内部处理 null/undefined，直接传入即可
        await this.categoryService.assertNoCircularParent(id, input.parentId, transactionContext);
      }

      // updateCategory 内部校验存在性，不存在时抛 DomainError(CATEGORY_NOT_FOUND)
      const view = await this.categoryService.updateCategory(id, input, transactionContext);

      return { category: view };
    });
  }
}
