import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import { BullMqProducerGateway } from '@src/infrastructure/bullmq/producer.gateway';
import type {
  QueueMagicItemCraftJobInput,
  QueueMagicItemCraftJobResult,
} from './magic-item-craft-queue.types';

@Injectable()
export class MagicItemCraftQueueService {
  constructor(private readonly producer: BullMqProducerGateway) {}

  async enqueueCraftJob(input: QueueMagicItemCraftJobInput): Promise<QueueMagicItemCraftJobResult> {
    const job = await this.producer.enqueue({
      queueName: BULLMQ_QUEUES.MAGIC_ITEM_CRAFT,
      jobName: BULLMQ_JOBS.MAGIC_ITEM_CRAFT.CRAFT,
      payload: {
        itemName: input.itemName,
        itemType: input.itemType,
        materialLevel: input.materialLevel,
        requestNote: input.requestNote,
        traceId: input.traceId,
      },
      traceId: input.traceId,
    });

    return {
      jobId: job.jobId,
      traceId: job.traceId,
    };
  }
}
