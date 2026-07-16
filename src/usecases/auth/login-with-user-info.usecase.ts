// src/usecases/auth/login-with-user-info.usecase.ts
// 顶层编排 Usecase：直接调用底层 service 和同级 Usecase，消除多跳链
// 遵循 docs/common/usecase.rules.md "仅允许一层、禁止 A→B→C"

import type { AuthLoginModel, LoginResultModel, UserInfoView } from '@app-types/models/auth.types';
import type { IdentityTypeEnum } from '@app-types/models/account.types';
import {
  AudienceTypeEnum,
} from '@app-types/models/account.types';
import type { ThirdPartySession } from '@app-types/models/third-party-auth.types';
import { ACCOUNT_ERROR, AUTH_ERROR, DomainError, THIRDPARTY_ERROR } from '@core/common/errors';
import { normalizeRequiredText } from '@core/common/input-normalize/input-normalize.policy';
import { AccountSecurityService } from '@modules/account/base/services/account-security.service';
import { AccountService } from '@modules/account/base/services/account.service';
import { AccountQueryService } from '@modules/account/queries/account.query.service';
import { ThirdPartyAuthQueryService } from '@modules/third-party-auth/queries/third-party-auth.query.service';
import { ThirdPartyAuthService } from '@modules/third-party-auth/third-party-auth.service';
import { TokenHelper } from '@modules/auth/token.helper';
import { EnrichedLoginResult, LoginWarningType } from '@app-types/auth/login-flow.types';
import { JwtPayload } from '@app-types/jwt.types';
import { AccountStatus } from '@app-types/models/account.types';
import { Injectable } from '@nestjs/common';
import { DecideLoginRoleUsecase } from './decide-login-role.usecase';
import { EnrichLoginWithIdentityUsecase } from './enrich-login-with-identity.usecase';
import { ExecuteLoginFlowUsecase } from './execute-login-flow.usecase';
import type { ThirdPartyLoginParams } from './login-with-third-party.types';

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
 * 登录并获取用户信息的顶层编排 Usecase
 * 直接调用底层 service 和同级 Usecase（ExecuteLoginFlow/DecideRole/EnrichIdentity），
 * 不通过中间 Usecase 转发，确保调用链只有一层。
 */
@Injectable()
export class LoginWithUserInfoUsecase {
  constructor(
    // 底层 service（modules 层）
    private readonly accountQueryService: AccountQueryService,
    private readonly accountSecurityService: AccountSecurityService,
    private readonly thirdPartyAuthService: ThirdPartyAuthService,
    private readonly thirdPartyAuthQueryService: ThirdPartyAuthQueryService,
    private readonly tokenHelper: TokenHelper,
    // 同级 Usecase（1 跳）
    private readonly executeLoginFlowUsecase: ExecuteLoginFlowUsecase,
    private readonly decideLoginRoleUsecase: DecideLoginRoleUsecase,
    private readonly enrichLoginWithIdentityUsecase: EnrichLoginWithIdentityUsecase,
  ) {}

  /** 密码登录 + 获取用户信息 */
  async loginWithPassword(params: AuthLoginModel): Promise<LoginWithUserInfoResult> {
    // 1. 验证凭据（直接调用 service，不通过 LoginWithPasswordUsecase 中转）
    const account = await this.validateLoginCredentials({
      loginName: params.loginName,
      loginPassword: params.loginPassword,
    });

    // 2. 执行基础登录流程（1 跳）
    const basicResult = await this.executeLoginFlowUsecase.execute({
      accountId: account.id,
      ip: params.ip,
      audience: params.audience,
    });

    // 3. 决策角色 + 签发 token + 装配身份（1 跳 each）
    const enrichedResult = await this.completeLoginOrchestration(
      basicResult,
      params.ip,
      params.audience,
    );

    // 4. 安全验证 + 用户信息
    return this.enrichWithUserInfo(enrichedResult);
  }

  /** 第三方登录 + 获取用户信息 */
  async loginWithThirdParty(params: ThirdPartyLoginParams): Promise<LoginWithUserInfoResult> {
    // 1. 解析第三方凭证（直接调用 service）
    const session = await this.resolveThirdPartyIdentity(params);

    // 2. 查找绑定关系
    const bound = await this.thirdPartyAuthQueryService.findAccountByThirdParty({
      provider: params.provider,
      providerUserId: session.providerUserId,
    });

    if (!bound?.accountId) {
      throw new DomainError(THIRDPARTY_ERROR.ACCOUNT_NOT_BOUND, '该第三方账户未绑定', {
        provider: params.provider,
        providerUserId: session.providerUserId,
      });
    }

    // 3. 执行基础登录流程（1 跳）
    const basicResult = await this.executeLoginFlowUsecase.execute({
      accountId: bound.accountId,
      ip: params.ip,
      audience: params.audience,
      provider: params.provider,
    });

    // 4. 决策角色 + 签发 token + 装配身份（1 跳 each）
    const enrichedResult = await this.completeLoginOrchestration(
      basicResult,
      params.ip,
      params.audience,
    );

    // 5. 安全验证 + 用户信息
    return this.enrichWithUserInfo(enrichedResult);
  }

