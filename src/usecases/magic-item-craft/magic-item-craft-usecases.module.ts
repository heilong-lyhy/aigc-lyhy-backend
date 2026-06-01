import { Module } from '@nestjs/common';
import { MagicItemCraftModule } from '@src/modules/magic-item-craft/magic-item-craft.module';
import { QueueMagicItemCraftUsecase } from './queue-magic-item-craft.usecase';
import { GetMagicItemCraftTaskUsecase } from './get-magic-item-craft-task.usecase';

@Module({
  imports: [MagicItemCraftModule],
  providers: [QueueMagicItemCraftUsecase, GetMagicItemCraftTaskUsecase],
  exports: [QueueMagicItemCraftUsecase, GetMagicItemCraftTaskUsecase],
})
export class MagicItemCraftUsecasesModule {}
