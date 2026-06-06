// src/usecases/blog/update-blog-profile.usecase.ts
// 博主信息更新用例：编排 BlogProfile 聚合根更新
// BlogProfileService 内部完成存在性校验 + 字段更新
// 持有事务边界

import { Inject, Injectable } from '@nestjs/common';
import { BlogProfileService } from '@src/modules/blog/blog-profile.service';
import type { BlogProfileView, UpdateBlogProfileInput } from '@src/modules/blog/blog.types';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface UpdateBlogProfileResult {
  readonly profile: BlogProfileView;
}

@Injectable()
export class UpdateBlogProfileUsecase {
  constructor(
    private readonly profileService: BlogProfileService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number, input: UpdateBlogProfileInput): Promise<UpdateBlogProfileResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // BlogProfileService.updateProfile 内部完成：
      // 1. 存在性校验（不存在时抛 PROFILE_NOT_FOUND）
      // 2. 字段更新 + 写后读
      const profile = await this.profileService.updateProfile(id, input, transactionContext);

      return { profile };
    });
  }
}
