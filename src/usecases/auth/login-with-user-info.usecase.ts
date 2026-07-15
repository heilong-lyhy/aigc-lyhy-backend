// src/usecases/auth/login-with-user-info.usecase.ts
// 组合 Usecase：编排 login + fetchUserInfo，避免 Resolver 承担业务编排职责

import type { AuthLoginModel, LoginResultModel, UserInfoView } from '@app-types/models/auth.types';
import type { ThirdPartyLoginParams } from './login-with-third-party.types';
import type { CompleteUserData } from '../account/fetch-user-info.types';
import { FetchUserInfoUsecase } from '../account/fetch-user-info.usecase';
import { LoginWithPasswordUsecase } from './login-with-password.usecase';
import { LoginWithThirdPartyUsecase } from './login-with-third-party.usecase';
import { Injectable } from '@nestjs/common';

export interface LoginWithUserInfoResult {
  loginResult: LoginResultModel;
  userInfoView: UserInfoView;
  securityResult: CompleteUserData['securityResult'];
}

/**
 * 登录并获取用户信息的组合 Usecase
 * 将 login + fetchUserInfo 编排在一个 Usecase 内，避免 Resolver 做业务编排
 */
@Injectable()
export class LoginWithUserInfoUsecase {
  constructor(
    private readonly loginWithPasswordUsecase: LoginWithPasswordUsecase,
    private readonly loginWithThirdPartyUsecase: LoginWithThirdPartyUsecase,
    private readonly fetchUserInfoUsecase: FetchUserInfoUsecase,
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

  private async enrichWithUserInfo(loginResult: LoginResultModel): Promise<LoginWithUserInfoResult> {
    const completeUserData = await this.fetchUserInfoUsecase.executeForLoginFlow({
      accountId: loginResult.accountId,
    });
    return {
      loginResult,
      userInfoView: completeUserData.userInfoView,
      securityResult: completeUserData.securityResult,
    };
  }
}
