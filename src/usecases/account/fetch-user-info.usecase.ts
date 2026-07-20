// src/usecases/account/fetch-user-info.usecase.ts

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import type { IdentityTypeEnum } from '@app-types/models/account.types';
import { UserInfoView } from '@app-types/models/auth.types'; // 导入统一的 UserInfoView
import { UserState } from '@app-types/models/user-info.types';
import { AccountQueryService } from '@modules/account/queries/account.query.service';
import { Injectable } from '@nestjs/common';

// 移除本地的 UserInfoView 定义，使用统一的类型定义

@Injectable()
export class FetchUserInfoUsecase {
  constructor(private readonly accountQueryService: AccountQueryService) {}

  /**
   * 获取用户信息（登录专用）
   * 确保返回完整的用户信息，所有必要字段都有值
   */
  async executeForLogin(params: {
    accountId: number;
    accessGroup?: IdentityTypeEnum[];
  }): Promise<UserInfoView> {
    return await this.accountQueryService.getUserInfoViewForLogin({
      accountId: params.accountId,
    });
  }

  /**
   * 严格模式：必须存在 user_info，否则抛错
   * - 适用于资料管理页等强一致场景
   * - accessGroup 可选：同上
   */
  async executeStrict(params: {
    accountId: number;
    accessGroup?: IdentityTypeEnum[];
    transactionContext?: PersistenceTransactionContext;
  }): Promise<
    UserInfoView & {
      nickname: string;
      userState: UserState;
      notifyCount: number;
      unreadCount: number;
      createdAt: Date;
      updatedAt: Date;
    }
  > {
    const { accountId } = params;

    return await this.accountQueryService.getUserInfoViewStrict({
      accountId,
      transactionContext: params.transactionContext,
    });
  }
}
export { UserInfoView };
