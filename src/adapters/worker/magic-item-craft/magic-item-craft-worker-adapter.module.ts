import { Module } from '@nestjs/common';
import { MagicItemCraftModule } from '@src/modules/magic-item-craft/magic-item-craft.module';
import { MagicItemCraftJobHandler } from './magic-item-craft-job.handler';
import { MagicItemCraftJobProcessor } from './magic-item-craft-job.processor';

@Module({
  imports: [MagicItemCraftModule],
  providers: [MagicItemCraftJobHandler, MagicItemCraftJobProcessor],
})
export class MagicItemCraftWorkerAdapterModule {}
