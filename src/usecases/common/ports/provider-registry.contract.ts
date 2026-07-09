// src/usecases/common/ports/provider-registry.contract.ts
export const PROVIDER_REGISTRY = Symbol('PROVIDER_REGISTRY');

export interface ProviderRegistryGetClientInput {
  readonly providerKind: string;
  readonly providerName: string;
}

export interface ProviderRegistry {
  getProviderClient<TClient>(input: ProviderRegistryGetClientInput): TClient | null;
}
