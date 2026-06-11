// src/adapters/worker/internal/job-mapper.helpers.ts
// Worker adapter 层共享的 BullMQ Job → usecase input 映射辅助函数
// 所有 worker mapper 复用同一组纯函数，避免同功能二次实现

import type { Job } from 'bullmq';

// ─── 通用 Job 类型约束 ───

/**
 * 所有 worker mapper 的 payload 至少需要可选 traceId
 * 用于 resolveTraceId 的 payload 读取
 */
interface TraceIdReadable {
  readonly traceId?: string;
}

// ─── 共享纯函数 ───

export function resolveDate(input: { readonly timestamp?: number }): Date | undefined {
  if (typeof input.timestamp !== 'number' || Number.isNaN(input.timestamp)) {
    return undefined;
  }
  return new Date(input.timestamp);
}

export function resolveMaxAttempts(input: { readonly job: Job }): number | undefined {
  const attempts = input.job.opts.attempts;
  if (typeof attempts !== 'number' || Number.isNaN(attempts)) {
    return undefined;
  }
  return attempts;
}

export function resolveJobId(input: { readonly job: Job }): string {
  if (typeof input.job.id === 'number') {
    return String(input.job.id);
  }
  return input.job.id ?? `${input.job.name}:${input.job.timestamp}`;
}

export function resolveTraceId(input: {
  readonly job: Job;
  readonly mode: 'strict' | 'degraded';
}): string {
  const payloadTraceId = resolvePayloadTraceId({ job: input.job });
  if (payloadTraceId) {
    return payloadTraceId;
  }
  if (input.mode === 'strict') {
    throw new Error(`missing_payload_trace_id:${input.job.name}`);
  }
  const jobId = resolveJobId({ job: input.job });
  return `degraded-trace:${input.job.name}:${jobId}`;
}

export function resolveMissingJobId(input: {
  readonly occurredAt: Date;
  readonly jobName: string;
}): string {
  return `missing-job:${input.jobName}:${input.occurredAt.getTime()}`;
}

/**
 * 降级场景下生成兜底 traceId，与 jobId 分离
 * 遵循 queue-identifiers.rules.md：jobId 负责任务唯一性，traceId 负责链路关联
 */
export function resolveMissingJobTraceId(input: {
  readonly occurredAt: Date;
  readonly jobName: string;
}): string {
  return `degraded-trace:missing-job:${input.jobName}:${input.occurredAt.getTime()}`;
}

export function resolveFailedJobName(input: { readonly job: Job }): string {
  const normalizedName = input.job.name.trim();
  return normalizedName || 'unknown';
}

// ─── 内部辅助 ───

function resolvePayloadTraceId(input: { readonly job: Job }): string | undefined {
  const payload = input.job.data as TraceIdReadable | undefined | null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const traceId = payload.traceId;
  if (typeof traceId !== 'string') {
    return undefined;
  }
  const normalizedTraceId = traceId.trim();
  return normalizedTraceId || undefined;
}
