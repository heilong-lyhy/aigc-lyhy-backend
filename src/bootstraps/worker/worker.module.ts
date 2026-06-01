// src/bootstraps/worker/worker.module.ts
import { Module } from '@nestjs/common';
import { AiWorkerAdapterModule } from '@src/adapters/worker/ai/ai-worker-adapter.module';
import { EmailWorkerAdapterModule } from '@src/adapters/worker/email/email-worker-adapter.module';
import { MagicItemCraftWorkerAdapterModule } from '@src/adapters/worker/magic-item-craft/magic-item-craft-worker-adapter.module';
import { BullMqModule } from '@src/infrastructure/bullmq/bullmq.module';
import { BullMqWorkerRuntime } from '@src/infrastructure/bullmq/worker.runtime';
import { AppConfigModule } from '@src/infrastructure/config/config.module';
import { DatabaseModule } from '@src/infrastructure/database/database.module';
import { TypeOrmTransactionModule } from '@src/infrastructure/database/transaction/typeorm-transaction.module';
import { LoggerModule } from '@src/infrastructure/logger/logger.module';
import { RedisModule } from '@src/infrastructure/redis/redis.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    DatabaseModule,
    TypeOrmTransactionModule,
    RedisModule,
    BullMqModule,
    AiWorkerAdapterModule,
    EmailWorkerAdapterModule,
    MagicItemCraftWorkerAdapterModule,
  ],
  providers: [BullMqWorkerRuntime],
})
export class WorkerModule {}
