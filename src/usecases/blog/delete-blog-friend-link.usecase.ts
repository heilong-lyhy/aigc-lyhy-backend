// src/usecases/blog/delete-blog-friend-link.usecase.ts
// 删除友情链接用例：持有事务边界，通过 TransactionRunner 开启事务

import { Inject, Injectable } from '@nestjs/common';
import { BlogFriendLinkService } from '@src/modules/blog/blog-friend-link.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface DeleteBlogFriendLinkResult {
  readonly deleted: boolean;
}

@Injectable()
export class DeleteBlogFriendLinkUsecase {
  constructor(
    private readonly friendLinkService: BlogFriendLinkService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<DeleteBlogFriendLinkResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      await this.friendLinkService.softDeleteFriendLink(id, transactionContext);
      return { deleted: true };
    });
  }
}
