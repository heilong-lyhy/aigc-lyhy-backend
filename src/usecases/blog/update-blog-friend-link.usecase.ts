// src/usecases/blog/update-blog-friend-link.usecase.ts
// 更新友情链接用例：持有事务边界，通过 TransactionRunner 开启事务

import { Inject, Injectable } from '@nestjs/common';
import type { UpdateBlogFriendLinkInput, BlogFriendLinkView } from '@modules/blog/blog.types';
import { BlogFriendLinkService } from '@modules/blog/blog-friend-link.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface UpdateBlogFriendLinkResult {
  readonly friendLink: BlogFriendLinkView;
}

@Injectable()
export class UpdateBlogFriendLinkUsecase {
  constructor(
    private readonly friendLinkService: BlogFriendLinkService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: UpdateBlogFriendLinkInput): Promise<UpdateBlogFriendLinkResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      const { id, ...updateData } = input;
      const friendLink = await this.friendLinkService.updateFriendLink(
        id,
        updateData,
        transactionContext,
      );
      return { friendLink };
    });
  }
}
