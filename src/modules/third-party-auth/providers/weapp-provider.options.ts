export const WEAPP_PROVIDER_OPTIONS = Symbol('WEAPP_PROVIDER_OPTIONS');

export interface WeAppProviderOptions {
  readonly appId?: string;
  readonly appSecret?: string;
}
