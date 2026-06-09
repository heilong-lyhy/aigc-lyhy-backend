// src/usecases/blog/update-blog-profile.usecase.ts
// 博主信息更新用例：编排 BlogProfile 聚合根更新
// 博主信息为单例，usecase 内部获取 profile ID，调用方无需传入
// BlogProfileService 内部完成存在性校验 + 字段更新
// 持有事务边界

import { Inject, Injectable } from '@nestjs/common';
import { BlogProfileService } from '@src/modules/blog/blog-profile.service';
import { BlogProfileQueryService } from '@src/modules/blog/queries/blog-profile.query.service';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
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
    private readonly profileQueryService: BlogProfileQueryService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: UpdateBlogProfileInput): Promise<UpdateBlogProfileResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // 博主信息为单例，直接通过 QueryService 获取 ID
      const profile = await this.profileQueryService.getProfile(transactionContext);
      if (!profile) {
        throw new DomainError(BLOG_ERROR.PROFILE_NOT_FOUND, '博主信息不存在');
      }

      // BlogProfileService.updateProfile 内部完成：
      // 1. 存在性校验（不存在时抛 PROFILE_NOT_FOUND）
      // 2. 字段更新 + 写后读
      const updated = await this.profileService.updateProfile(
        profile.id,
        input,
        transactionContext,
      );

      return { profile: updated };
    });
  }
}
