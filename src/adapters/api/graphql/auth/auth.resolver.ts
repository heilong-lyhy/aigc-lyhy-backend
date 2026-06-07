// src/adapters/api/graphql/auth/auth.resolver.ts

import { AuthLoginModel, LoginResultModel } from '@app-types/models/auth.types';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { FetchUserInfoUsecase } from '@usecases/account/fetch-user-info.usecase';
import { LoginWithPasswordUsecase } from '@usecases/auth/login-with-password.usecase';
import { mapUserInfoViewToDTO } from '../account/dto/user-info.mapper';
import { LoginResult } from '../account/dto/login-result.dto';
import { AuthLoginInput } from './dto/auth-login.input';

/**
 * 认证相关的 GraphQL Resolver
 */
@Resolver()
export class AuthResolver {
  constructor(
    private readonly loginWithPasswordUsecase: LoginWithPasswordUsecase,
    private readonly fetchUserInfoUsecase: FetchUserInfoUsecase,
  ) {}

  @Mutation(() => LoginResult)
  async login(@Args('input') input: AuthLoginInput): Promise<LoginResult> {
    // 将 DTO 转换为领域模型
    const authLoginModel: AuthLoginModel = {
      loginName: input.loginName,
      loginPassword: input.loginPassword,
      type: input.type,
      ip: input.ip,
      audience: input.audience,
    };

    // 调用 usecase
    const result: LoginResultModel = await this.loginWithPasswordUsecase.execute(authLoginModel);

    // 获取用户信息（包含安全验证）
    const completeUserData = await this.fetchUserInfoUsecase.executeForLoginFlow({
      accountId: result.accountId,
    });

    // 将领域模型转换回 DTO
    const loginResult: LoginResult = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accountId: result.accountId,
      role: result.role,
      userInfo: mapUserInfoViewToDTO(completeUserData.userInfoView),
    };

    return loginResult;
  }
}
