// src/usecases/blog/change-blog-admin-password.usecase.ts
// 博客管理员密码修改用例：复用 Account 域的密码修改能力
// 编排：委托 AccountService.changePassword 完成密码修改（含策略校验、旧密码验证、哈希、更新）
// 持有事务边界
//
// 依赖说明：
// - AccountService（account 模块）：密码修改聚合根写入口，封装完整密码修改逻辑
// 不重复实现哈希策略，完全复用 Account 域已有能力

import { Inject, Injectable } from '@nestjs/common';
import { AccountService } from '@modules/account/base/services/account.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

export interface ChangeBlogAdminPasswordInput {
  readonly accountId: number;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface ChangeBlogAdminPasswordResult {
  readonly accountId: number;
}

@Injectable()
export class ChangeBlogAdminPasswordUsecase {
  constructor(
    private readonly accountService: AccountService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(input: ChangeBlogAdminPasswordInput): Promise<ChangeBlogAdminPasswordResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // 委托 AccountService.changePassword 完成密码修改核心逻辑
      // AccountService 内部完成：读取账户 → 验证旧密码 → 密码策略校验 → 哈希新密码 → 更新密码哈希
      await this.accountService.changePassword({
        accountId: input.accountId,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        transactionContext,
      });

      return { accountId: input.accountId };
    });
  }
}
