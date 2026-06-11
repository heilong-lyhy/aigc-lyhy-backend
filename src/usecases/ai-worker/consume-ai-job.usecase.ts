// src/usecases/ai-worker/consume-ai-job.usecase.ts
import { Injectable, Logger } from '@nestjs/common';
import { AiProviderCallRecordService } from '@src/modules/ai-provider-call-record/ai-provider-call-record.service';
import { AsyncTaskRecordService } from '@src/modules/async-task-record/async-task-record.service';
import { AiWorkerService } from '@src/modules/common/ai-worker/ai-worker.service';
import type {
  EmbedAiContentInput,
  EmbedAiContentResult,
  GenerateAiContentInput,
  GenerateAiContentResult,
} from '@src/modules/common/ai-worker/ai-worker.types';
import {
  recordAsyncTaskStarted,
  recordAsyncTaskFinished,
  recordProviderSucceededCall,
  recordProviderFailedCall,
  resolveFailBizKey,
  resolveFailReason,
  shouldRecordProviderCallFailure,
  type AiWorkerProviderCallResult,
} from './consume-ai-job.helper';

export interface ConsumeAiGenerateJobProcessInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly payload: GenerateAiContentInput;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
}

export interface ConsumeAiGenerateJobCompleteInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
}

export interface ConsumeAiGenerateJobFailInput extends ConsumeAiGenerateJobCompleteInput {
  readonly bizType?: 'ai_generation' | 'ai_worker';
  readonly bizKey?: string;
  readonly reason?: string;
  readonly occurredAt?: Date;
  readonly error?: unknown;
}

export interface ConsumeAiEmbedJobProcessInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly payload: EmbedAiContentInput;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
}

export interface ConsumeAiEmbedJobCompleteInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
}

export interface ConsumeAiEmbedJobFailInput extends ConsumeAiEmbedJobCompleteInput {
  readonly bizType?: 'ai_embedding' | 'ai_worker';
  readonly bizKey?: string;
  readonly reason?: string;
  readonly occurredAt?: Date;
  readonly error?: unknown;
}

@Injectable()
export class ConsumeAiGenerateJobUsecase {
  private readonly logger = new Logger(ConsumeAiGenerateJobUsecase.name);

  constructor(
    private readonly aiWorkerService: AiWorkerService,
    private readonly asyncTaskRecordService: AsyncTaskRecordService,
    private readonly aiProviderCallRecordService: AiProviderCallRecordService,
  ) {}

  async process(input: ConsumeAiGenerateJobProcessInput): Promise<GenerateAiContentResult> {
    const asyncTaskRecord = await recordAsyncTaskStarted(this.asyncTaskRecordService, {
      ...input,
      bizType: 'ai_generation',
      domain: 'ai_generation',
    });
    const providerStartedAt = input.startedAt ?? new Date();
    try {
      const result = await this.aiWorkerService.generate(input.payload);
      await recordProviderSucceededCall(this.aiProviderCallRecordService, this.logger, {
        jobInput: input,
        asyncTaskRecord,
        result: this.toProviderCallResult(result),
        taskType: 'generate',
        fallbackProviderStartedAt: providerStartedAt,
      });
      return result;
    } catch (providerError) {
      if (shouldRecordProviderCallFailure(providerError)) {
        await recordProviderFailedCall(this.aiProviderCallRecordService, this.logger, {
          jobInput: input,
          asyncTaskRecord,
          providerError,
          taskType: 'generate',
          fallbackProvider: input.payload.provider ?? 'unknown',
          payloadModel: input.payload.model,
          providerStartedAt,
        });
      } else {
        this.logger.warn(
          'skip generate provider failed call record because request was not attempted',
          {
            traceId: input.traceId,
            jobId: input.jobId,
          },
        );
      }
      throw providerError;
    }
  }

  async complete(input: ConsumeAiGenerateJobCompleteInput): Promise<void> {
    await recordAsyncTaskFinished(this.asyncTaskRecordService, {
      ...input,
      bizType: 'ai_generation',
      domain: 'ai_generation',
      status: 'succeeded',
      reason: 'worker_completed',
      occurredAt: input.finishedAt,
    });
  }

