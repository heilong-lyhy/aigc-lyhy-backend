import { BULLMQ_JOBS, BULLMQ_QUEUES } from '../bullmq.constants';
import {
  isNonEmptyString,
  isOptionalNonEmptyString,
  isOptionalString,
  isRecord,
} from './shared-payload-validators';

export interface MagicItemCraftPayload {
  readonly itemName: string;
  readonly itemType: string;
  readonly materialLevel: number;
  readonly requestNote?: string;
  readonly actorAccountId?: number | null;
  readonly actorActiveRole?: string | null;
  readonly traceId?: string;
}

export interface MagicItemCraftResult {
  readonly accepted: boolean;
  readonly qualityLevel: string;
  readonly resultDescription: string;
  readonly craftLog: string;
}

const isMagicItemCraftPayload = (payload: unknown): payload is MagicItemCraftPayload => {
  if (!isRecord(payload)) return false;
  return (
    isNonEmptyString(payload.itemName) &&
    isNonEmptyString(payload.itemType) &&
    typeof payload.materialLevel === 'number' &&
    isOptionalString(payload.requestNote) &&
    isOptionalNonEmptyString(payload.traceId)
  );
};

export const MAGIC_ITEM_CRAFT_JOB_CONTRACT = {
  [BULLMQ_JOBS.MAGIC_ITEM_CRAFT.CRAFT]: {
    payload: {} as MagicItemCraftPayload,
    result: {} as MagicItemCraftResult,
    payloadValidator: isMagicItemCraftPayload,
  },
} as const;

export const MAGIC_ITEM_CRAFT_QUEUE_CONTRACT = {
  queueName: BULLMQ_QUEUES.MAGIC_ITEM_CRAFT,
  jobs: MAGIC_ITEM_CRAFT_JOB_CONTRACT,
} as const;
