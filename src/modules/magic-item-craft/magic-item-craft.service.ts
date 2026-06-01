import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  MagicItemCraftTaskView,
  QueueMagicItemCraftTaskInput,
  QueueMagicItemCraftTaskResult,
} from './magic-item-craft.types';
import {
  MagicItemCraftTaskEntity,
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
} from './magic-item-craft-task.entity';
import { BullMqProducerGateway } from '@src/infrastructure/bullmq/producer.gateway';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';

@Injectable()
export class MagicItemCraftService {
  constructor(
    @InjectRepository(MagicItemCraftTaskEntity)
    private readonly magicItemCraftTaskRepo: Repository<MagicItemCraftTaskEntity>,
    private readonly bullMqProducer: BullMqProducerGateway,
  ) {}

  async enqueueTask(
    input: QueueMagicItemCraftTaskInput,
    _occurredAt: Date,
  ): Promise<QueueMagicItemCraftTaskResult> {
    const job = await this.bullMqProducer.enqueue({
      queueName: BULLMQ_QUEUES.MAGIC_ITEM_CRAFT,
      jobName: BULLMQ_JOBS.MAGIC_ITEM_CRAFT.CRAFT,
      payload: {
        itemName: input.itemName,
        itemType: input.itemType,
        materialLevel: input.materialLevel,
        requestNote: input.requestNote,
        actorAccountId: input.actorAccountId ?? null,
        actorActiveRole: input.actorActiveRole ?? null,
        traceId: input.traceId,
      },
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

  async findById(id: string): Promise<MagicItemCraftTaskEntity | null> {
    return this.magicItemCraftTaskRepo.findOne({ where: { id } });
  }

  async findByTraceId(traceId: string): Promise<MagicItemCraftTaskEntity | null> {
    return this.magicItemCraftTaskRepo.findOne({ where: { traceId } });
  }

  toView(entity: MagicItemCraftTaskEntity): MagicItemCraftTaskView {
    return {
      id: entity.id,
      traceId: entity.traceId,
      itemName: entity.itemName,
      itemType: entity.itemType,
      materialLevel: entity.materialLevel,
      requestNote: entity.requestNote,
      status: entity.status,
      qualityLevel: entity.qualityLevel,
      resultDescription: entity.resultDescription,
      failureReason: entity.failureReason,
      craftLog: entity.craftLog,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
