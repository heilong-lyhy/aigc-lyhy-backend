import type {
  AiProviderClient,
  EmbedAiContentInput,
  EmbedAiContentResult,
  GenerateAiContentInput,
  GenerateAiContentResult,
} from '@core/ai/ai-provider.interface';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { buildProviderJobId } from '../utils/provider-job-id';

@Injectable()
export class LocalMockAiProvider implements AiProviderClient {
  readonly name = 'mock';

  generate(input: GenerateAiContentInput): Promise<GenerateAiContentResult> {
    const providerStartedAt = new Date();
    const normalizedPrompt = input.prompt.trim();
    const outputText = normalizedPrompt.length > 0 ? normalizedPrompt : '[empty_prompt]';
    const providerJobId = buildProviderJobId({
      provider: this.name,
      model: input.model,
      content: normalizedPrompt,
    });
    const providerFinishedAt = new Date();
    return Promise.resolve({
      accepted: true,
      outputText,
      provider: this.name,
      model: input.model,
      providerJobId,
      providerRequestId: providerJobId,
      providerStatus: 'succeeded',
      promptTokens: null,
      completionTokens: null,
      costAmount: null,
      costCurrency: null,
      normalizedErrorCode: null,
      providerErrorCode: null,
      errorMessage: null,
      providerStartedAt,
      providerFinishedAt,
    });
  }

  embed(input: EmbedAiContentInput): Promise<EmbedAiContentResult> {
    const providerStartedAt = new Date();
    const normalizedText = input.text.trim();
    const providerJobId = buildProviderJobId({
      provider: this.name,
      model: input.model,
      content: normalizedText,
    });
    const providerFinishedAt = new Date();
    return Promise.resolve({
      accepted: true,
      vector: this.buildVector({ model: input.model, text: normalizedText }),
      provider: this.name,
      model: input.model,
      providerJobId,
      providerRequestId: providerJobId,
      providerStatus: 'succeeded',
      promptTokens: null,
      completionTokens: null,
      costAmount: null,
      costCurrency: null,
      normalizedErrorCode: null,
      providerErrorCode: null,
      errorMessage: null,
      providerStartedAt,
      providerFinishedAt,
    });
  }

  private buildVector(input: {
    readonly model: string;
    readonly text: string;
  }): ReadonlyArray<number> {
    const digest = createHash('sha256').update(`${input.model}:${input.text}`).digest();
    return [digest[0] / 255, digest[1] / 255, digest[2] / 255, digest[3] / 255];
  }
}
