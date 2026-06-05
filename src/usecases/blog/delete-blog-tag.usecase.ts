// src/usecases/blog/delete-blog-tag.usecase.ts
// 删除标签用例：校验标签下是否有文章 → 软删除标签
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验和文章关联校验由 BlogTagService.assertHasNoPostLinks 内部完成

import { Inject, Injectable } from '@nestjs/common';
import { BlogTagService } from '@src/modules/blog/blog-tag.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface DeleteBlogTagResult {
  readonly deleted: boolean;
}

@Injectable()
export class DeleteBlogTagUsecase {
  constructor(
    private readonly tagService: BlogTagService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<DeleteBlogTagResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // assertHasNoPostLinks 内部校验存在性和文章关联，不存在时抛 TAG_NOT_FOUND，有文章时抛 TAG_HAS_POSTS
      await this.tagService.assertHasNoPostLinks(id, transactionContext);

      // softDeleteTag 内部校验存在性，不存在时抛 DomainError(TAG_NOT_FOUND)
      await this.tagService.softDeleteTag(id, transactionContext);

      return { deleted: true };
    });
  }
}
