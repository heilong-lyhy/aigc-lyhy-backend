import {
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
  MagicItemCraftTaskType,
} from '@app-types/models/magic-item-craft.types';

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

/**
 * Worker 消费侧 payload，仅包含业务所需字段
 * 不包含 actor 元数据（actorAccountId / actorActiveRole）
 */
export interface MagicItemCraftJobPayload {
  readonly itemName: string;
  readonly itemType: MagicItemCraftTaskType;
  readonly materialLevel: number;
  readonly requestNote?: string;
  readonly traceId?: string;
}
