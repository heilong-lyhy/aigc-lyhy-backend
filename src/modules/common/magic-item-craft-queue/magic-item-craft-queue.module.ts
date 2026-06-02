import { Module } from '@nestjs/common';
import { BullMqModule } from '@src/infrastructure/bullmq/bullmq.module';
import { MagicItemCraftQueueService } from './magic-item-craft-queue.service';

@Module({
  imports: [BullMqModule],
  providers: [MagicItemCraftQueueService],
  exports: [MagicItemCraftQueueService],
})
export class MagicItemCraftQueueModule {}
