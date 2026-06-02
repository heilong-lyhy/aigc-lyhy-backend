import { Module } from '@nestjs/common';
import { MagicItemCraftUsecasesModule } from '@src/usecases/magic-item-craft/magic-item-craft-usecases.module';
import { MagicItemCraftJobHandler } from './magic-item-craft-job.handler';
import { MagicItemCraftJobProcessor } from './magic-item-craft-job.processor';

@Module({
  imports: [MagicItemCraftUsecasesModule],
  providers: [MagicItemCraftJobHandler, MagicItemCraftJobProcessor],
})
export class MagicItemCraftWorkerAdapterModule {}
