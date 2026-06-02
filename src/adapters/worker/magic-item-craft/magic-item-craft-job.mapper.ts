import type { Job } from 'bullmq';
import type {
  ConsumeMagicItemCraftJobCompleteInput,
  ConsumeMagicItemCraftJobFailInput,
  ConsumeMagicItemCraftJobProcessInput,
  MagicItemCraftJobPayload,
  MagicItemCraftResult,
} from '@src/usecases/magic-item-craft/consume-magic-item-craft.usecase';

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
  const traceId = resolveTraceId({
    job: input.job,
    mode: 'strict',
  });
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
  const traceId = resolveTraceId({
    job: input.job,
    mode: 'strict',
  });
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
  const traceId = resolveTraceId({
    job: input.job,
    mode: 'degraded',
  });
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
  const jobId = resolveMissingJobId({
    occurredAt,
    jobName: MAGIC_ITEM_CRAFT_JOB_NAME,
  });
  return {
    queueName: MAGIC_ITEM_CRAFT_QUEUE_NAME,
    jobName: MAGIC_ITEM_CRAFT_JOB_NAME,
    jobId,
    traceId: jobId,
    attemptsMade: 0,
    enqueuedAt: occurredAt,
    finishedAt: occurredAt,
    occurredAt,
    reason: `worker_event_job_missing:${input.error.message.slice(0, 96)}`,
  };
}

function resolveDate(input: { readonly timestamp?: number }): Date | undefined {
  if (typeof input.timestamp !== 'number' || Number.isNaN(input.timestamp)) {
    return undefined;
  }
  return new Date(input.timestamp);
}

function resolveMaxAttempts(input: { readonly job: MagicItemCraftJob }): number | undefined {
  const attempts = input.job.opts.attempts;
  if (typeof attempts !== 'number' || Number.isNaN(attempts)) {
    return undefined;
  }
  return attempts;
}

function resolveJobId(input: { readonly job: MagicItemCraftJob }): string {
  if (typeof input.job.id === 'number') {
    return String(input.job.id);
  }
  return input.job.id ?? `${MAGIC_ITEM_CRAFT_JOB_NAME}:${input.job.timestamp}`;
}

function resolveTraceId(input: {
  readonly job: MagicItemCraftJob;
  readonly mode: 'strict' | 'degraded';
}): string {
  const payloadTraceId = input.job.data.traceId?.trim();
  if (payloadTraceId) {
    return payloadTraceId;
  }
  if (input.mode === 'strict') {
    throw new Error(`missing_payload_trace_id:${input.job.name}`);
  }
  const jobId = resolveJobId({ job: input.job });
  return `degraded-trace:${input.job.name}:${jobId}`;
}

function resolveMissingJobId(input: {
  readonly occurredAt: Date;
  readonly jobName: string;
}): string {
  return `missing-job:${input.jobName}:${input.occurredAt.getTime()}`;
}
