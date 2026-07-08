// src/infrastructure/bullmq/contracts/capability-queue.runtime.ts
import type { CapabilityDispatchJobPayload } from '@app-types/worker/capability-queue.types';
import { BULLMQ_JOBS } from '@app-types/worker/bullmq.types';

export type {
  CapabilityDispatchJobPayload,
  RestoredCapabilityEnvelope,
  SerializedCapabilityEnvelope,
  SerializedCapabilityRequestContext,
} from '@app-types/worker/capability-queue.types';

export { restoreCapabilityEnvelope } from '@app-types/worker/capability-queue.types';

export const CAPABILITY_JOB_CONTRACT = {
  [BULLMQ_JOBS.CAPABILITY.DISPATCH]: {
    payload: {} as CapabilityDispatchJobPayload,
    result: {} as { readonly ok: boolean },
    payloadValidator: isCapabilityDispatchJobPayload,
  },
} as const;

function isCapabilityDispatchJobPayload(value: unknown): value is CapabilityDispatchJobPayload {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    isSerializedCapabilityEnvelope(value.envelope) &&
    typeof value.traceId === 'string' &&
    value.traceId.trim().length > 0 &&
    typeof value.requestId === 'string' &&
    value.requestId.trim().length > 0
  );
}

function isSerializedCapabilityEnvelope(
  value: unknown,
): value is import('@app-types/worker/capability-queue.types').SerializedCapabilityEnvelope {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    typeof value.capability === 'string' &&
    typeof value.operation === 'string' &&
    isCapabilityOperationKind(value.operationKind) &&
    isSerializedRequestContext(value.context) &&
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt))
  );
}

function isSerializedRequestContext(
  value: unknown,
): value is import('@app-types/worker/capability-queue.types').SerializedCapabilityRequestContext {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    typeof value.traceId === 'string' &&
    value.traceId.trim().length > 0 &&
    typeof value.requestId === 'string' &&
    value.requestId.trim().length > 0 &&
    isObjectRecord(value.actor) &&
    typeof value.actor.source === 'string'
  );
}

function isCapabilityOperationKind(
  value: unknown,
): value is import('@app-types/common/capability.types').CapabilityOperationKind {
  return value === 'command' || value === 'query' || value === 'event';
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
