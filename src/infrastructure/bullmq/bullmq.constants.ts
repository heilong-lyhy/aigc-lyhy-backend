// src/infrastructure/bullmq/bullmq.constants.ts
// Re-export queue/job constants from the types layer (single source of truth).
// Infrastructure-only mapping (BULLMQ_QUEUE_JOBS) remains here.
export { BULLMQ_QUEUES, BULLMQ_JOBS } from '@app-types/worker/bullmq.types';
export type {
  BullMqQueueName,
  BullMqEmailJobName,
  BullMqAiJobName,
  BullMqCapabilityJobName,
} from '@app-types/worker/bullmq.types';

import { BULLMQ_QUEUES, BULLMQ_JOBS, type BullMqQueueName } from '@app-types/worker/bullmq.types';

export const BULLMQ_QUEUE_JOBS: Readonly<Record<BullMqQueueName, ReadonlyArray<string>>> = {
  [BULLMQ_QUEUES.EMAIL]: Object.values(BULLMQ_JOBS.EMAIL),
  [BULLMQ_QUEUES.AI]: [BULLMQ_JOBS.AI.GENERATE, BULLMQ_JOBS.AI.EMBED],
  [BULLMQ_QUEUES.AI_WORKFLOW]: [BULLMQ_JOBS.AI.WORKFLOW],
  [BULLMQ_QUEUES.CAPABILITY]: Object.values(BULLMQ_JOBS.CAPABILITY),
};
