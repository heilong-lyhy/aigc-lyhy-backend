import { Module } from '@nestjs/common';
import { AsyncTaskRecordModule } from '@src/modules/async-task-record/async-task-record.module';
import { MagicItemCraftModule } from '@src/modules/magic-item-craft/magic-item-craft.module';
import { MagicItemCraftQueueModule } from '@src/modules/common/magic-item-craft-queue/magic-item-craft-queue.module';
import { QueueMagicItemCraftUsecase } from './queue-magic-item-craft.usecase';
import { ConsumeMagicItemCraftUsecase } from './consume-magic-item-craft.usecase';
import { GetMagicItemCraftTaskUsecase } from './get-magic-item-craft-task.usecase';

@Module({
  imports: [MagicItemCraftModule, MagicItemCraftQueueModule, AsyncTaskRecordModule],
  providers: [
    QueueMagicItemCraftUsecase,
    ConsumeMagicItemCraftUsecase,
    GetMagicItemCraftTaskUsecase,
  ],
  exports: [QueueMagicItemCraftUsecase, ConsumeMagicItemCraftUsecase, GetMagicItemCraftTaskUsecase],
})
export class MagicItemCraftUsecasesModule {}
