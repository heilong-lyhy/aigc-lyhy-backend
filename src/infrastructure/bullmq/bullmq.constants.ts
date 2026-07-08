// src/infrastructure/bullmq/bullmq.constants.ts
// Re-export queue/job name constants from the types layer.
// Infrastructure-only details (e.g. BULLMQ_QUEUE_JOBS mapping) remain here.

import {
  BULLMQ_JOBS,
  BULLMQ_QUEUES,
  type BullMqQueueName,
  type BullMqEmailJobName,
  type BullMqAiJobName,
  type BullMqCapabilityJobName,
  type BullMqMagicItemCraftJobName,
} from '@app-types/worker/bullmq.types';

export {
  BULLMQ_QUEUES,
  BULLMQ_JOBS,
  type BullMqQueueName,
  type BullMqEmailJobName,
  type BullMqAiJobName,
  type BullMqCapabilityJobName,
  type BullMqMagicItemCraftJobName,
};

export const BULLMQ_QUEUE_JOBS: Readonly<Record<BullMqQueueName, ReadonlyArray<string>>> = {
  [BULLMQ_QUEUES.EMAIL]: Object.values(BULLMQ_JOBS.EMAIL),
  [BULLMQ_QUEUES.AI]: Object.values(BULLMQ_JOBS.AI),
  [BULLMQ_QUEUES.CAPABILITY]: Object.values(BULLMQ_JOBS.CAPABILITY),
  [BULLMQ_QUEUES.MAGIC_ITEM_CRAFT]: Object.values(BULLMQ_JOBS.MAGIC_ITEM_CRAFT),
};
