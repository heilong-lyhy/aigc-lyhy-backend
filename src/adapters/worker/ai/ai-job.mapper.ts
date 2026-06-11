// src/adapters/worker/ai/ai-job.mapper.ts
import type {
  ConsumeAiEmbedJobCompleteInput,
  ConsumeAiEmbedJobFailInput,
  ConsumeAiEmbedJobProcessInput,
  ConsumeAiGenerateJobCompleteInput,
  ConsumeAiGenerateJobFailInput,
  ConsumeAiGenerateJobProcessInput,
} from '@src/usecases/ai-worker/consume-ai-job.usecase';
import type { Job } from 'bullmq';
import {
  resolveDate,
  resolveFailedJobName,
  resolveJobId,
  resolveMaxAttempts,
  resolveMissingJobId,
  resolveMissingJobTraceId,
  resolveTraceId,
} from '../internal/job-mapper.helpers';

export const AI_QUEUE_NAME = 'ai';
export const AI_GENERATE_JOB_NAME = 'generate';
export const AI_EMBED_JOB_NAME = 'embed';

export interface AiGeneratePayload {
  readonly provider?: string;
  readonly model: string;
  readonly prompt: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly traceId?: string;
}

export interface AiGenerateResult {
  readonly accepted: boolean;
  readonly outputText: string;
  readonly provider: string;
  readonly model: string;
  readonly providerJobId: string;
  readonly providerRequestId?: string | null;
  readonly providerStatus?: 'succeeded' | 'failed';
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly costAmount?: string | null;
  readonly costCurrency?: string | null;
  readonly normalizedErrorCode?: string | null;
  readonly providerErrorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly providerStartedAt?: Date | null;
  readonly providerFinishedAt?: Date | null;
}

export interface AiEmbedPayload {
  readonly model: string;
  readonly text: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly traceId?: string;
}

export interface AiEmbedResult {
  readonly accepted: boolean;
  readonly vector: ReadonlyArray<number>;
  readonly provider: string;
  readonly model: string;
  readonly providerJobId: string;
  readonly providerRequestId?: string | null;
  readonly providerStatus?: 'succeeded' | 'failed';
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly costAmount?: string | null;
  readonly costCurrency?: string | null;
  readonly normalizedErrorCode?: string | null;
  readonly providerErrorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly providerStartedAt?: Date | null;
  readonly providerFinishedAt?: Date | null;
}

export type AiGenerateJob = Job<AiGeneratePayload, AiGenerateResult, typeof AI_GENERATE_JOB_NAME>;
export type AiEmbedJob = Job<AiEmbedPayload, AiEmbedResult, typeof AI_EMBED_JOB_NAME>;
export type AiJob = AiGenerateJob | AiEmbedJob;
export type AiJobResult = AiGenerateResult | AiEmbedResult;
export type AiFailedJob = Job<Record<string, unknown>, unknown, string>;

export function mapAiGenerateJobToProcessInput(input: {
  readonly job: AiGenerateJob;
}): ConsumeAiGenerateJobProcessInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: AI_QUEUE_NAME,
    jobName: AI_GENERATE_JOB_NAME,
    jobId,
    traceId,
    payload: input.job.data,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
  };
}

export function mapAiGenerateJobToCompleteInput(input: {
  readonly job: AiGenerateJob;
}): ConsumeAiGenerateJobCompleteInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: AI_QUEUE_NAME,
    jobName: AI_GENERATE_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: resolveDate({ timestamp: input.job.finishedOn }),
  };
}

export function mapAiGenerateJobToFailInput(input: {
  readonly job: AiGenerateJob;
  readonly error: Error;
}): ConsumeAiGenerateJobFailInput {
  const occurredAt = resolveDate({ timestamp: input.job.finishedOn });
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'degraded' });
  return {
    queueName: AI_QUEUE_NAME,
    jobName: AI_GENERATE_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: occurredAt,
    occurredAt,
    reason: resolveWorkerFailedReason({ message: input.error.message }),
    error: input.error,
  };
}

export function mapMissingAiJobToFailInput(input: {
  readonly error: Error;
  readonly occurredAt?: Date;
}): ConsumeAiGenerateJobFailInput {
  const occurredAt = input.occurredAt ?? new Date();
  const jobName = 'unknown';
  const jobId = resolveMissingJobId({ occurredAt, jobName });
  const traceId = resolveMissingJobTraceId({ occurredAt, jobName });
  return {
    queueName: AI_QUEUE_NAME,
    jobName,
    jobId,
    traceId,
    bizType: 'ai_worker',
    bizKey: traceId,
    attemptsMade: 0,
    enqueuedAt: occurredAt,
    finishedAt: occurredAt,
    occurredAt,
    reason: `worker_event_job_missing:${input.error.message.slice(0, 96)}`,
    error: input.error,
  };
}

export function mapUnknownAiJobToFailInput(input: {
  readonly job: AiFailedJob;
  readonly error: Error;
}): ConsumeAiGenerateJobFailInput {
  const occurredAt = resolveDate({ timestamp: input.job.finishedOn }) ?? new Date();
  const jobName = resolveFailedJobName({ job: input.job });
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'degraded' });
  return {
    queueName: AI_QUEUE_NAME,
    jobName,
    jobId,
    traceId,
    bizType: 'ai_worker',
    bizKey: traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: occurredAt,
    occurredAt,
    reason: `unsupported_ai_job:${jobName}:${input.error.message.slice(0, 96)}`,
    error: input.error,
  };
}

export function mapAiEmbedJobToProcessInput(input: {
  readonly job: AiEmbedJob;
}): ConsumeAiEmbedJobProcessInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: AI_QUEUE_NAME,
    jobName: AI_EMBED_JOB_NAME,
    jobId,
    traceId,
    payload: input.job.data,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
  };
}

export function mapAiEmbedJobToCompleteInput(input: {
  readonly job: AiEmbedJob;
}): ConsumeAiEmbedJobCompleteInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: AI_QUEUE_NAME,
    jobName: AI_EMBED_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: resolveDate({ timestamp: input.job.finishedOn }),
  };
}

export function mapAiEmbedJobToFailInput(input: {
  readonly job: AiEmbedJob;
  readonly error: Error;
}): ConsumeAiEmbedJobFailInput {
  const occurredAt = resolveDate({ timestamp: input.job.finishedOn });
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'degraded' });
  return {
    queueName: AI_QUEUE_NAME,
    jobName: AI_EMBED_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: occurredAt,
    occurredAt,
    reason: resolveWorkerFailedReason({ message: input.error.message }),
    error: input.error,
  };
}

// ─── AI 链路专用辅助 ───

function resolveWorkerFailedReason(input: { readonly message: string }): string {
  const normalizedMessage = input.message.trim() || 'worker_unknown_error';
  if (normalizedMessage.startsWith('worker_failed:')) {
    return normalizedMessage.slice(0, 128);
  }
  if (normalizedMessage.startsWith('missing_payload_trace_id')) {
    return normalizedMessage.slice(0, 128);
  }
  const prefix = 'worker_failed:';
  const availableSummaryLength = Math.max(128 - prefix.length, 1);
  const summary = normalizedMessage.slice(0, availableSummaryLength);
  return `${prefix}${summary}`;
}
