// src/usecases/auth/validate-access-token-session.usecase.ts
import type { JwtPayload } from '@app-types/jwt.types';
import { AccountStatus } from '@app-types/models/account.types';
import { DomainError, JWT_ERROR } from '@core/common/errors/domain-error';
import { AccountQueryService } from '@src/modules/account/queries/account.query.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ValidateAccessTokenSessionUsecase {
  constructor(private readonly accountQueryService: AccountQueryService) {}

  async execute(input: { readonly payload: JwtPayload }): Promise<JwtPayload> {
    const { payload } = input;

    if (payload.type !== 'access') {
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    const account = await this.accountQueryService.findAccountSnapshotById({
      accountId: payload.sub,
    });
    if (!account) {
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    // 关键安全校验：被封禁/暂停/删除的账户应立即失去访问权
    // 不校验 status 会导致管理员 suspend 账户后，
    // 该账户仍可凭已签发的 access token 访问受保护资源直至 token 过期
    if (account.status !== AccountStatus.ACTIVE) {
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    return payload;
  }
}
