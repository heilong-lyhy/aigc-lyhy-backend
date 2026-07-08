// src/infrastructure/bullmq/bullmq.constants.ts
export const BULLMQ_QUEUES = {
  EMAIL: 'email',
  AI: 'ai',
  CAPABILITY: 'capability', // [MERGED]
  MAGIC_ITEM_CRAFT: 'magic_item_craft', // [KEPT:业务保留]
} as const;

export type BullMqQueueName = (typeof BULLMQ_QUEUES)[keyof typeof BULLMQ_QUEUES];

export const BULLMQ_JOBS = {
  EMAIL: {
    SEND: 'send',
  },
  AI: {
    GENERATE: 'generate',
    EMBED: 'embed',
    WORKFLOW: 'workflow', // [MERGED]
  },
  CAPABILITY: {
    // [MERGED]
    DISPATCH: 'dispatch', // [MERGED]
  }, // [MERGED]
  MAGIC_ITEM_CRAFT: {
    // [KEPT:业务保留]
    CRAFT: 'craft', // [KEPT:业务保留]
  }, // [KEPT:业务保留]
} as const;

export type BullMqEmailJobName = (typeof BULLMQ_JOBS.EMAIL)[keyof typeof BULLMQ_JOBS.EMAIL];
export type BullMqAiJobName = (typeof BULLMQ_JOBS.AI)[keyof typeof BULLMQ_JOBS.AI];
export type BullMqCapabilityJobName =
  // [MERGED]
  (typeof BULLMQ_JOBS.CAPABILITY)[keyof typeof BULLMQ_JOBS.CAPABILITY]; // [MERGED]
export type BullMqMagicItemCraftJobName =
  // [KEPT:业务保留]
  (typeof BULLMQ_JOBS.MAGIC_ITEM_CRAFT)[keyof typeof BULLMQ_JOBS.MAGIC_ITEM_CRAFT]; // [KEPT:业务保留]

export const BULLMQ_QUEUE_JOBS: Readonly<Record<BullMqQueueName, ReadonlyArray<string>>> = {
  [BULLMQ_QUEUES.EMAIL]: Object.values(BULLMQ_JOBS.EMAIL),
  [BULLMQ_QUEUES.AI]: Object.values(BULLMQ_JOBS.AI),
  [BULLMQ_QUEUES.CAPABILITY]: Object.values(BULLMQ_JOBS.CAPABILITY), // [MERGED]
  [BULLMQ_QUEUES.MAGIC_ITEM_CRAFT]: Object.values(BULLMQ_JOBS.MAGIC_ITEM_CRAFT), // [KEPT:业务保留]
};
