// src/infrastructure/bullmq/bullmq.constants.ts
export const BULLMQ_QUEUES = {
  EMAIL: 'email',
  AI: 'ai',
  MAGIC_ITEM_CRAFT: 'magic_item_craft',
} as const;

export type BullMqQueueName = (typeof BULLMQ_QUEUES)[keyof typeof BULLMQ_QUEUES];

export const BULLMQ_JOBS = {
  EMAIL: {
    SEND: 'send',
  },
  AI: {
    GENERATE: 'generate',
    EMBED: 'embed',
  },
  MAGIC_ITEM_CRAFT: {
    CRAFT: 'craft',
  },
} as const;

export type BullMqEmailJobName = (typeof BULLMQ_JOBS.EMAIL)[keyof typeof BULLMQ_JOBS.EMAIL];
export type BullMqAiJobName = (typeof BULLMQ_JOBS.AI)[keyof typeof BULLMQ_JOBS.AI];
export type BullMqMagicItemCraftJobName =
  (typeof BULLMQ_JOBS.MAGIC_ITEM_CRAFT)[keyof typeof BULLMQ_JOBS.MAGIC_ITEM_CRAFT];

export const BULLMQ_QUEUE_JOBS: Readonly<Record<BullMqQueueName, ReadonlyArray<string>>> = {
  [BULLMQ_QUEUES.EMAIL]: Object.values(BULLMQ_JOBS.EMAIL),
  [BULLMQ_QUEUES.AI]: Object.values(BULLMQ_JOBS.AI),
  [BULLMQ_QUEUES.MAGIC_ITEM_CRAFT]: Object.values(BULLMQ_JOBS.MAGIC_ITEM_CRAFT),
};
