// src/usecases/magic-item-craft/consume-magic-item-craft.usecase.ts
import { Injectable, Logger } from '@nestjs/common';
import { MagicItemCraftTaskQualityLevel } from '@app-types/models/magic-item-craft.types';
import type { MagicItemCraftJobPayload } from '@src/modules/magic-item-craft/magic-item-craft.types';
import { MagicItemCraftService } from '@src/modules/magic-item-craft/magic-item-craft.service';
import { AsyncTaskRecordService } from '@src/modules/async-task-record/async-task-record.service';
import { DomainError, MAGIC_ITEM_CRAFT_ERROR } from '@src/core/common/errors/domain-error';
import {
  recordAsyncTaskStarted,
  recordAsyncTaskFinished,
  resolveFailBizKey,
  resolveFailReason,
  type MagicItemCraftWorkerJobBaseInput,
  type MagicItemCraftWorkerJobCompleteInput,
  type MagicItemCraftWorkerJobFailInput,
} from './consume-magic-item-craft.helper';

export type { MagicItemCraftWorkerJobBaseInput as ConsumeMagicItemCraftJobBaseInput };
export type { MagicItemCraftWorkerJobCompleteInput as ConsumeMagicItemCraftJobCompleteInput };
export type { MagicItemCraftWorkerJobFailInput as ConsumeMagicItemCraftJobFailInput };

export interface ConsumeMagicItemCraftJobProcessInput extends MagicItemCraftWorkerJobBaseInput {
  readonly payload: MagicItemCraftJobPayload;
}

export interface MagicItemCraftResult {
  readonly accepted: boolean;
  readonly qualityLevel: MagicItemCraftTaskQualityLevel;
  readonly resultDescription: string;
  readonly craftLog: string;
}

@Injectable()
export class ConsumeMagicItemCraftUsecase {
  private readonly logger = new Logger(ConsumeMagicItemCraftUsecase.name);

  constructor(
    private readonly magicItemCraftService: MagicItemCraftService,
    private readonly asyncTaskRecordService: AsyncTaskRecordService,
  ) {}

  async process(input: ConsumeMagicItemCraftJobProcessInput): Promise<MagicItemCraftResult> {
    await recordAsyncTaskStarted(this.asyncTaskRecordService, {
      ...input,
      bizType: 'magic_item_craft',
      domain: 'magic_item_craft',
    });

    this.logger.log(`Processing magic item craft task: ${input.traceId}`);
    await this.magicItemCraftService.updateTaskToProcessing(input.traceId);

    const craftResult = this.generateCraftResult(input.payload);

    await this.magicItemCraftService.updateTaskToSucceeded({
      traceId: input.traceId,
      qualityLevel: craftResult.qualityLevel,
      resultDescription: craftResult.resultDescription,
      craftLog: craftResult.craftLog,
    });

    return {
      accepted: true,
      qualityLevel: craftResult.qualityLevel,
      resultDescription: craftResult.resultDescription,
      craftLog: craftResult.craftLog,
    };
  }

  async complete(input: MagicItemCraftWorkerJobCompleteInput): Promise<void> {
    await recordAsyncTaskFinished(this.asyncTaskRecordService, {
      ...input,
      bizType: 'magic_item_craft',
      domain: 'magic_item_craft',
      status: 'succeeded',
      reason: 'worker_completed',
      occurredAt: input.finishedAt,
    });
    this.logger.log(`Magic item craft job completed: ${input.traceId}`);
  }

  async fail(input: MagicItemCraftWorkerJobFailInput): Promise<void> {
    const bizType = input.bizType ?? 'magic_item_craft';
    await recordAsyncTaskFinished(this.asyncTaskRecordService, {
      ...input,
      bizType,
      domain: 'magic_item_craft',
      status: 'failed',
      reason: resolveFailReason({ bizType, reason: input.reason }),
      bizKey:
        input.bizKey ??
        resolveFailBizKey({
          bizType,
          traceId: input.traceId,
          jobId: input.jobId,
          domain: 'magic_item_craft',
        }),
      occurredAt: input.occurredAt ?? input.finishedAt,
    });

    this.logger.error(`Magic item craft job failed: ${input.traceId}`, input.error);
    await this.magicItemCraftService.updateTaskToFailed({
      traceId: input.traceId,
      failureReason: input.reason ?? 'Unknown error',
    });
  }

  private generateCraftResult(input: MagicItemCraftJobPayload): {
    qualityLevel: MagicItemCraftTaskQualityLevel;
    resultDescription: string;
    craftLog: string;
  } {
    const qualityLevels = [
      MagicItemCraftTaskQualityLevel.COMMON,
      MagicItemCraftTaskQualityLevel.RARE,
      MagicItemCraftTaskQualityLevel.EPIC,
      MagicItemCraftTaskQualityLevel.LEGENDARY,
    ];
    const randomQuality = qualityLevels[Math.floor(Math.random() * qualityLevels.length)];

    const materialDescriptions: Record<string, string> = {
      LEVEL_1: '普通的',
      LEVEL_2: '精良的',
      LEVEL_3: '优质的',
      LEVEL_4: '珍稀的',
      LEVEL_5: '极品的',
    };

    const typeDescriptions: Record<string, string> = {
      WEAPON: '武器',
      ARMOR: '护甲',
      TOOL: '工具',
      TOY: '玩具',
    };

    const qualityDescriptions: Record<string, string> = {
      COMMON: '普通的',
      RARE: '精致的',
      EPIC: '华丽的',
      LEGENDARY: '传说级的',
    };

    const materialKey = `LEVEL_${input.materialLevel}`;
    const materialDesc = materialDescriptions[materialKey];
    if (!materialDesc) {
      throw new DomainError(
        MAGIC_ITEM_CRAFT_ERROR.INVALID_MATERIAL_LEVEL,
        `invalid_material_level:${input.materialLevel}`,
      );
    }

    const typeDesc = typeDescriptions[input.itemType];
    if (!typeDesc) {
      throw new DomainError(
        MAGIC_ITEM_CRAFT_ERROR.INVALID_ITEM_TYPE,
        `invalid_item_type:${input.itemType}`,
      );
    }

    const description = `${materialDesc}${typeDesc}: ${input.itemName}`;
    const fullDescription = `${qualityDescriptions[randomQuality]}的${description}！这件道具散发着神秘的光芒，蕴含着强大的魔力。`;

    const craftLogLines = [
      `[${new Date().toISOString()}] 开始制作道具: ${input.itemName}`,
      `[${new Date().toISOString()}] 材料等级: ${input.materialLevel}`,
      `[${new Date().toISOString()}] 注入基础魔力...`,
      `[${new Date().toISOString()}] 刻画魔法符文...`,
      `[${new Date().toISOString()}] 品质评估: ${randomQuality}`,
      `[${new Date().toISOString()}] 制作完成！`,
    ];

    return {
      qualityLevel: randomQuality,
      resultDescription: fullDescription,
      craftLog: craftLogLines.join('\n'),
    };
  }
}
