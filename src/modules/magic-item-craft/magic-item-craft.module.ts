import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullMqModule } from '@src/infrastructure/bullmq/bullmq.module';
import { MagicItemCraftTaskEntity } from './magic-item-craft-task.entity';
import { MagicItemCraftService } from './magic-item-craft.service';
import { MagicItemCraftQueryService } from './queries/magic-item-craft.query.service';

@Module({
  imports: [TypeOrmModule.forFeature([MagicItemCraftTaskEntity]), BullMqModule],
  providers: [MagicItemCraftService, MagicItemCraftQueryService],
  exports: [TypeOrmModule, MagicItemCraftService, MagicItemCraftQueryService],
})
export class MagicItemCraftModule {}
