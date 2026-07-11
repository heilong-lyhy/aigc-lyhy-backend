// src/infrastructure/bullmq/contracts/job-contract.registry.ts
import { BULLMQ_JOBS, BULLMQ_QUEUES, type BullMqQueueName } from '../bullmq.constants';
import { AI_JOB_CONTRACT } from './ai-queue.runtime';
import { CAPABILITY_JOB_CONTRACT } from './capability-queue.runtime';
import { EMAIL_JOB_CONTRACT } from './email-queue.runtime';
import { MAGIC_ITEM_CRAFT_JOB_CONTRACT } from './magic-item-craft.runtime'; // [KEPT:业务保留]

type PayloadValidator<T> = (payload: unknown) => payload is T;

type QueueJobContractMap = {
  readonly [BULLMQ_QUEUES.EMAIL]: typeof EMAIL_JOB_CONTRACT;
  readonly [BULLMQ_QUEUES.AI]: typeof AI_JOB_CONTRACT;
  readonly [BULLMQ_QUEUES.CAPABILITY]: typeof CAPABILITY_JOB_CONTRACT;
  readonly [BULLMQ_QUEUES.MAGIC_ITEM_CRAFT]: typeof MAGIC_ITEM_CRAFT_JOB_CONTRACT; // [KEPT:业务保留]
};

export type BullMqJobName<Q extends BullMqQueueName> = keyof QueueJobContractMap[Q] & string;

type BullMqJobContractEntry<
  Q extends BullMqQueueName,
  J extends BullMqJobName<Q>,
> = QueueJobContractMap[Q][J] extends { readonly payload: unknown; readonly result: unknown }
  ? QueueJobContractMap[Q][J]
  : never;

export type BullMqJobPayload<
  Q extends BullMqQueueName,
  J extends BullMqJobName<Q>,
> = BullMqJobContractEntry<Q, J>['payload'];

export type BullMqJobResult<
  Q extends BullMqQueueName,
  J extends BullMqJobName<Q>,
> = BullMqJobContractEntry<Q, J>['result'];

export const BULLMQ_JOB_PAYLOAD_VALIDATORS = {
  [BULLMQ_QUEUES.EMAIL]: {
    [BULLMQ_JOBS.EMAIL.SEND]: EMAIL_JOB_CONTRACT[BULLMQ_JOBS.EMAIL.SEND].payloadValidator,
  },
  [BULLMQ_QUEUES.AI]: {
    [BULLMQ_JOBS.AI.GENERATE]: AI_JOB_CONTRACT[BULLMQ_JOBS.AI.GENERATE].payloadValidator,
    [BULLMQ_JOBS.AI.EMBED]: AI_JOB_CONTRACT[BULLMQ_JOBS.AI.EMBED].payloadValidator,
    [BULLMQ_JOBS.AI.WORKFLOW]: AI_JOB_CONTRACT[BULLMQ_JOBS.AI.WORKFLOW].payloadValidator,
  },
  [BULLMQ_QUEUES.CAPABILITY]: {
    [BULLMQ_JOBS.CAPABILITY.DISPATCH]:
      CAPABILITY_JOB_CONTRACT[BULLMQ_JOBS.CAPABILITY.DISPATCH].payloadValidator,
  },
  [BULLMQ_QUEUES.MAGIC_ITEM_CRAFT]: {
    // [KEPT:业务保留]
    [BULLMQ_JOBS.MAGIC_ITEM_CRAFT.CRAFT]:
      MAGIC_ITEM_CRAFT_JOB_CONTRACT[BULLMQ_JOBS.MAGIC_ITEM_CRAFT.CRAFT].payloadValidator,
  },
} as const satisfies {
  readonly [Q in BullMqQueueName]: {
    readonly [J in BullMqJobName<Q>]: PayloadValidator<BullMqJobPayload<Q, J>>;
  };
};

const getPayloadValidator = <Q extends BullMqQueueName, J extends BullMqJobName<Q>>(input: {
  readonly queueName: Q;
  readonly jobName: J;
}): PayloadValidator<BullMqJobPayload<Q, J>> => {
  const validatorsByQueue = BULLMQ_JOB_PAYLOAD_VALIDATORS[input.queueName] as {
    readonly [K in BullMqJobName<Q>]: PayloadValidator<BullMqJobPayload<Q, K>>;
  };
  return validatorsByQueue[input.jobName];
};

export function assertBullMqJobPayload<
  Q extends BullMqQueueName,
  J extends BullMqJobName<Q>,
>(input: {
  readonly queueName: Q;
  readonly jobName: J;
  readonly payload: unknown;
}): asserts input is {
  readonly queueName: Q;
  readonly jobName: J;
  readonly payload: BullMqJobPayload<Q, J>;
} {
  const validator = getPayloadValidator({ queueName: input.queueName, jobName: input.jobName });
  if (!validator(input.payload)) {
    throw new Error(`BullMQ job payload is invalid: ${input.queueName}/${input.jobName}`);
  }
}
