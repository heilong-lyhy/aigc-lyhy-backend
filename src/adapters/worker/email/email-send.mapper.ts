// src/adapters/worker/email/email-send.mapper.ts
import type {
  ConsumeEmailJobCompleteInput,
  ConsumeEmailJobFailInput,
  ConsumeEmailJobProcessInput,
} from '@src/usecases/email-worker/consume-email-job.usecase';
import type { Job } from 'bullmq';
import {
  resolveDate,
  resolveJobId,
  resolveMaxAttempts,
  resolveMissingJobId,
  resolveMissingJobTraceId,
  resolveTraceId,
} from '../internal/job-mapper.helpers';

export const EMAIL_QUEUE_NAME = 'email';
export const EMAIL_SEND_JOB_NAME = 'send';

export interface EmailSendPayload {
  readonly to: string;
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly templateId?: string;
  readonly meta?: Readonly<Record<string, string>>;
  readonly traceId?: string;
}

export interface EmailSendResult {
  readonly accepted: boolean;
  readonly providerMessageId: string;
}

export type EmailSendJob = Job<EmailSendPayload, EmailSendResult, typeof EMAIL_SEND_JOB_NAME>;

export function mapEmailSendJobToProcessInput(input: {
  readonly job: EmailSendJob;
}): ConsumeEmailJobProcessInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: EMAIL_QUEUE_NAME,
    jobName: EMAIL_SEND_JOB_NAME,
    jobId,
    traceId,
    payload: input.job.data,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
  };
}

export function mapEmailSendJobToCompleteInput(input: {
  readonly job: EmailSendJob;
}): ConsumeEmailJobCompleteInput {
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'strict' });
  return {
    queueName: EMAIL_QUEUE_NAME,
    jobName: EMAIL_SEND_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: resolveDate({ timestamp: input.job.finishedOn }),
  };
}

export function mapEmailSendJobToFailInput(input: {
  readonly job: EmailSendJob;
  readonly error: Error;
}): ConsumeEmailJobFailInput {
  const occurredAt = resolveDate({ timestamp: input.job.finishedOn });
  const jobId = resolveJobId({ job: input.job });
  const traceId = resolveTraceId({ job: input.job, mode: 'degraded' });
  return {
    queueName: EMAIL_QUEUE_NAME,
    jobName: EMAIL_SEND_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: input.job.attemptsMade,
    maxAttempts: resolveMaxAttempts({ job: input.job }),
    enqueuedAt: resolveDate({ timestamp: input.job.timestamp }),
    startedAt: resolveDate({ timestamp: input.job.processedOn }),
    finishedAt: occurredAt,
    occurredAt,
    reason: input.error.message.slice(0, 128),
  };
}

export function mapMissingEmailSendJobToFailInput(input: {
  readonly error: Error;
  readonly occurredAt?: Date;
}): ConsumeEmailJobFailInput {
  const occurredAt = input.occurredAt ?? new Date();
  const jobId = resolveMissingJobId({ occurredAt, jobName: EMAIL_SEND_JOB_NAME });
  const traceId = resolveMissingJobTraceId({ occurredAt, jobName: EMAIL_SEND_JOB_NAME });
  return {
    queueName: EMAIL_QUEUE_NAME,
    jobName: EMAIL_SEND_JOB_NAME,
    jobId,
    traceId,
    attemptsMade: 0,
    enqueuedAt: occurredAt,
    finishedAt: occurredAt,
    occurredAt,
    reason: `worker_event_job_missing:${input.error.message.slice(0, 96)}`,
  };
}
