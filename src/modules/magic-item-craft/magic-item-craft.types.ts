import {
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
  MagicItemCraftTaskType,
} from './magic-item-craft-task.entity';

export { MagicItemCraftTaskQualityLevel, MagicItemCraftTaskStatus, MagicItemCraftTaskType };

export interface MagicItemCraftTaskView {
  readonly id: string;
  readonly traceId: string;
  readonly itemName: string;
  readonly itemType: MagicItemCraftTaskType;
  readonly materialLevel: number;
  readonly requestNote: string | null;
  readonly status: MagicItemCraftTaskStatus;
  readonly qualityLevel: MagicItemCraftTaskQualityLevel | null;
  readonly resultDescription: string | null;
  readonly failureReason: string | null;
  readonly craftLog: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateMagicItemCraftTaskInput {
  readonly itemName: string;
  readonly itemType: MagicItemCraftTaskType;
  readonly materialLevel: number;
  readonly requestNote?: string;
  readonly traceId?: string;
}

export interface QueueMagicItemCraftTaskInput extends CreateMagicItemCraftTaskInput {
  readonly actorAccountId?: number | null;
  readonly actorActiveRole?: string | null;
}

export interface QueueMagicItemCraftTaskResult {
  readonly id: string;
  readonly status: MagicItemCraftTaskStatus;
  readonly itemName: string;
  readonly createdAt: Date;
}
