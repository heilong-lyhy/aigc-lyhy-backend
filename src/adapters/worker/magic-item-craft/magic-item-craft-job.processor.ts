import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { MagicItemCraftJobHandler } from './magic-item-craft-job.handler';
import {
  MAGIC_ITEM_CRAFT_QUEUE_NAME,
  type MagicItemCraftJob,
  type MagicItemCraftResult,
} from './magic-item-craft-job.mapper';

@Injectable()
@Processor(MAGIC_ITEM_CRAFT_QUEUE_NAME)
export class MagicItemCraftJobProcessor extends WorkerHost {
  constructor(private readonly handler: MagicItemCraftJobHandler) {
    super();
  }

  async process(job: MagicItemCraftJob): Promise<MagicItemCraftResult> {
    return await this.handler.process({ job });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: MagicItemCraftJob): void {
    this.handler.onCompleted({ job });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: MagicItemCraftJob | undefined, error: Error): Promise<void> {
    await this.handler.onFailed({ job, error });
  }
}
