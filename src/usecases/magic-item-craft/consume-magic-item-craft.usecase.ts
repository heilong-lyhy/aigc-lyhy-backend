import { Injectable, Logger } from '@nestjs/common';
import {
  MagicItemCraftTaskQualityLevel,
  type QueueMagicItemCraftTaskInput,
} from '@src/modules/magic-item-craft/magic-item-craft.types';
import { MagicItemCraftService } from '@src/modules/magic-item-craft/magic-item-craft.service';

export interface MagicItemCraftJobPayload extends QueueMagicItemCraftTaskInput {}

export interface ConsumeMagicItemCraftJobProcessInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly payload: MagicItemCraftJobPayload;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
}

export interface ConsumeMagicItemCraftJobCompleteInput {
  readonly queueName: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly traceId: string;
  readonly attemptsMade: number;
  readonly maxAttempts?: number;
  readonly enqueuedAt?: Date;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
}

export interface ConsumeMagicItemCraftJobFailInput extends ConsumeMagicItemCraftJobCompleteInput {
  readonly reason?: string;
  readonly occurredAt?: Date;
  readonly error?: unknown;
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

  constructor(private readonly magicItemCraftService: MagicItemCraftService) {}

  async process(input: ConsumeMagicItemCraftJobProcessInput): Promise<MagicItemCraftResult> {
    this.logger.log(`Processing magic item craft task: ${input.traceId}`);
    await this.magicItemCraftService.updateTaskToProcessing(input.traceId);

    const craftResult = this.generateMockCraftResult(input.payload);

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

  async complete(input: ConsumeMagicItemCraftJobCompleteInput): Promise<void> {
    this.logger.log(`Magic item craft job completed: ${input.traceId}`);
  }

  async fail(input: ConsumeMagicItemCraftJobFailInput): Promise<void> {
    this.logger.error(`Magic item craft job failed: ${input.traceId}`, input.error);
    await this.magicItemCraftService.updateTaskToFailed({
      traceId: input.traceId,
      failureReason: input.reason ?? 'Unknown error',
    });
  }

  private generateMockCraftResult(input: MagicItemCraftJobPayload): {
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
      '1': '普通的',
      '2': '精良的',
      '3': '优质的',
      '4': '珍稀的',
      '5': '极品的',
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

    const description = `${materialDescriptions[String(input.materialLevel)] || '普通的'}${typeDescriptions[input.itemType] || '物品'}: ${input.itemName}`;
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
