// src/usecases/magic-item-craft/consume-magic-item-craft.helper.ts
// Magic Item Craft Worker Usecase 共享逻辑

import {
  resolveAsyncTaskBizKey,
  type AsyncTaskBizDomain,
} from '@src/core/common/async-task/async-task-identifier.policy';
import { normalizeOptionalText } from '@src/core/common/input-normalize/input-normalize.policy';
import { AsyncTaskRecordService } from '@src/modules/async-task-record/async-task-record.service';
import type { AsyncTaskRecordSource } from '@src/modules/async-task-record/async-task-record.types';

// ─── 共享类型 ───

export interface MagicItemCraftWorkerJobBaseInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
}

export interface MagicItemCraftWorkerJobCompleteInput extends MagicItemCraftWorkerJobBaseInput {
  readonly finishedAt?: Date;
}

export interface MagicItemCraftWorkerJobFailInput extends MagicItemCraftWorkerJobCompleteInput {
  readonly bizType?: string;
  readonly bizKey?: string;
  readonly reason?: string;
  readonly occurredAt?: Date;
  readonly error?: unknown;
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
  if (input.bizType === 'magic_item_craft_worker') {
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
  if (input.bizType === 'magic_item_craft_worker') {
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
  input: MagicItemCraftWorkerJobBaseInput & {
    readonly bizType: string;
    readonly domain: AsyncTaskBizDomain;
  },
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
  input: MagicItemCraftWorkerJobCompleteInput & {
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

// ─── 模块级辅助函数 ───

function normalizeWorkerFailReason(reason?: string): string {
  return (
    normalizeOptionalText(reason, 'to_undefined', { fieldName: 'worker_reason' }) ??
    'worker_unknown_error'
  );
}
