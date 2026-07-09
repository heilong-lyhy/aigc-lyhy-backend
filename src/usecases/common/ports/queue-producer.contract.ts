// src/usecases/common/ports/queue-producer.contract.ts
// Boundary contract for queue production.
// Modules depend on this abstract interface instead of the
// infrastructure-specific BullMqProducerGateway, allowing
// the queue runtime to be swapped without modifying modules.

import type { BullMqQueueName } from '@app-types/worker/bullmq.types';

export const QUEUE_PRODUCER = Symbol('QUEUE_PRODUCER');

export interface QueueProducerEnqueueInput {
  readonly queueName: BullMqQueueName;
  readonly jobName: string;
  readonly payload: unknown;
  readonly dedupKey?: string;
  readonly explicitJobId?: string;
  readonly traceId?: string;
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface QueueProducerEnqueueResult {
  readonly queueName: BullMqQueueName;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
}

export interface QueueProducerHasJobInput {
  readonly queueName: BullMqQueueName;
  readonly jobId: string;
}

export interface QueueProducerHasJobResult {
  readonly queueName: BullMqQueueName;
  readonly jobId: string;
  readonly exists: boolean;
}

export interface QueueProducerCheckInput {
  readonly queueName: BullMqQueueName;
}

export interface QueueProducerCheckResult {
  readonly queueName: BullMqQueueName;
  readonly available: true;
}

export interface QueueProducer {
  enqueue(input: QueueProducerEnqueueInput): Promise<QueueProducerEnqueueResult>;
  hasJob(input: QueueProducerHasJobInput): Promise<QueueProducerHasJobResult>;
  checkQueueAvailable(input: QueueProducerCheckInput): Promise<QueueProducerCheckResult>;
}
