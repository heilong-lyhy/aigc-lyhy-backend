// src/usecases/ai-worker/consume-ai-job.helper.ts
// AI Worker Usecase 共享逻辑
// ConsumeAiGenerateJobUsecase 与 ConsumeAiEmbedJobUsecase 共享的辅助方法

import { Logger } from '@nestjs/common';
import {
  resolveAsyncTaskBizKey,
  type AsyncTaskBizDomain,
} from '@src/core/common/async-task/async-task-identifier.policy';
import { normalizeOptionalText } from '@src/core/common/input-normalize/input-normalize.policy';
import { THIRDPARTY_ERROR, isDomainError } from '@src/core/common/errors/domain-error';
import { AiProviderCallRecordService } from '@src/modules/ai-provider-call-record/ai-provider-call-record.service';
import { AsyncTaskRecordService } from '@src/modules/async-task-record/async-task-record.service';
import type { AsyncTaskRecordSource } from '@src/modules/async-task-record/async-task-record.types';

// ─── 共享类型 ───

export interface AiWorkerJobBaseInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
}

export interface AiWorkerJobCompleteInput extends AiWorkerJobBaseInput {
  readonly finishedAt?: Date;
}

export interface AiWorkerJobFailInput extends AiWorkerJobCompleteInput {
  readonly bizType?: string;
  readonly bizKey?: string;
  readonly reason?: string;
  readonly occurredAt?: Date;
  readonly error?: unknown;
}

export interface AiWorkerProviderCallResult {
  readonly provider: string;
  readonly model: string;
  readonly providerRequestId?: string | null;
  readonly providerJobId?: string | null;
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly costAmount?: string | null;
  readonly costCurrency?: string | null;
  readonly providerStartedAt?: Date | null;
  readonly providerFinishedAt?: Date | null;
}

// ─── 共享辅助函数 ───

export function resolveProcessingAttemptCount(attemptsMade: number): number {
  return Math.max(attemptsMade + 1, 1);
}

export function resolveFinalAttemptCount(attemptsMade: number): number {
  return Math.max(attemptsMade, 1);
}

export function resolveWorkerSource(): AsyncTaskRecordSource {
  return 'system';
}

export function resolveFailBizKey(input: {
  readonly bizType: string;
  readonly traceId: string;
  readonly jobId: string;
  readonly domain: AsyncTaskBizDomain;
}): string {
  if (input.bizType === 'ai_worker') {
    return input.traceId;
  }
  return resolveAsyncTaskBizKey({
    domain: input.domain,
    traceId: input.traceId,
    jobId: input.jobId,
  });
}

export function resolveFailReason(input: {
  readonly bizType: string;
  readonly reason?: string;
}): string {
  const normalizedReason = normalizeWorkerFailReason(input.reason);
  if (input.bizType === 'ai_worker') {
    return normalizedReason;
  }
  if (
    normalizedReason.startsWith('worker_failed:') ||
    normalizedReason.startsWith('missing_payload_trace_id')
  ) {
    return normalizedReason.slice(0, 128);
  }
  const prefix = 'worker_failed:';
  const availableSummaryLength = Math.max(128 - prefix.length, 1);
  const summary = normalizedReason.slice(0, availableSummaryLength);
  return `${prefix}${summary}`;
}

export async function recordAsyncTaskStarted(
  asyncTaskRecordService: AsyncTaskRecordService,
  input: AiWorkerJobBaseInput & { readonly bizType: string; readonly domain: AsyncTaskBizDomain },
): Promise<Awaited<ReturnType<AsyncTaskRecordService['recordStarted']>>> {
  return asyncTaskRecordService.recordStarted({
    data: {
      queueName: input.queueName,
      jobName: input.jobName,
      jobId: input.jobId,
      traceId: input.traceId,
      bizType: input.bizType,
      bizKey: resolveAsyncTaskBizKey({
        domain: input.domain,
        traceId: input.traceId,
        jobId: input.jobId,
      }),
      source: resolveWorkerSource(),
      reason: 'worker_processing',
      attemptCount: resolveProcessingAttemptCount(input.attemptsMade),
      maxAttempts: input.maxAttempts,
      enqueuedAt: input.enqueuedAt,
      startedAt: input.startedAt,
      occurredAt: input.startedAt,
    },
  });
}

export async function recordAsyncTaskFinished(
  asyncTaskRecordService: AsyncTaskRecordService,
  input: AiWorkerJobCompleteInput & {
    readonly bizType: string;
    readonly bizKey?: string;
    readonly domain: AsyncTaskBizDomain;
    readonly status: 'succeeded' | 'failed';
    readonly reason: string;
    readonly occurredAt?: Date;
  },
): Promise<void> {
  const resolvedBizKey =
    input.bizKey ??
    resolveAsyncTaskBizKey({
      domain: input.domain,
      traceId: input.traceId,
      jobId: input.jobId,
    });
  await asyncTaskRecordService.recordFinished({
    data: {
      queueName: input.queueName,
      jobName: input.jobName,
      jobId: input.jobId,
      traceId: input.traceId,
      bizType: input.bizType,
      bizKey: resolvedBizKey,
      source: resolveWorkerSource(),
      status: input.status,
      reason: input.reason,
      attemptCount: resolveFinalAttemptCount(input.attemptsMade),
      maxAttempts: input.maxAttempts,
      enqueuedAt: input.enqueuedAt,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      occurredAt: input.occurredAt,
    },
  });
}

