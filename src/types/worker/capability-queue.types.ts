// src/types/worker/capability-queue.types.ts
// Capability queue serialization protocol types.
// Lifted to types layer so adapters, modules, and infrastructure
// can reference these without creating illegal dependency directions.

import type {
  CapabilityActorContext,
  CapabilityCommand,
  CapabilityEvent,
  CapabilityId,
  CapabilityOperationKind,
  CapabilityQuery,
  CapabilityRequestContext,
} from '@app-types/common/capability.types';

export interface SerializedCapabilityRequestContext extends Omit<
  CapabilityRequestContext,
  'actor'
> {
  readonly actor: CapabilityActorContext;
}

export interface SerializedCapabilityEnvelope {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationKind: CapabilityOperationKind;
  readonly operationVersion?: string;
  readonly context: SerializedCapabilityRequestContext;
  readonly idempotencyKey?: string;
  readonly dedupKey?: string;
  readonly payload: unknown;
  readonly createdAt: string;
  readonly eventId?: string;
  readonly occurredAt?: string;
}

export interface CapabilityDispatchJobPayload {
  readonly envelope: SerializedCapabilityEnvelope;
  readonly traceId: string;
  readonly requestId: string;
}

export type RestoredCapabilityEnvelope =
  CapabilityCommand<unknown> | CapabilityQuery<unknown> | CapabilityEvent<unknown>;

export function restoreCapabilityEnvelope(
  payload: CapabilityDispatchJobPayload,
): RestoredCapabilityEnvelope {
  const base = {
    capability: payload.envelope.capability,
    operation: payload.envelope.operation,
    operationKind: payload.envelope.operationKind,
    ...(payload.envelope.operationVersion === undefined
      ? {}
      : { operationVersion: payload.envelope.operationVersion }),
    context: payload.envelope.context,
    ...(payload.envelope.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: payload.envelope.idempotencyKey }),
    ...(payload.envelope.dedupKey === undefined ? {} : { dedupKey: payload.envelope.dedupKey }),
    payload: payload.envelope.payload,
    createdAt: new Date(payload.envelope.createdAt),
  };
  if (payload.envelope.operationKind === 'event') {
    return {
      ...base,
      operationKind: 'event',
      eventId: payload.envelope.eventId ?? payload.envelope.context.requestId,
      occurredAt: new Date(payload.envelope.occurredAt ?? payload.envelope.createdAt),
    };
  }
  return payload.envelope.operationKind === 'command'
    ? { ...base, operationKind: 'command' }
    : { ...base, operationKind: 'query' };
}
