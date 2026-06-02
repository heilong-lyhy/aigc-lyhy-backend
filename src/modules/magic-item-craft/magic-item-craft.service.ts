import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  QueueMagicItemCraftTaskInput,
  QueueMagicItemCraftTaskResult,
} from './magic-item-craft.types';
import {
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
} from '@app-types/models/magic-item-craft.types';
import { MagicItemCraftTaskEntity } from './magic-item-craft-task.entity';
import { MagicItemCraftQueueService } from '@modules/common/magic-item-craft-queue/magic-item-craft-queue.service';

@Injectable()
export class MagicItemCraftService {
  constructor(
    @InjectRepository(MagicItemCraftTaskEntity)
    private readonly magicItemCraftTaskRepo: Repository<MagicItemCraftTaskEntity>,
    private readonly magicItemCraftQueueService: MagicItemCraftQueueService,
  ) {}

  async enqueueTask(
    input: QueueMagicItemCraftTaskInput,
    _occurredAt: Date,
  ): Promise<QueueMagicItemCraftTaskResult> {
    const job = await this.magicItemCraftQueueService.enqueueCraftJob({
      itemName: input.itemName,
      itemType: input.itemType,
      materialLevel: input.materialLevel,
      requestNote: input.requestNote,
      actorAccountId: input.actorAccountId ?? null,
      actorActiveRole: input.actorActiveRole ?? null,
      traceId: input.traceId,
    });

    const entity = this.magicItemCraftTaskRepo.create({
      traceId: job.traceId,
      itemName: input.itemName,
      itemType: input.itemType,
      materialLevel: input.materialLevel,
      requestNote: input.requestNote ?? null,
      status: MagicItemCraftTaskStatus.PENDING,
    });

    const savedEntity = await this.magicItemCraftTaskRepo.save(entity);

    return {
      id: savedEntity.id,
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
