// src/modules/common/email-queue/email-queue.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import { BullMqProducerGateway } from '@src/infrastructure/bullmq/producer.gateway';
import { CapabilityRuntimeContributionProvider } from '@src/infrastructure/capability/capability.decorators';
import {
  NOTIFICATION_EMAIL_CAPABILITY_ID,
  RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID,
} from '@src/modules/common/email-capability/email-capability.constants';
import {
  CAPABILITY_STATE_READER,
  type CapabilityStateReader,
} from '@src/modules/common/capability-state-reader.contract';
import { maskEmail } from '@src/core/common/text/text.helper';
import { PinoLogger } from 'nestjs-pino';
import type { QueueEmailInput, QueueEmailResult } from './email-queue.types';

// `runtime.async-task` is owned by the async-task-record business module; `common/*` cannot
// import from business modules, so this ID is kept as a literal here. See docs/dependency-rules.
@Injectable()
@CapabilityRuntimeContributionProvider({
  capabilityId: RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID,
  runtimeDependencies: [{ capabilityId: 'runtime.async-task', requirement: 'optional' }],
  queueResources: [{ queueName: BULLMQ_QUEUES.EMAIL, jobName: BULLMQ_JOBS.EMAIL.SEND }],
})
export class EmailQueueService {
  constructor(
    private readonly producer: BullMqProducerGateway,
    private readonly logger: PinoLogger,
    @Inject(CAPABILITY_STATE_READER)
    private readonly capabilityStateReader: CapabilityStateReader,
  ) {
    this.logger.setContext(EmailQueueService.name);
  }

  async enqueueSend(input: QueueEmailInput): Promise<QueueEmailResult> {
    // notification.email 是通知级邮件门控：禁用后不应再入队通知邮件
    this.capabilityStateReader.requireEnabled(NOTIFICATION_EMAIL_CAPABILITY_ID);
    // runtime.email-delivery 是投递基础设施门控：禁用后投递机制不可用
    this.capabilityStateReader.requireEnabled(RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID);
    const job = await this.producer.enqueue({
      queueName: BULLMQ_QUEUES.EMAIL,
      jobName: BULLMQ_JOBS.EMAIL.SEND,
      payload: {
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        templateId: input.templateId,
        meta: input.meta,
      },
      dedupKey: input.dedupKey,
      traceId: input.traceId,
    });
    this.logger.info(
      {
        to: maskEmail(input.to),
        jobId: job.jobId,
        traceId: job.traceId,
      },
      'Email job accepted',
    );
    return {
      jobId: job.jobId,
      traceId: job.traceId,
    };
  }
}
