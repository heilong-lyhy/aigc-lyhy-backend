// src/adapters/worker/magic-item-craft/magic-item-craft-job.mapper.ts
import type { Job } from 'bullmq';
import type {
  ConsumeMagicItemCraftJobCompleteInput,
  ConsumeMagicItemCraftJobFailInput,
} from '@src/usecases/magic-item-craft/consume-magic-item-craft.usecase';
import type { ConsumeMagicItemCraftJobProcessInput } from '@src/usecases/magic-item-craft/consume-magic-item-craft.usecase';
import type { MagicItemCraftJobPayload } from '@src/modules/magic-item-craft/magic-item-craft.types';
import type { MagicItemCraftResult } from '@src/usecases/magic-item-craft/consume-magic-item-craft.usecase';
import {
  resolveDate,
  resolveJobId,
  resolveMaxAttempts,
  resolveMissingJobId,
  resolveMissingJobTraceId,
  resolveTraceId,
} from '../internal/job-mapper.helpers';

export const MAGIC_ITEM_CRAFT_QUEUE_NAME = 'magic_item_craft';
export const MAGIC_ITEM_CRAFT_JOB_NAME = 'craft';

export type MagicItemCraftJob = Job<
  MagicItemCraftJobPayload,
  MagicItemCraftResult,
  typeof MAGIC_ITEM_CRAFT_JOB_NAME
>;

export type { MagicItemCraftResult };

export const isMagicItemCraftJob = (job: Job): job is MagicItemCraftJob => {
  return job.queueName === MAGIC_ITEM_CRAFT_QUEUE_NAME && job.name === MAGIC_ITEM_CRAFT_JOB_NAME;
};

export function mapMagicItemCraftJobToProcessInput(input: {
  readonly job: MagicItemCraftJob;
}): ConsumeMagicItemCraftJobProcessInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: MAGIC_ITEM_CRAFT_QUEUE_NAME,
    jobName: MAGIC_ITEM_CRAFT_JOB_NAME,
    jobId,
    traceId,
    payload: input.job.data,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
  };
}

export function mapMagicItemCraftJobToCompleteInput(input: {
  readonly job: MagicItemCraftJob;
}): ConsumeMagicItemCraftJobCompleteInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: MAGIC_ITEM_CRAFT_QUEUE_NAME,
    jobName: MAGIC_ITEM_CRAFT_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: resolveDate({ timestamp: input.job.finishedOn }),
  };
}

export function mapMagicItemCraftJobToFailInput(input: {
  readonly job: MagicItemCraftJob;
  readonly error: Error;
}): ConsumeMagicItemCraftJobFailInput {
  const occurredAt = resolveDate({ timestamp: input.job.finishedOn });
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'degraded' });
  return {
    queueName: MAGIC_ITEM_CRAFT_QUEUE_NAME,
    jobName: MAGIC_ITEM_CRAFT_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: occurredAt,
    occurredAt,
    reason: input.error.message.slice(0, 128),
    error: input.error,
  };
}

export function mapMissingMagicItemCraftJobToFailInput(input: {
  readonly error: Error;
  readonly occurredAt?: Date;
}): ConsumeMagicItemCraftJobFailInput {
  const occurredAt = input.occurredAt ?? new Date();
  const jobId = resolveMissingJobId({ occurredAt, jobName: MAGIC_ITEM_CRAFT_JOB_NAME });
  const traceId = resolveMissingJobTraceId({ occurredAt, jobName: MAGIC_ITEM_CRAFT_JOB_NAME });
  return {
    queueName: MAGIC_ITEM_CRAFT_QUEUE_NAME,
    jobName: MAGIC_ITEM_CRAFT_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: 0,
    enqueuedAt: occurredAt,
    finishedAt: occurredAt,
    occurredAt,
    reason: `worker_event_job_missing:${input.error.message.slice(0, 96)}`,
  };
}
