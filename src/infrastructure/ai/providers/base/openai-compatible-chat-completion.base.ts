// src/infrastructure/ai/providers/base/openai-compatible-chat-completion.base.ts

import type {
  AiProviderClient,
  GenerateAiContentInput,
  GenerateAiContentResult,
} from '@core/ai/ai-provider.interface';
import { DomainError, THIRDPARTY_ERROR } from '@core/common/errors/domain-error';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { buildProviderJobId } from '../utils/provider-job-id';

/**
 * OpenAI 兼容 Chat Completion API 的通用响应结构
 * 适用于 OpenAI、Qwen 等兼容 OpenAI API 格式的 provider
 */
export interface OpenAiCompatibleChatCompletionResponse {
  readonly id?: string;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?:
        | string
        | ReadonlyArray<{ readonly type?: string; readonly text?: string }>
        | null;
    };
  }>;
}

/**
 * provider 配置路径
 */
export interface OpenAiCompatibleProviderConfigPaths {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly generateTimeoutMs: string;
}

/**
 * OpenAI 兼容 Chat Completion provider 的共享基类
 * 封装了通用的 generate、输出解析、providerJobId 生成和错误映射逻辑
 * 默认 postChatCompletion 实现适用于所有遵循 OpenAI Chat Completion 协议的 provider
 */
export abstract class OpenAiCompatibleChatCompletionBase implements AiProviderClient {
  abstract readonly name: string;

  protected abstract readonly configPaths: OpenAiCompatibleProviderConfigPaths;

  protected constructor(
    protected readonly configService: ConfigService,
    protected readonly httpService: HttpService,
  ) {}

  async generate(input: GenerateAiContentInput): Promise<GenerateAiContentResult> {
    const rawBaseUrl = this.resolveConfigValue(
      this.configPaths.baseUrl,
      'ai_provider_config_missing',
    );
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const apiKey = this.resolveConfigValue(this.configPaths.apiKey, 'ai_provider_config_missing');
    const timeoutMs = this.resolveTimeoutMs();
    const model = input.model.trim();
    const prompt = input.prompt.trim();

    const providerStartedAt = new Date();
    try {
      const response = await this.postChatCompletion(baseUrl, apiKey, timeoutMs, model, prompt);
      const outputText = this.resolveOutputText(response.data);
      const providerJobId = this.resolveProviderJobId({
        responseId: response.data.id,
        model,
        prompt,
      });
      const providerFinishedAt = new Date();
      const usage = response.data.usage;
      return {
        accepted: true,
        outputText,
        provider: this.name,
        model,
        providerJobId,
        providerRequestId: response.data.id?.trim() || providerJobId,
        providerStatus: 'succeeded',
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        costAmount: null,
        costCurrency: null,
        normalizedErrorCode: null,
        providerErrorCode: null,
        errorMessage: null,
        providerStartedAt,
        providerFinishedAt,
      };
    } catch (error) {
      throw this.mapProviderError(error);
    }
  }

  /**
   * 发送 Chat Completion 请求
   * 默认实现适用于所有遵循 OpenAI Chat Completion 协议的 provider
   * 子类可覆盖此方法以支持非标准请求格式
   */
  protected async postChatCompletion(
    baseUrl: string,
    apiKey: string,
    timeoutMs: number,
    model: string,
    prompt: string,
  ): Promise<{ readonly data: OpenAiCompatibleChatCompletionResponse }> {
    return this.httpService.axiosRef.post<OpenAiCompatibleChatCompletionResponse>(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        timeout: timeoutMs,
        headers: {
          authorization: `Bearer ${apiKey}`,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Content-Type': 'application/json',
        },
      },
    );
  }

  protected resolveOutputText(data: OpenAiCompatibleChatCompletionResponse): string {
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const text = content
        .map((item: { readonly type?: string; readonly text?: string }) =>
          item.type === 'text' ? (item.text ?? '') : '',
        )
        .join('')
        .trim();
      if (text) {
        return text;
      }
    }
    return '[empty_output]';
  }

  protected resolveProviderJobId(input: {
    readonly responseId?: string;
    readonly model: string;
    readonly prompt: string;
  }): string {
    if (input.responseId && input.responseId.trim().length > 0) {
      return `${this.name}:${input.responseId.trim()}`;
    }
    return buildProviderJobId({ provider: this.name, model: input.model, content: input.prompt });
  }

  protected mapProviderError(error: unknown): DomainError {
    if (error instanceof DomainError) {
      return error;
    }
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return new DomainError(THIRDPARTY_ERROR.PROVIDER_API_ERROR, 'ai_provider_timeout', {
          provider: this.name,
        });
      }
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        return new DomainError(THIRDPARTY_ERROR.PROVIDER_API_ERROR, 'ai_provider_auth_failed', {
          provider: this.name,
          status,
        });
      }
      if (typeof status === 'number' && status >= 500) {
        return new DomainError(THIRDPARTY_ERROR.PROVIDER_API_ERROR, 'ai_provider_upstream_5xx', {
          provider: this.name,
          status,
        });
      }
      return new DomainError(THIRDPARTY_ERROR.PROVIDER_API_ERROR, 'ai_provider_request_failed', {
        provider: this.name,
        status,
      });
    }
    return new DomainError(THIRDPARTY_ERROR.PROVIDER_API_ERROR, 'ai_provider_unknown_error', {
      provider: this.name,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  private resolveConfigValue(configPath: string, errorCode: string): string {
    const value = this.configService.get<string>(configPath, '');
    const normalized = value.trim();
    if (!normalized) {
      throw new DomainError(THIRDPARTY_ERROR.PROVIDER_CONFIG_MISSING, errorCode);
    }
    return normalized;
  }

  private resolveTimeoutMs(): number {
    const timeoutMs = this.configService.get<number>(this.configPaths.generateTimeoutMs, 30000);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return 30000;
    }
    return timeoutMs;
  }
}
