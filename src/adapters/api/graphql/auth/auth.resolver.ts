// src/adapters/api/graphql/auth/auth.resolver.ts

import { AuthLoginModel } from '@app-types/models/auth.types';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoginWithPasswordUsecase } from '@usecases/auth/login-with-password.usecase';
import { mapUserInfoViewToDTO } from '../account/dto/user-info.mapper';
import { LoginResult } from '../account/dto/login-result.dto';
import { AuthLoginInput } from './dto/auth-login.input';

/**
 * 认证相关的 GraphQL Resolver
 * 只做协议映射：DTO → 领域模型 → DTO
 */
@Resolver()
export class AuthResolver {
  constructor(private readonly loginWithPasswordUsecase: LoginWithPasswordUsecase) {}

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

    // 调用 usecase（完整登录流程由 usecase 编排）
    const result = await this.loginWithPasswordUsecase.execute(authLoginModel);

    // 将领域模型转换回 DTO
    const loginResult: LoginResult = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accountId: result.accountId,
      role: result.role,
      userInfo: result.userInfoView ? mapUserInfoViewToDTO(result.userInfoView) : null,
    };

    return loginResult;
  }
}
