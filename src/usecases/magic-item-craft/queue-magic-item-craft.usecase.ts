// src/usecases/magic-item-craft/queue-magic-item-craft.usecase.ts
import { Injectable } from '@nestjs/common';
import {
  resolveAsyncTaskBizKey,
  resolveEnqueueFailureIdentifiers,
} from '@src/core/common/async-task/async-task-identifier.policy';
import { AsyncTaskRecordService } from '@src/modules/async-task-record/async-task-record.service';
import type { AsyncTaskRecordSource } from '@src/modules/async-task-record/async-task-record.types';
import { MagicItemCraftQueueService } from '@src/modules/common/magic-item-craft-queue/magic-item-craft-queue.service';
import type {
  QueueMagicItemCraftTaskInput,
  QueueMagicItemCraftTaskResult,
} from '@modules/magic-item-craft/magic-item-craft.types';
import { MagicItemCraftService } from '@modules/magic-item-craft/magic-item-craft.service';
import { DomainError, MAGIC_ITEM_CRAFT_ERROR } from '@src/core/common/errors/domain-error';
import { normalizeOptionalText } from '@src/core/common/input-normalize/input-normalize.policy';

interface EnqueueSuccessResult extends QueueMagicItemCraftTaskResult {
  readonly jobId: string;
  readonly traceId: string;
}

@Injectable()
export class QueueMagicItemCraftUsecase {
  constructor(
    private readonly magicItemCraftQueueService: MagicItemCraftQueueService,
    private readonly magicItemCraftService: MagicItemCraftService,
    private readonly asyncTaskRecordService: AsyncTaskRecordService,
  ) {}

  async execute(input: QueueMagicItemCraftTaskInput): Promise<QueueMagicItemCraftTaskResult> {
    const occurredAt = new Date();
    const result = await this.enqueueOrThrow({ input, occurredAt });
    await this.asyncTaskRecordService.recordEnqueued({
      data: {
        queueName: 'magic_item_craft',
        jobName: 'craft',
        jobId: result.jobId,
        traceId: result.traceId,
        actorAccountId: input.actorAccountId,
        actorActiveRole: input.actorActiveRole,
        bizType: 'magic_item_craft',
        bizKey: resolveAsyncTaskBizKey({
          domain: 'magic_item_craft',
          traceId: result.traceId,
          jobId: result.jobId,
        }),
        source: this.resolveSource(),
        reason: 'enqueue_accepted',
        occurredAt,
      },
    });
    return {
      id: result.id,
      status: result.status,
      itemName: result.itemName,
      createdAt: result.createdAt,
    };
  }

  private async enqueueOrThrow(input: {
    readonly input: QueueMagicItemCraftTaskInput;
    readonly occurredAt: Date;
  }): Promise<EnqueueSuccessResult> {
    try {
      const queueResult = await this.magicItemCraftQueueService.enqueueCraftJob({
        itemName: input.input.itemName,
        itemType: input.input.itemType,
        materialLevel: input.input.materialLevel,
        requestNote: input.input.requestNote,
        traceId: input.input.traceId,
      });

      const taskResult = await this.magicItemCraftService.createTaskRecord({
        traceId: queueResult.traceId,
        itemName: input.input.itemName,
        itemType: input.input.itemType,
        materialLevel: input.input.materialLevel,
        requestNote: input.input.requestNote,
      });

      return {
        ...taskResult,
        jobId: queueResult.jobId,
        traceId: queueResult.traceId,
      };
    } catch (error: unknown) {
      const normalizedError =
        error instanceof Error
          ? error
          : new DomainError(
              MAGIC_ITEM_CRAFT_ERROR.ENQUEUE_FAILED,
              'magic_item_craft_enqueue_failed',
            );
      const identifiers = resolveEnqueueFailureIdentifiers({
        domain: 'magic_item_craft',
        traceId: input.input.traceId,
        occurredAt: input.occurredAt,
        traceIdPrefix: 'magic-item-craft-enqueue:',
      });
      await this.asyncTaskRecordService.recordEnqueueFailed({
        data: {
          queueName: 'magic_item_craft',
          jobName: 'craft',
          jobId: identifiers.failedJobId,
          traceId: identifiers.traceId,
          actorAccountId: input.input.actorAccountId,
          actorActiveRole: input.input.actorActiveRole,
          bizType: 'magic_item_craft',
          bizKey: identifiers.bizKey,
          source: this.resolveSource(),
          reason: this.resolveEnqueueFailedReason({ message: normalizedError.message }),
          occurredAt: input.occurredAt,
        },
      });
      throw normalizedError;
    }
  }

  private resolveSource(): AsyncTaskRecordSource {
    return 'user_action';
  }

  private resolveEnqueueFailedReason(input: { readonly message: string }): string {
    const normalizedMessage =
      normalizeOptionalText(input.message, 'keep_empty_string' as const) || 'enqueue_unknown_error';
    if (normalizedMessage.startsWith('enqueue_failed:')) {
      return normalizedMessage.slice(0, 128);
    }
    const prefix = 'enqueue_failed:';
    const availableSummaryLength = Math.max(128 - prefix.length, 1);
    const summary = normalizedMessage.slice(0, availableSummaryLength);
    return `${prefix}${summary}`;
  }
}
