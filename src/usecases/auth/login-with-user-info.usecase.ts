// src/usecases/auth/login-with-user-info.usecase.ts
// 组合 Usecase：编排 login + fetchUserInfo，避免 Resolver 承担业务编排职责
// 通过 DI 注入 account 域的 modules 层 service，避免跨域 usecase 依赖

import type { AuthLoginModel, LoginResultModel, UserInfoView } from '@app-types/models/auth.types';
import type { IdentityTypeEnum } from '@app-types/models/account.types';
import { ACCOUNT_ERROR, DomainError } from '@core/common/errors';
import { AccountSecurityService } from '@modules/account/base/services/account-security.service';
import { AccountQueryService } from '@modules/account/queries/account.query.service';
import type { ThirdPartyLoginParams } from './login-with-third-party.types';
import { LoginWithPasswordUsecase } from './login-with-password.usecase';
import { LoginWithThirdPartyUsecase } from './login-with-third-party.usecase';
import { Injectable } from '@nestjs/common';

export interface LoginWithUserInfoResult {
  loginResult: LoginResultModel;
  userInfoView: UserInfoView;
  securityResult: {
    isValid: boolean;
    wasSuspended: boolean;
    realAccessGroup?: IdentityTypeEnum[];
  };
}

/**
 * 登录并获取用户信息的组合 Usecase
 * 将 login + fetchUserInfo 编排在一个 Usecase 内，避免 Resolver 做业务编排
 * 通过 DI 注入 account 域的 AccountQueryService 和 AccountSecurityService，
 * 而非跨域依赖 FetchUserInfoUsecase
 */
@Injectable()
export class LoginWithUserInfoUsecase {
  constructor(
    private readonly loginWithPasswordUsecase: LoginWithPasswordUsecase,
    private readonly loginWithThirdPartyUsecase: LoginWithThirdPartyUsecase,
    private readonly accountQueryService: AccountQueryService,
    private readonly accountSecurityService: AccountSecurityService,
  ) {}

  /** 密码登录 + 获取用户信息 */
  async loginWithPassword(params: AuthLoginModel): Promise<LoginWithUserInfoResult> {
    const loginResult = await this.loginWithPasswordUsecase.execute(params);
    return this.enrichWithUserInfo(loginResult);
  }

  /** 第三方登录 + 获取用户信息 */
  async loginWithThirdParty(params: ThirdPartyLoginParams): Promise<LoginWithUserInfoResult> {
    const loginResult = await this.loginWithThirdPartyUsecase.execute(params);
    return this.enrichWithUserInfo(loginResult);
  }

  private async enrichWithUserInfo(
    loginResult: LoginResultModel,
  ): Promise<LoginWithUserInfoResult> {
    const accountId = loginResult.accountId;

    // 1. 获取登录安全快照
    const loginSnapshot = await this.accountQueryService.getLoginBootstrapSnapshot({ accountId });

    // 2. 执行安全验证（metaDigest 与 accessGroup 比对）
    const securityResult = this.accountSecurityService.checkAndHandleAccountSecurity({
      id: loginSnapshot.account.id,
      userInfo: loginSnapshot.userInfo,
    });

    // 3. 如果账号被暂停，抛出错误
    if (securityResult.wasSuspended) {
      throw new DomainError(ACCOUNT_ERROR.ACCOUNT_SUSPENDED, '账户因安全问题已被暂停');
    }

    // 4. 构建用户信息视图
    const userInfoView = await this.accountQueryService.getUserInfoViewStrict({ accountId });

    return {
      loginResult,
      userInfoView,
      securityResult,
    };
  }
}
