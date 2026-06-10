// src/usecases/blog/update-blog-tag.usecase.ts
// 更新标签用例：slug 唯一性校验（排除自身）→ 更新标签
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验由 BlogTagService.updateTag 内部完成，usecase 不重复校验

import { Inject, Injectable } from '@nestjs/common';
import type { UpdateBlogTagInput, BlogTagView } from '@modules/blog/blog.types';
import { BlogTagService } from '@modules/blog/blog-tag.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface UpdateBlogTagResult {
  readonly tag: BlogTagView;
}

@Injectable()
export class UpdateBlogTagUsecase {
  constructor(
    private readonly tagService: BlogTagService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number, input: UpdateBlogTagInput): Promise<UpdateBlogTagResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      if (input.slug !== undefined) {
        await this.tagService.assertSlugUnique(input.slug, id, transactionContext);
      }

      // updateTag 内部校验存在性，不存在时抛 DomainError(TAG_NOT_FOUND)
      const view = await this.tagService.updateTag(id, input, transactionContext);

      return { tag: view };
    });
  }
}
