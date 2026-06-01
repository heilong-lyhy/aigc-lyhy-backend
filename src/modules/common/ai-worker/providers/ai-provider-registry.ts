// src/modules/common/ai-worker/providers/ai-provider-registry.ts
import { DomainError, THIRDPARTY_ERROR } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import type { AiProviderClient } from '@core/ai/ai-provider.interface';
import { LocalMockAiProvider } from '@src/infrastructure/ai/providers/local/local-mock-ai.provider';
import { OpenAiGenerateProvider } from '@src/infrastructure/ai/providers/openai/openai-generate.provider';
import { QwenGenerateProvider } from '@src/infrastructure/ai/providers/qwen/qwen-generate.provider';
import { AI_PROVIDER_REGISTRY_OPTIONS, type AiProviderRegistryOptions } from '../ai-worker.options';

@Injectable()
export class AiProviderRegistry {
  constructor(
    @Inject(AI_PROVIDER_REGISTRY_OPTIONS)
    private readonly options: AiProviderRegistryOptions,
    private readonly localMockProvider: LocalMockAiProvider,
    private readonly openAiGenerateProvider: OpenAiGenerateProvider,
    private readonly qwenGenerateProvider: QwenGenerateProvider,
  ) {}

  getGenerateProvider(name?: string): AiProviderClient {
    return this.resolveProvider(name);
  }

  getEmbedProvider(): AiProviderClient {
    return this.localMockProvider;
  }

  private isMockMode(): boolean {
    return this.options.providerMode.trim().toLowerCase() === 'mock';
  }

  private resolveProviderName(inputProvider?: string): string {
    return inputProvider?.trim().toLowerCase() ?? '';
  }

  private resolveProvider(inputProvider?: string): AiProviderClient {
    if (this.isMockMode()) {
      return this.localMockProvider;
    }
    const providerName = this.resolveProviderName(inputProvider);
    if (!providerName) {
      return this.localMockProvider;
    }
    if (providerName === this.localMockProvider.name) {
      return this.localMockProvider;
    }
    if (providerName === this.openAiGenerateProvider.name) {
      return this.openAiGenerateProvider;
    }
    if (providerName === this.qwenGenerateProvider.name) {
      return this.qwenGenerateProvider;
    }
    throw new DomainError(
      THIRDPARTY_ERROR.PROVIDER_NOT_SUPPORTED,
      `unsupported_ai_provider:${providerName}`,
    );
  }
}
