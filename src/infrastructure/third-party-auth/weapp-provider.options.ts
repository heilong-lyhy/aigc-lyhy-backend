export const WEAPP_PROVIDER_OPTIONS = Symbol('WEAPP_PROVIDER_OPTIONS');

export interface WeAppProviderOptions {
  appId?: string;
  appSecret?: string;
  /** 微信 API 基础 URL，默认 'https://api.weixin.qq.com' */
  apiBaseUrl?: string;
  /** 请求超时毫秒，默认 10000 */
  requestTimeout?: number;
}
