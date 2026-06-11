import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
  MagicItemCraftTaskType,
} from '@app-types/models/magic-item-craft.types';
import { MagicItemCraftTaskEntity } from './magic-item-craft-task.entity';

@Injectable()
export class MagicItemCraftService {
  constructor(
    @InjectRepository(MagicItemCraftTaskEntity)
    private readonly magicItemCraftTaskRepo: Repository<MagicItemCraftTaskEntity>,
  ) {}

  async createTaskRecord(input: {
    readonly traceId: string;
    readonly itemName: string;
    readonly itemType: MagicItemCraftTaskType;
    readonly materialLevel: number;
    readonly requestNote?: string;
  }): Promise<{
    readonly id: string;
    readonly status: MagicItemCraftTaskStatus;
    readonly itemName: string;
    readonly createdAt: Date;
  }> {
    const entity = this.magicItemCraftTaskRepo.create({
      traceId: input.traceId,
      itemName: input.itemName,
      itemType: input.itemType,
      materialLevel: input.materialLevel,
      requestNote: input.requestNote ?? null,
      status: MagicItemCraftTaskStatus.PENDING,
    });

    const savedEntity = await this.magicItemCraftTaskRepo.save(entity);

    return {
      id: String(savedEntity.id),
      status: savedEntity.status,
      itemName: savedEntity.itemName,
      createdAt: savedEntity.createdAt,
    };
  }

  async updateTaskToProcessing(traceId: string): Promise<void> {
    await this.magicItemCraftTaskRepo.update(
      { traceId },
      { status: MagicItemCraftTaskStatus.PROCESSING },
    );
  }

  async updateTaskToSucceeded(input: {
    traceId: string;
    qualityLevel: MagicItemCraftTaskQualityLevel;
    resultDescription: string;
    craftLog: string;
  }): Promise<void> {
    await this.magicItemCraftTaskRepo.update(
      { traceId: input.traceId },
      {
        status: MagicItemCraftTaskStatus.SUCCEEDED,
        qualityLevel: input.qualityLevel,
        resultDescription: input.resultDescription,
        craftLog: input.craftLog,
      },
    );
  }

  async updateTaskToFailed(input: { traceId: string; failureReason: string }): Promise<void> {
    await this.magicItemCraftTaskRepo.update(
      { traceId: input.traceId },
      {
        status: MagicItemCraftTaskStatus.FAILED,
        failureReason: input.failureReason,
      },
    );
  }
}