export async function recordProviderSucceededCall(
  aiProviderCallRecordService: AiProviderCallRecordService,
  logger: Logger,
  input: {
    readonly jobInput: AiWorkerJobBaseInput;
    readonly asyncTaskRecord: Awaited<ReturnType<AsyncTaskRecordService['recordStarted']>>;
    readonly result: AiWorkerProviderCallResult;
    readonly taskType: 'generate' | 'embed';
    readonly fallbackProviderStartedAt: Date;
  },
): Promise<void> {
  const providerFinishedAt = input.result.providerFinishedAt ?? new Date();
  try {
    await aiProviderCallRecordService.createRecord({
      data: {
        asyncTaskRecordId: input.asyncTaskRecord.id,
        traceId: input.jobInput.traceId,
        bizType: input.asyncTaskRecord.bizType,
        bizKey: input.asyncTaskRecord.bizKey,
        bizSubKey: input.asyncTaskRecord.bizSubKey,
        source: resolveWorkerSource(),
        provider: input.result.provider,
        model: input.result.model,
        taskType: input.taskType,
        providerRequestId: input.result.providerRequestId ?? input.result.providerJobId,
        providerStatus: 'succeeded',
        promptTokens: input.result.promptTokens ?? null,
        completionTokens: input.result.completionTokens ?? null,
        costAmount: input.result.costAmount ?? null,
        costCurrency: input.result.costCurrency ?? null,
        providerStartedAt: input.result.providerStartedAt ?? input.fallbackProviderStartedAt,
        providerFinishedAt,
      },
    });
  } catch (auditWriteError) {
    logger.error(`${input.taskType} provider call record write failed after provider success`, {
      traceId: input.jobInput.traceId,
      jobId: input.jobInput.jobId,
      error: resolveUnknownErrorMessage(auditWriteError),
    });
  }
}

export async function recordProviderFailedCall(
  aiProviderCallRecordService: AiProviderCallRecordService,
  logger: Logger,
  input: {
    readonly jobInput: AiWorkerJobBaseInput;
    readonly asyncTaskRecord: Awaited<ReturnType<AsyncTaskRecordService['recordStarted']>>;
    readonly providerError: unknown;
    readonly taskType: 'generate' | 'embed';
    readonly fallbackProvider: string;
    readonly payloadModel: string;
    readonly providerStartedAt: Date;
  },
): Promise<void> {
  const providerFinishedAt = new Date();
  const errorContext = resolveProviderErrorContext(input.providerError);
  try {
    await aiProviderCallRecordService.createRecord({
      data: {
        asyncTaskRecordId: input.asyncTaskRecord.id,
        traceId: input.jobInput.traceId,
        bizType: input.asyncTaskRecord.bizType,
        bizKey: input.asyncTaskRecord.bizKey,
        bizSubKey: input.asyncTaskRecord.bizSubKey,
        source: resolveWorkerSource(),
        provider: resolveText(errorContext.provider) ?? input.fallbackProvider,
        model: input.payloadModel,
        taskType: input.taskType,
        providerRequestId: null,
        providerStatus: 'failed',
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        costAmount: null,
        costCurrency: null,
        normalizedErrorCode: errorContext.normalizedErrorCode,
        providerErrorCode: errorContext.providerErrorCode,
        errorMessage: errorContext.errorMessage,
        providerStartedAt: input.providerStartedAt,
        providerFinishedAt,
      },
    });
  } catch (auditWriteError) {
    logger.error(`${input.taskType} provider failed record write failed`, {
      traceId: input.jobInput.traceId,
      jobId: input.jobInput.jobId,
      providerError: resolveUnknownErrorMessage(input.providerError),
      auditWriteError: resolveUnknownErrorMessage(auditWriteError),
    });
  }
}

// ─── 模块级辅助函数 ───

function normalizeWorkerFailReason(reason?: string): string {
  return (
    normalizeOptionalText(reason, 'to_undefined', { fieldName: 'worker_reason' }) ??
    'worker_unknown_error'
  );
}

function resolveText(value: string | undefined | null): string | undefined {
  const normalized = normalizeOptionalText(value, 'to_undefined');
  return normalized ?? undefined;
}

function resolveProviderErrorContext(error: unknown): {
  readonly provider?: string;
  readonly normalizedErrorCode: string;
  readonly providerErrorCode: string | null;
  readonly errorMessage: string;
} {
  if (isDomainError(error)) {
    const details = resolveObject(error.details);
    const provider = resolveText(resolveString(details?.provider));
    const providerErrorCode = resolveText(resolveString(details?.providerErrorCode)) ?? null;
    return {
      provider,
      normalizedErrorCode: resolveText(error.message) ?? 'ai_provider_unknown_error',
      providerErrorCode,
      errorMessage: resolveText(error.message) ?? 'ai_provider_unknown_error',
    };
  }
  if (error instanceof Error) {
    const message = resolveText(error.message) ?? 'ai_provider_unknown_error';
    return {
      normalizedErrorCode: message,
      providerErrorCode: null,
      errorMessage: message,
    };
  }
  return {
    normalizedErrorCode: 'ai_provider_unknown_error',
    providerErrorCode: null,
    errorMessage: 'ai_provider_unknown_error',
  };
}

function resolveObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function resolveString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return value;
}

function resolveUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'unknown_error';
}

export function shouldRecordProviderCallFailure(error: unknown): boolean {
  if (!isDomainError(error)) {
    return false;
  }
  return error.code === THIRDPARTY_ERROR.PROVIDER_API_ERROR;
}
