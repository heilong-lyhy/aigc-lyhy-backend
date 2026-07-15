import type {
  CapabilityCommand,
  CapabilityEvent,
  CapabilityId,
  CapabilityOperationKind,
  CapabilityQuery,
  CapabilityRequestContext,
  CapabilityResult,
} from '@app-types/common/capability.types';

export const CAPABILITY_QUERY_BUS = Symbol('CAPABILITY_QUERY_BUS');

export interface CapabilityDispatchInput<TPayload> {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationVersion?: string;
  readonly context?: CapabilityRequestContext;
  readonly idempotencyKey?: string;
  readonly dedupKey?: string;
  readonly payload: TPayload;
  readonly createdAt?: Date;
}

export type CapabilityCommandInput<TPayload> = CapabilityDispatchInput<TPayload>;

export type CapabilityQueryInput<TPayload> = CapabilityDispatchInput<TPayload>;

export interface CapabilityQueryBus {
  ask<TPayload, TResult>(query: CapabilityQueryInput<TPayload>): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityOperationHandler<TPayload = unknown, TResult = unknown> {
  readonly capability: CapabilityId;
  readonly operation: string;
  readonly operationKind: Exclude<CapabilityOperationKind, 'event'>;
  handle(
    envelope: CapabilityCommand<TPayload> | CapabilityQuery<TPayload>,
    signal?: AbortSignal,
  ): Promise<CapabilityResult<TResult>>;
}

export interface CapabilityEventSubscriber<TPayload = unknown> {
  readonly capability: CapabilityId;
  readonly event: string;
  handle(event: CapabilityEvent<TPayload>): Promise<CapabilityResult<void>>;
}
