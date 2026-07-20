import { THIRD_PARTY_PROVIDER_TOKENS } from '@modules/third-party-auth/contracts/third-party-provider.contract';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WeAppHttpProvider } from './providers/weapp-http.provider';
import { WechatAuthProvider } from './providers/wechat-auth.provider';
import { WEAPP_PROVIDER_OPTIONS, type WeAppProviderOptions } from './weapp-provider.options';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    {
      provide: WEAPP_PROVIDER_OPTIONS,
      inject: [ConfigService],
      // B17 修复：fallback 默认值已上提到 config.module.ts 的 thirdPartyAuthConfig，此处仅读取
      useFactory: (configService: ConfigService): WeAppProviderOptions => {
        const wechat = configService.get<{
          appId?: string;
          appSecret?: string;
          apiBaseUrl: string;
          requestTimeout: number;
        }>('thirdPartyAuth.wechat')!;
        return {
          appId: wechat.appId?.trim() || undefined,
          appSecret: wechat.appSecret?.trim() || undefined,
          apiBaseUrl: wechat.apiBaseUrl,
          requestTimeout: wechat.requestTimeout,
        };
      },
    },
    WeAppHttpProvider,
    WechatAuthProvider,
    {
      provide: THIRD_PARTY_PROVIDER_TOKENS.WEAPP,
      useExisting: WeAppHttpProvider,
    },
    {
      provide: THIRD_PARTY_PROVIDER_TOKENS.WECHAT,
      useExisting: WechatAuthProvider,
    },
  ],
  exports: [THIRD_PARTY_PROVIDER_TOKENS.WEAPP, THIRD_PARTY_PROVIDER_TOKENS.WECHAT],
})
export class ThirdPartyAuthInfrastructureModule {}