  async fail(input: ConsumeAiGenerateJobFailInput): Promise<void> {
    const bizType = input.bizType ?? 'ai_generation';
    await recordAsyncTaskFinished(this.asyncTaskRecordService, {
      ...input,
      bizType,
      domain: 'ai_generation',
      status: 'failed',
      reason: resolveFailReason({ bizType, reason: input.reason }),
      bizKey:
        input.bizKey ??
        resolveFailBizKey({
          bizType,
          traceId: input.traceId,
          jobId: input.jobId,
          domain: 'ai_generation',
        }),
      occurredAt: input.occurredAt ?? input.finishedAt,
    });
  }

  private toProviderCallResult(result: GenerateAiContentResult): AiWorkerProviderCallResult {
    return {
      provider: result.provider,
      model: result.model,
      providerRequestId: result.providerRequestId ?? result.providerJobId,
      promptTokens: result.promptTokens ?? null,
      completionTokens: result.completionTokens ?? null,
      costAmount: result.costAmount ?? null,
      costCurrency: result.costCurrency ?? null,
      providerStartedAt: result.providerStartedAt ?? null,
      providerFinishedAt: result.providerFinishedAt ?? null,
    };
  }
}

@Injectable()
export class ConsumeAiEmbedJobUsecase {
  private readonly logger = new Logger(ConsumeAiEmbedJobUsecase.name);

  constructor(
    private readonly aiWorkerService: AiWorkerService,
    private readonly asyncTaskRecordService: AsyncTaskRecordService,
    private readonly aiProviderCallRecordService: AiProviderCallRecordService,
  ) {}

  async process(input: ConsumeAiEmbedJobProcessInput): Promise<EmbedAiContentResult> {
    const asyncTaskRecord = await recordAsyncTaskStarted(this.asyncTaskRecordService, {
      ...input,
      bizType: 'ai_embedding',
      domain: 'ai_embedding',
    });
    const providerStartedAt = input.startedAt ?? new Date();
    try {
      const result = await this.aiWorkerService.embed(input.payload);
      await recordProviderSucceededCall(this.aiProviderCallRecordService, this.logger, {
        jobInput: input,
        asyncTaskRecord,
        result: this.toProviderCallResult(result),
        taskType: 'embed',
        fallbackProviderStartedAt: providerStartedAt,
      });
      return result;
    } catch (providerError) {
      if (shouldRecordProviderCallFailure(providerError)) {
        await recordProviderFailedCall(this.aiProviderCallRecordService, this.logger, {
          jobInput: input,
          asyncTaskRecord,
          providerError,
          taskType: 'embed',
          fallbackProvider: 'mock',
          payloadModel: input.payload.model,
          providerStartedAt,
        });
      } else {
        this.logger.warn(
          'skip embed provider failed call record because request was not attempted',
          {
            traceId: input.traceId,
            jobId: input.jobId,
          },
        );
      }
      throw providerError;
    }
  }

  async complete(input: ConsumeAiEmbedJobCompleteInput): Promise<void> {
    await recordAsyncTaskFinished(this.asyncTaskRecordService, {
      ...input,
      bizType: 'ai_embedding',
      domain: 'ai_embedding',
      status: 'succeeded',
      reason: 'worker_completed',
      occurredAt: input.finishedAt,
    });
  }

  async fail(input: ConsumeAiEmbedJobFailInput): Promise<void> {
    const bizType = input.bizType ?? 'ai_embedding';
    await recordAsyncTaskFinished(this.asyncTaskRecordService, {
      ...input,
      bizType,
      domain: 'ai_embedding',
      status: 'failed',
      reason: resolveFailReason({ bizType, reason: input.reason }),
      bizKey:
        input.bizKey ??
        resolveFailBizKey({
          bizType,
          traceId: input.traceId,
          jobId: input.jobId,
          domain: 'ai_embedding',
        }),
      occurredAt: input.occurredAt ?? input.finishedAt,
    });
  }

  private toProviderCallResult(result: EmbedAiContentResult): AiWorkerProviderCallResult {
    return {
      provider: result.provider,
      model: result.model,
      providerRequestId: result.providerRequestId ?? result.providerJobId,
      promptTokens: result.promptTokens ?? null,
      completionTokens: result.completionTokens ?? null,
      costAmount: result.costAmount ?? null,
      costCurrency: result.costCurrency ?? null,
      providerStartedAt: result.providerStartedAt ?? null,
      providerFinishedAt: result.providerFinishedAt ?? null,
    };
  }
}
