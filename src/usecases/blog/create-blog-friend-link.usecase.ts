// src/usecases/blog/create-blog-friend-link.usecase.ts
// 创建友情链接用例：持有事务边界，通过 TransactionRunner 开启事务

import { Inject, Injectable } from '@nestjs/common';
import type { CreateBlogFriendLinkInput, BlogFriendLinkView } from '@modules/blog/blog.types';
import { BlogFriendLinkService } from '@modules/blog/blog-friend-link.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface CreateBlogFriendLinkResult {
  readonly friendLink: BlogFriendLinkView;
}

@Injectable()
export class CreateBlogFriendLinkUsecase {
  constructor(
    private readonly friendLinkService: BlogFriendLinkService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: CreateBlogFriendLinkInput): Promise<CreateBlogFriendLinkResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      const friendLink = await this.friendLinkService.createFriendLink(input, transactionContext);
      return { friendLink };
    });
  }
}
