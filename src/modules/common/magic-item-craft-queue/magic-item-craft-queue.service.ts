import { Inject, Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@app-types/worker/bullmq.types';
import {
  QUEUE_PRODUCER,
  type QueueProducer,
} from '@src/usecases/common/ports/queue-producer.contract';
import type {
  QueueMagicItemCraftJobInput,
  QueueMagicItemCraftJobResult,
} from './magic-item-craft-queue.types';

@Injectable()
export class MagicItemCraftQueueService {
  constructor(@Inject(QUEUE_PRODUCER) private readonly producer: QueueProducer) {}

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
