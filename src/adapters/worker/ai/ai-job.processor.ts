import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AiWorkerActivationUsecase } from '@src/usecases/ai-worker/ai-worker-activation.usecase';
import { UnrecoverableError } from 'bullmq';
import { AiJobHandler } from './ai-job.handler';
import {
  AI_EMBED_JOB_NAME,
  type AiExecutionJob,
  type AiExecutionJobResult,
  type AiFailedJob,
  AI_GENERATE_JOB_NAME,
  AI_QUEUE_NAME,
} from './ai-job.mapper';

@Injectable()
@Processor(AI_QUEUE_NAME, { autorun: false })
export class AiJobProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiJobProcessor.name);

  constructor(
    private readonly handler: AiJobHandler,
    private readonly workerActivation: AiWorkerActivationUsecase,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    if (!this.workerActivation.shouldRun()) return;
    void this.worker.run().catch((error: unknown) => {
      this.logger.error(
        'AI execution Worker stopped unexpectedly',
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async process(job: AiExecutionJob): Promise<AiExecutionJobResult> {
    if (job.name === AI_GENERATE_JOB_NAME) return await this.handler.processGenerate({ job });
    if (job.name === AI_EMBED_JOB_NAME) return await this.handler.processEmbed({ job });
    // 兜底：BullMQ 不应分发未知 job name，到达此处视为运行时类型破损，不可重试
    throw new UnrecoverableError('Unsupported AI job name');
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: AiExecutionJob): Promise<void> {
    if (job.name === AI_GENERATE_JOB_NAME) {
      await this.handler.onGenerateCompleted({ job });
      return;
    }
    if (job.name === AI_EMBED_JOB_NAME) {
      await this.handler.onEmbedCompleted({ job });
      return;
    }
    this.logger.warn('Unsupported AI job name on completed event');
  }

  @OnWorkerEvent('failed')
  async onFailed(job: AiFailedJob | undefined, error: Error): Promise<void> {
    await this.handler.onFailed({ job, error });
  }
}
