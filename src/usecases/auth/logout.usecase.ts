// src/usecases/auth/logout.usecase.ts
// 登出用例：JWT 是无状态令牌，access token 在过期前无法撤销（这是 JWT 的固有权衡）
// 本用例负责：
// 1. 校验传入 refresh token 的结构、签名、type
// 2. 校验账户存在且仍为 ACTIVE 状态（已封禁账户不允许多次登出制造噪音）
// 3. 记录登出审计日志（供安全审计追溯）
//
// 由于当前 AccountEntity 尚未持久化 tokenVersion 字段，无法做到"立刻使所有 refresh token 失效"。
// 短期方案：客户端在收到 logout 响应后必须本地清除 token；服务端仅记录审计日志。
// 长期方案：在 account 表新增 token_version INT 字段，logout 时原子自增，
//          refresh-access-token.usecase 比对 payload.tokenVersion === account.tokenVersion，
//          不一致即拒绝刷新，从而实现真正的"全局撤销"。

import { AccountStatus } from '@app-types/models/account.types';
import { DomainError, JWT_ERROR } from '@core/common/errors/domain-error';
import { AccountQueryService } from '@src/modules/account/queries/account.query.service';
import { TokenHelper } from '@modules/auth/token.helper';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export interface LogoutInput {
  /** 客户端持有的 refresh token，用于服务端审计与可选撤销 */
  readonly refreshToken: string;
}

export interface LogoutResult {
  readonly loggedOut: true;
  readonly accountId: number;
}

@Injectable()
export class LogoutUsecase {
  constructor(
    private readonly tokenHelper: TokenHelper,
    private readonly accountQueryService: AccountQueryService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(LogoutUsecase.name);
  }

  async execute(input: LogoutInput): Promise<LogoutResult> {
    // 校验 refresh token：签名、过期、type 一并校验
    // 即便客户端传错或伪造，也以统一的 AUTHENTICATION_FAILED 错误响应，不泄漏内部状态
    const payload = this.tokenHelper.verifyToken({ token: input.refreshToken });

    if (payload.type !== 'refresh') {
      // 用 access token 来调用 logout 视为攻击行为，记录 warn 日志
      this.logger.warn(
        { accountId: payload.sub, tokenType: payload.type },
        'logout 收到非 refresh 类型 token，可能为攻击行为',
      );
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    const account = await this.accountQueryService.findAccountSnapshotById({
      accountId: payload.sub,
    });
    if (!account) {
      throw new DomainError(JWT_ERROR.AUTHENTICATION_FAILED, 'JWT 认证失败');
    }

    // 已封禁/暂停账户也允许登出（清掉自己的 token），但记录日志用于审计
    // 不抛错避免给攻击者枚举账户状态的信号
    if (account.status !== AccountStatus.ACTIVE) {
      this.logger.info(
        { accountId: account.id, status: account.status },
        '非活跃账户调用 logout，已记录审计',
      );
    }

    this.logger.info(
      { accountId: account.id, event: 'logout' },
      '用户登出，客户端应清除本地 access/refresh token',
    );

    return { loggedOut: true, accountId: account.id };
  }
}
