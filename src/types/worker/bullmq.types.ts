// src/types/worker/bullmq.types.ts
// Queue and job name constants for BullMQ.
// Lifted to types layer so that adapters, modules, and infrastructure
// can reference these without creating a circular or illegal dependency.
// Infrastructure-only details (e.g. BULLMQ_QUEUE_JOBS mapping) remain
// in src/infrastructure/bullmq/bullmq.constants.ts.

export const BULLMQ_QUEUES = {
  EMAIL: 'email',
  AI: 'ai',
  CAPABILITY: 'capability',
  MAGIC_ITEM_CRAFT: 'magic-item-craft',
} as const;

export type BullMqQueueName = (typeof BULLMQ_QUEUES)[keyof typeof BULLMQ_QUEUES];

export const BULLMQ_JOBS = {
  EMAIL: {
    SEND: 'send',
  },
  AI: {
    GENERATE: 'generate',
    EMBED: 'embed',
    WORKFLOW: 'workflow',
  },
  CAPABILITY: {
    DISPATCH: 'dispatch',
  },
  MAGIC_ITEM_CRAFT: {
    CRAFT: 'craft',
  },
} as const;

export type BullMqEmailJobName = (typeof BULLMQ_JOBS.EMAIL)[keyof typeof BULLMQ_JOBS.EMAIL];
export type BullMqAiJobName = (typeof BULLMQ_JOBS.AI)[keyof typeof BULLMQ_JOBS.AI];
export type BullMqCapabilityJobName =
  (typeof BULLMQ_JOBS.CAPABILITY)[keyof typeof BULLMQ_JOBS.CAPABILITY];
export type BullMqMagicItemCraftJobName =
  (typeof BULLMQ_JOBS.MAGIC_ITEM_CRAFT)[keyof typeof BULLMQ_JOBS.MAGIC_ITEM_CRAFT];
