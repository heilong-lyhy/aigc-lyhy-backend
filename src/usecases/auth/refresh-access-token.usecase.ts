// src/usecases/auth/refresh-access-token.usecase.ts
// 刷新令牌用例：客户端凭 refresh token 换取新的 access/refresh token 对
//
// 关键安全校验：
// 1. refresh token 必须通过签名验证（防伪造）
// 2. payload.type 必须为 'refresh'（防 access token 互用）
// 3. 账户必须存在且 status === ACTIVE（已封禁/暂停账户不可刷新）
// 4. tokenVersion 一致性校验（预留扩展点：当前 tokenVersion 恒为 1，未来引入 account.tokenVersion
//    字段后，logout/封禁操作可原子自增，使所有已签发 refresh token 失效）
//
// 令牌轮换策略：每次刷新同时签发新的 access + refresh token，旧 refresh token 在客户端
// 必须立即销毁（refresh token rotation），降低 refresh token 泄漏后的窗口期

import { JwtPayload } from '@app-types/jwt.types';
import { AccountStatus } from '@app-types/models/account.types';
import { DomainError, JWT_ERROR } from '@core/common/errors/domain-error';
import { AUTH_TOKENS } from '@modules/auth/auth.tokens';
import { TokenHelper } from '@modules/auth/token.helper';
import { AccountQueryService } from '@src/modules/account/queries/account.query.service';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export interface RefreshAccessTokenInput {
  readonly refreshToken: string;
}

export interface RefreshAccessTokenResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accountId: number;
}

@Injectable()
export class RefreshAccessTokenUsecase {
  constructor(
    private readonly tokenHelper: TokenHelper,
    private readonly accountQueryService: AccountQueryService,
    @Inject(AUTH_TOKENS.JWT_REFRESH_EXPIRES_IN)
    private readonly refreshExpiresIn: string,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RefreshAccessTokenUsecase.name);
  }

  async execute(input: RefreshAccessTokenInput): Promise<RefreshAccessTokenResult> {
    // 1. 校验 refresh token 签名、过期、type
    const payload = this.tokenHelper.verifyToken({ token: input.refreshToken });

    if (payload.type !== 'refresh') {
      this.logger.warn(
        { accountId: payload.sub, tokenType: payload.type },
        'refresh 收到非 refresh 类型 token，可能为攻击行为',
      );
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    // 2. 校验账户存在
    const account = await this.accountQueryService.findAccountSnapshotById({
      accountId: payload.sub,
    });
    if (!account) {
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    // 3. 关键安全校验：已封禁/暂停/删除的账户不可刷新
    // 攻击场景：管理员封禁账户后，攻击者用之前泄漏的 refresh token 持续获取新 access token
    if (account.status !== AccountStatus.ACTIVE) {
      this.logger.warn(
        { accountId: account.id, status: account.status },
        '非活跃账户尝试 refresh token，已拒绝',
      );
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    // 4. tokenVersion 一致性校验（预留：当前未持久化，恒为 1，将来扩展时启用）
    // const expectedVersion = account.tokenVersion ?? 1;
    // if (payload.tokenVersion !== expectedVersion) {
    //   throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    // }

    // 5. 重新读取完整账户快照用于签发新的 access token
    // 注意：refresh token 只携带 sub，签发 access token 需要完整的 accessGroup/nickname/email
    // 此处通过 getUserAccountViewById 获取；如果未来 UserInfo 等关联查询开销大，可改用缓存
    const fullAccount = await this.accountQueryService.getUserAccountViewById({
      accountId: account.id,
    });

    const jwtPayload: JwtPayload = {
      sub: fullAccount.id,
      username: fullAccount.loginName ?? '',
      email: fullAccount.loginEmail,
      accessGroup: [], // 由下游 enrich usecase 填充，此处留空
      type: 'access',
    };

    const accessToken = this.tokenHelper.generateAccessToken({ payload: jwtPayload });

    // refresh token 轮换：每次刷新签发新 refresh token，旧 token 客户端应立即销毁
    const newRefreshToken = this.tokenHelper.generateRefreshToken({
      payload: { sub: account.id },
      expiresIn: this.refreshExpiresIn,
    });

    this.logger.info(
      { accountId: account.id, event: 'token_refreshed' },
      '刷新令牌成功，旧 refresh token 应立即作废',
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accountId: account.id,
    };
  }
}
