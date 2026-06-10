// src/usecases/blog/delete-blog-category.usecase.ts
// 删除分类用例：校验分类下是否有文章 → 软删除分类
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验和文章关联校验由 BlogCategoryService.assertHasNoPosts 内部完成

import { Inject, Injectable } from '@nestjs/common';
import { BlogCategoryService } from '@modules/blog/blog-category.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface DeleteBlogCategoryResult {
  readonly deleted: boolean;
}

@Injectable()
export class DeleteBlogCategoryUsecase {
  constructor(
    private readonly categoryService: BlogCategoryService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<DeleteBlogCategoryResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // assertHasNoPosts 内部校验存在性和文章关联，不存在时抛 CATEGORY_NOT_FOUND，有文章时抛 CATEGORY_HAS_POSTS
      await this.categoryService.assertHasNoPosts(id, transactionContext);

      // softDeleteCategory 内部校验存在性，不存在时抛 DomainError(CATEGORY_NOT_FOUND)
      await this.categoryService.softDeleteCategory(id, transactionContext);

      return { deleted: true };
    });
  }
}
