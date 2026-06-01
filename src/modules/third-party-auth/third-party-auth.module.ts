// src/modules/third-party-auth/third-party-auth.module.ts
import { HttpModule } from '@nestjs/axios';
import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ThirdPartyProviderEnum } from '@app-types/models/account.types';
import { ThirdPartyProvider } from './interfaces/third-party-provider.interface';
import {
  WEAPP_PROVIDER_OPTIONS,
  type WeAppProviderOptions,
} from './providers/weapp-provider.options';
import { WeAppProvider } from './providers/weapp.provider';
import { WechatProvider } from './providers/wechat.provider';
import { ThirdPartyAuthQueryService } from './queries/third-party-auth.query.service';
import { ThirdPartyAuthEntity } from './third-party-auth.entity';
import { PROVIDER_MAP, ThirdPartyAuthService } from './third-party-auth.service';

/**
 * 第三方认证提供者映射工厂
 * 创建平台类型到具体提供者实现的映射关系
 */
const providerMapFactory: Provider = {
  provide: PROVIDER_MAP,
  useFactory: (weapp: WeAppProvider, wechat: WechatProvider) => {
    // 构建第三方平台类型到提供者实现的映射
    const map = new Map<ThirdPartyProviderEnum, ThirdPartyProvider>([
      [weapp.provider, weapp],
      [wechat.provider, wechat],
      // TODO: 添加更多第三方平台支持 (GitHub、Google、QQ 等)
    ]);
    return map;
  },
  inject: [WeAppProvider, WechatProvider],
};

/**
 * 第三方认证模块
 * 提供统一的第三方平台认证、绑定、解绑等功能
 */
@Module({
  imports: [TypeOrmModule.forFeature([ThirdPartyAuthEntity]), HttpModule, ConfigModule],
  providers: [
    {
      provide: WEAPP_PROVIDER_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): WeAppProviderOptions => ({
        appId: configService.get<string>('WECHAT_APP_ID')?.trim() || undefined,
        appSecret: configService.get<string>('WECHAT_APP_SECRET')?.trim() || undefined,
      }),
    },
    WeAppProvider,
    WechatProvider,
    providerMapFactory,
    ThirdPartyAuthService,
    ThirdPartyAuthQueryService,
  ],
  exports: [ThirdPartyAuthService, ThirdPartyAuthQueryService, WeAppProvider],
})
export class ThirdPartyAuthModule {}