  /**
   * 完成登录编排：决策角色 → 签发 token → 装配身份
   * 所有 Usecase 调用都在同一层级（1 跳）
   */
  private async completeLoginOrchestration(
    basicResult: Awaited<ReturnType<ExecuteLoginFlowUsecase['execute']>>,
    ip?: string,
    audience?: AudienceTypeEnum,
  ): Promise<EnrichedLoginResult> {
    // Decide: 决策最终角色
    const { finalRole, reason } = this.decideLoginRoleUsecase.execute(
      { roleFromHint: basicResult.roleFromHint, accessGroup: basicResult.accessGroup },
      {
        accountId: basicResult.accountId,
        ip: ip || '',
        userAgent: '',
        audience: audience || AudienceTypeEnum.DESKTOP,
      },
    );

    const hasRoles =
      Array.isArray(basicResult.accessGroup) && basicResult.accessGroup.length > 0;
    if (hasRoles && !basicResult.accessGroup.includes(finalRole)) {
      throw new DomainError(AUTH_ERROR.PERMISSION_MISMATCH, '权限信息异常，拒绝登录', {
        finalRole,
        accessGroup: basicResult.accessGroup,
      });
    }

    // 重签 Access Token 写入 activeRole
    const payload: JwtPayload = {
      sub: basicResult.accountId,
      username: basicResult.userInfo.nickname,
      email: basicResult.account.loginEmail,
      accessGroup: basicResult.accessGroup,
      ...(hasRoles ? { activeRole: finalRole } : {}),
    };
    const accessToken = this.tokenHelper.generateAccessToken({ payload, audience });
    const tokens = { accessToken, refreshToken: basicResult.tokens.refreshToken };

    // Enrich: 装配身份信息
    const enrichedResult = await this.enrichLoginWithIdentityUsecase.execute({
      tokens,
      accountId: basicResult.accountId,
      finalRole,
      accessGroup: basicResult.accessGroup,
      account: basicResult.account,
      userInfo: basicResult.userInfo,
      options: { includeIdentity: true },
    });

    if (reason === 'fallback') {
      enrichedResult.warnings = [
        ...(enrichedResult.warnings ?? []),
        LoginWarningType.ROLE_FALLBACK,
      ];
    }

    return enrichedResult;
  }

  /**
   * 验证密码登录凭据
   * 直接使用 AccountQueryService + AccountService，不通过中间 Usecase
   */
  private async validateLoginCredentials({
    loginName,
    loginPassword,
  }: Pick<AuthLoginModel, 'loginName' | 'loginPassword'>) {
    const account = await this.accountQueryService.findCredentialByLoginName({ loginName });
    if (!account) {
      throw new DomainError(AUTH_ERROR.ACCOUNT_NOT_FOUND, '账户不存在');
    }
    if (account.status !== AccountStatus.ACTIVE) {
      throw new DomainError(AUTH_ERROR.ACCOUNT_INACTIVE, '账户未激活或已被禁用');
    }
    const isPasswordValid = AccountService.verifyPassword(
      loginPassword,
      account.loginPassword,
      account.createdAt,
    );
    if (!isPasswordValid) {
      throw new DomainError(AUTH_ERROR.INVALID_PASSWORD, '密码错误');
    }
    return account;
  }

  /**
   * 解析第三方凭证
   * 直接使用 ThirdPartyAuthService，不通过 LoginWithThirdPartyUsecase 中转
   */
  private async resolveThirdPartyIdentity(params: ThirdPartyLoginParams): Promise<ThirdPartySession> {
    const authCredential = normalizeRequiredText(params.authCredential, {
      fieldName: '第三方凭证',
    });
    try {
      return await this.thirdPartyAuthService.resolveIdentity({
        provider: params.provider,
        authCredential,
        audience: params.audience,
      });
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError(THIRDPARTY_ERROR.LOGIN_FAILED, '第三方登录失败', {
        cause: (e as Error)?.message,
      });
    }
  }

  private async enrichWithUserInfo(
    loginResult: EnrichedLoginResult,
  ): Promise<LoginWithUserInfoResult> {
    const accountId = loginResult.accountId;

    // 1. 获取登录安全快照
    const loginSnapshot = await this.accountQueryService.getLoginBootstrapSnapshot({ accountId });

    // 2. 执行安全验证
    const securityResult = this.accountSecurityService.validateAccessGroupConsistency({
      id: loginSnapshot.account.id,
      userInfo: loginSnapshot.userInfo,
    });

    // 3. 如果账号应被暂停，抛出错误（写操作由 Usecase 负责，见 B12 修复）
    if (securityResult.shouldSuspend) {
      throw new DomainError(ACCOUNT_ERROR.ACCOUNT_SUSPENDED, '账户因安全问题已被暂停');
    }

    // 4. 构建用户信息视图
    const userInfoView = await this.accountQueryService.getUserInfoViewStrict({ accountId });

    return {
      loginResult,
      userInfoView,
      securityResult: {
        isValid: securityResult.isValid,
        wasSuspended: false,
        realAccessGroup: securityResult.realAccessGroup,
      },
    };
  }
}
