import { AudienceTypeEnum, ThirdPartyProviderEnum } from '@app-types/models/account.types';
import { ThirdPartySession } from '@app-types/models/third-party-auth.types';
import { DomainError, THIRDPARTY_ERROR } from '@core/common/errors/domain-error';
import { ThirdPartyProvider } from '@modules/third-party-auth/contracts/third-party-provider.contract';
import { Injectable } from '@nestjs/common';

/**
 * 微信网页/公众号认证提供者
 * 用于实现微信网页授权和公众号 OAuth 认证流程
 * TODO: 实现完整的网页/公众号 OAuth 认证流程
 */
@Injectable()
export class WechatAuthProvider implements ThirdPartyProvider {
  readonly provider = ThirdPartyProviderEnum.WECHAT;

  /**
   * 微信网页/公众号 OAuth 认证凭证交换
   * TODO: 实现 code → access_token → userinfo 的完整 OAuth 流程
   * @param params 交换参数
   * @param params.authCredential 微信网页授权获取的 code
   * @param params.audience 客户端类型
   * @returns 标准化的第三方会话信息
   * @throws DomainError 当前未实现，抛出占位异常
   */
  exchangeCredential({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    authCredential,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    audience,
  }: {
    authCredential: string;
    audience: AudienceTypeEnum;
  }): Promise<ThirdPartySession> {
    // TODO: 实现微信网页/公众号 OAuth 的 code→access_token→userinfo 流程
    throw new DomainError(THIRDPARTY_ERROR.PROVIDER_NOT_SUPPORTED, '微信网页 OAuth 暂未实现');
  }
}
