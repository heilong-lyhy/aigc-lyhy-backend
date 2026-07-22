// src/adapters/api/graphql/auth/auth.resolver.ts

import { AuthLoginModel } from '@app-types/models/auth.types';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoginWithUserInfoUsecase } from '@usecases/auth/login-with-user-info.usecase';
import { LoginResult } from '../account/dto/login-result.dto';
import { mapUserInfoViewToDTO } from '../account/dto/user-info.mapper';
import { AuthLoginInput } from './dto/auth-login.input';

/**
 * 认证相关的 GraphQL Resolver
 * 只负责注入身份和映射结果，业务编排由 Usecase 处理
 */
@Resolver()
export class AuthResolver {
  constructor(private readonly loginWithUserInfoUsecase: LoginWithUserInfoUsecase) {}

  @Mutation(() => LoginResult)
  async login(@Args('input') input: AuthLoginInput): Promise<LoginResult> {
    const authLoginModel: AuthLoginModel = {
      loginName: input.loginName,
      loginPassword: input.loginPassword,
      type: input.type,
      ip: input.ip,
      audience: input.audience,
    };

    // 单一 Usecase 编排 login + fetchUserInfo
    const { loginResult, userInfoView } =
      await this.loginWithUserInfoUsecase.loginWithPassword(authLoginModel);

    return {
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      accountId: loginResult.accountId,
      role: loginResult.role,
      userInfo: mapUserInfoViewToDTO(userInfoView),
    };
  }
}
