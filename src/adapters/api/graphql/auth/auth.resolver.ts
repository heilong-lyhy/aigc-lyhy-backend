// src/adapters/api/graphql/auth/auth.resolver.ts

import { AuthLoginModel, UserInfoView } from '@app-types/models/auth.types';
import { GeographicInfo } from '@app-types/models/user-info.types';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoginWithUserInfoUsecase } from '@usecases/auth/login-with-user-info.usecase';
import { LoginResult } from '../account/dto/login-result.dto';
import { UserInfoDTO } from '../account/dto/user-info.dto';
import { AuthLoginInput } from './dto/auth-login.input';

/**
 * 认证相关的 GraphQL Resolver
 * 只负责注入身份和映射结果，业务编排由 Usecase 处理
 */
@Resolver()
export class AuthResolver {
  constructor(
    private readonly loginWithUserInfoUsecase: LoginWithUserInfoUsecase,
  ) {}

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
    const { loginResult, userInfoView } = await this.loginWithUserInfoUsecase.loginWithPassword(authLoginModel);

    return {
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      accountId: loginResult.accountId,
      role: loginResult.role,
      userInfo: this.mapUserInfoViewToSecureDTO(userInfoView),
    };
  }

  /**
   * 将 UserInfoView 映射为安全的 UserInfoDTO
   * 移除敏感字段（如 metaDigest），确保不会泄露给前端
   */
  private mapUserInfoViewToSecureDTO(userInfoView: UserInfoView): UserInfoDTO {
    return {
      // 基础字段映射
      id: userInfoView.accountId,
      accountId: userInfoView.accountId,
      nickname: userInfoView.nickname,
      gender: userInfoView.gender,
      birthDate: userInfoView.birthDate,
      avatarUrl: userInfoView.avatarUrl,
      email: userInfoView.email,
      signature: userInfoView.signature,

      // 联系方式字段
      address: userInfoView.address,
      phone: userInfoView.phone,

      // 标签和地理位置 - 需要序列化为字符串
      tags: userInfoView.tags,
      geographic: this.serializeGeographic(userInfoView.geographic),

      // 访问组和通知
      accessGroup: userInfoView.accessGroup,
      notifyCount: userInfoView.notifyCount,
      unreadCount: userInfoView.unreadCount,

      // 状态和时间戳
      userState: userInfoView.userState,
      createdAt: userInfoView.createdAt,
      updatedAt: userInfoView.updatedAt,
    };
  }

  /**
   * 将 GeographicInfo 对象序列化为字符串
   * @param geographic 地理位置信息对象
   * @returns 序列化后的字符串或 null
   */
  private serializeGeographic(geographic: GeographicInfo | null): string | null {
    if (!geographic) return null;

    const parts: string[] = [];
    if (geographic.province) parts.push(geographic.province);
    if (geographic.city) parts.push(geographic.city);

    return parts.length > 0 ? parts.join(', ') : null;
  }
}
