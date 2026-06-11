import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { DomainError, THIRDPARTY_ERROR } from '@core/common/errors/domain-error';
import { isUniqueConstraintViolation } from '@modules/common/database/database-error.helper';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository, type EntityManager } from 'typeorm';
import { AiProviderCallRecordEntity } from './ai-provider-call-record.entity';
import type {
  AiProviderCallRecordProviderStatus,
  AiProviderCallRecordSource,
} from './ai-provider-call-record.types';

export interface CreateAiProviderCallRecordInput {
  readonly asyncTaskRecordId?: number | null;
  readonly traceId: string;
  readonly accountId?: number | null;
  readonly nicknameSnapshot?: string | null;
  readonly bizType?: string | null;
  readonly bizKey?: string | null;
  readonly bizSubKey?: string | null;
  readonly source: AiProviderCallRecordSource;
  readonly provider: string;
  readonly model: string;
  readonly taskType: string;
  readonly providerRequestId?: string | null;
  readonly providerStatus: AiProviderCallRecordProviderStatus;
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly totalTokens?: number | null;
  readonly costAmount?: string | null;
  readonly costCurrency?: string | null;
  readonly normalizedErrorCode?: string | null;
  readonly providerErrorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly providerStartedAt?: Date | null;
  readonly providerFinishedAt?: Date | null;
  readonly providerLatencyMs?: number | null;
}

export interface UpdateAiProviderCallRecordPatch {
  readonly providerRequestId?: string | null;
  readonly providerStatus?: AiProviderCallRecordProviderStatus;
  readonly promptTokens?: number | null;
  readonly completionTokens?: number | null;
  readonly totalTokens?: number | null;
  readonly costAmount?: string | null;
  readonly costCurrency?: string | null;
  readonly normalizedErrorCode?: string | null;
  readonly providerErrorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly providerStartedAt?: Date | null;
  readonly providerFinishedAt?: Date | null;
  readonly providerLatencyMs?: number | null;
}

export interface AiProviderCallRecordView {
  readonly id: number;
  readonly asyncTaskRecordId: number | null;
  readonly traceId: string;
  readonly callSeq: number;
  readonly accountId: number | null;
  readonly nicknameSnapshot: string | null;
  readonly bizType: string | null;
  readonly bizKey: string | null;
  readonly bizSubKey: string | null;
  readonly source: AiProviderCallRecordSource;
  readonly provider: string;
  readonly model: string;
  readonly taskType: string;
  readonly providerRequestId: string | null;
  readonly providerStatus: AiProviderCallRecordProviderStatus;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly totalTokens: number | null;
  readonly costAmount: string | null;
  readonly costCurrency: string | null;
  readonly normalizedErrorCode: string | null;
  readonly providerErrorCode: string | null;
  readonly errorMessage: string | null;
  readonly providerStartedAt: Date | null;
  readonly providerFinishedAt: Date | null;
  readonly providerLatencyMs: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@Injectable()
export class AiProviderCallRecordService {
  private static readonly CREATE_RECORD_MAX_RETRY = 5;

  constructor(
    @InjectRepository(AiProviderCallRecordEntity)
    private readonly aiProviderCallRecordRepository: Repository<AiProviderCallRecordEntity>,
  ) {}

  async createRecord(input: {
    readonly data: CreateAiProviderCallRecordInput;
    readonly transactionContext?: PersistenceTransactionContext;
  }): Promise<AiProviderCallRecordView> {
    const manager = input.transactionContext
      ? getTypeOrmEntityManager(input.transactionContext)
      : undefined;
    let attempt = 0;
    while (attempt < AiProviderCallRecordService.CREATE_RECORD_MAX_RETRY) {
      try {
        const saved = await this.createRecordWithAllocatedSeq({
          data: input.data,
          manager,
        });
        return this.toView(saved);
      } catch (error) {
        attempt += 1;
        if (
          this.isTraceSeqUniqueConflict(error) &&
          attempt < AiProviderCallRecordService.CREATE_RECORD_MAX_RETRY
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new DomainError(
      THIRDPARTY_ERROR.PROVIDER_API_ERROR,
      'ai_provider_call_record_create_retry_exhausted',
      {
        traceId: input.data.traceId,
        provider: input.data.provider,
        model: input.data.model,
        maxRetry: AiProviderCallRecordService.CREATE_RECORD_MAX_RETRY,
      },
    );
  }

  async updateRecordById(input: {
    readonly where: { readonly id: number };
    readonly patch: UpdateAiProviderCallRecordPatch;
    readonly transactionContext?: PersistenceTransactionContext;
  }): Promise<AiProviderCallRecordView | null> {
    const manager = input.transactionContext
      ? getTypeOrmEntityManager(input.transactionContext)
      : undefined;
    const repository = this.resolveRepository(manager);
    const record = await repository.findOne({ where: { id: input.where.id } });
    if (!record) {
      return null;
    }
    const normalizedPatch: Partial<AiProviderCallRecordEntity> = {
      ...input.patch,
    };
    if (input.patch.promptTokens !== undefined) {
      normalizedPatch.promptTokens = this.normalizeTokenCount(input.patch.promptTokens);
    }
    if (input.patch.completionTokens !== undefined) {
      normalizedPatch.completionTokens = this.normalizeTokenCount(input.patch.completionTokens);
    }
    if (input.patch.providerStartedAt !== undefined) {
      normalizedPatch.providerStartedAt = this.normalizeDate(input.patch.providerStartedAt);
    }
    if (input.patch.providerFinishedAt !== undefined) {
      normalizedPatch.providerFinishedAt = this.normalizeDate(input.patch.providerFinishedAt);
    }
    delete normalizedPatch.totalTokens;
    delete normalizedPatch.providerLatencyMs;
    repository.merge(record, normalizedPatch);
    record.totalTokens = this.resolveTotalTokens({
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
    });
    record.providerLatencyMs = this.resolveProviderLatencyMs({
      providerStartedAt: record.providerStartedAt,
      providerFinishedAt: record.providerFinishedAt,
    });
    this.enforceErrorFieldsByProviderStatus(record);
    const saved = await repository.save(record);
    return this.toView(saved);
  }

  private resolveRepository(manager?: EntityManager): Repository<AiProviderCallRecordEntity> {
    if (manager) {
      return manager.getRepository(AiProviderCallRecordEntity);
    }
    return this.aiProviderCallRecordRepository;
  }

  private async allocateCallSeq(input: {
    readonly traceId: string;
    readonly manager?: EntityManager;
  }): Promise<number> {
    const repository = this.resolveRepository(input.manager);
    const row = await repository
      .createQueryBuilder('record')
      .select('record.callSeq', 'callSeq')
      .where('record.traceId = :traceId', { traceId: input.traceId })
      .orderBy('record.callSeq', 'DESC')
      .limit(1)
      .getRawOne<{ readonly callSeq?: number | string }>();
    const maxCallSeq = row?.callSeq === undefined ? 0 : Number(row.callSeq);
    if (!Number.isFinite(maxCallSeq) || maxCallSeq < 0) {
      return 1;
    }
    return maxCallSeq + 1;
  }

  private async createRecordWithAllocatedSeq(input: {
    readonly data: CreateAiProviderCallRecordInput;
    readonly manager?: EntityManager;
  }): Promise<AiProviderCallRecordEntity> {
    const repository = this.resolveRepository(input.manager);
    const promptTokens = this.normalizeTokenCount(input.data.promptTokens);
    const completionTokens = this.normalizeTokenCount(input.data.completionTokens);
    const providerStartedAt = this.normalizeDate(input.data.providerStartedAt);
    const providerFinishedAt = this.normalizeDate(input.data.providerFinishedAt);
    const callSeq = await this.allocateCallSeq({
      traceId: input.data.traceId,
      manager: input.manager,
    });
    const entity = repository.create({
      asyncTaskRecordId: this.toNullable(input.data.asyncTaskRecordId),
      traceId: input.data.traceId,
      callSeq,
      accountId: this.toNullable(input.data.accountId),
      nicknameSnapshot: this.toNullable(input.data.nicknameSnapshot),
      bizType: this.toNullable(input.data.bizType),
      bizKey: this.toNullable(input.data.bizKey),
      bizSubKey: this.toNullable(input.data.bizSubKey),
      source: input.data.source,
      provider: input.data.provider,
      model: input.data.model,
      taskType: input.data.taskType,
      providerRequestId: this.toNullable(input.data.providerRequestId),
      providerStatus: input.data.providerStatus,
      promptTokens,
      completionTokens,
      totalTokens: this.resolveTotalTokens({
        promptTokens,
        completionTokens,
      }),
      costAmount: this.toNullable(input.data.costAmount),
      costCurrency: this.toNullable(input.data.costCurrency),
      normalizedErrorCode: this.toNullable(input.data.normalizedErrorCode),
      providerErrorCode: this.toNullable(input.data.providerErrorCode),
      errorMessage: this.toNullable(input.data.errorMessage),
      providerStartedAt,
      providerFinishedAt,
      providerLatencyMs: this.resolveProviderLatencyMs({
        providerStartedAt,
        providerFinishedAt,
      }),
    });
    this.enforceErrorFieldsByProviderStatus(entity);
    return await repository.save(entity);
  }

  private isTraceSeqUniqueConflict(error: unknown): boolean {
    if (!isUniqueConstraintViolation(error)) {
      return false;
    }
    const message = error instanceof Error ? error.message : undefined;
    return this.hasTraceSeqUniqueName(message);
  }

  private hasTraceSeqUniqueName(message?: string): boolean {
    if (!message) {
      return false;
    }
    return (
      message.includes('uk_ai_provider_call_trace_seq') ||
      message.includes('uq_ai_provider_call_trace_seq') ||
      message.includes('ai_provider_call_record.trace_id_call_seq')
    );
  }

  private toNullable<T>(value: T | null | undefined): T | null {
    return value ?? null;
  }

  private normalizeDate(value: Date | null | undefined): Date | null {
    if (!(value instanceof Date)) {
      return null;
    }
    return Number.isFinite(value.getTime()) ? value : null;
  }

  private normalizeTokenCount(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    return Math.trunc(value);
  }

  private resolveTotalTokens(input: {
    readonly promptTokens: number | null;
    readonly completionTokens: number | null;
  }): number | null {
    if (input.promptTokens === null || input.completionTokens === null) {
      return null;
    }
    return input.promptTokens + input.completionTokens;
  }

  private resolveProviderLatencyMs(input: {
    readonly providerStartedAt: Date | null;
    readonly providerFinishedAt: Date | null;
  }): number | null {
    if (!input.providerStartedAt || !input.providerFinishedAt) {
      return null;
    }
    const latencyMs = input.providerFinishedAt.getTime() - input.providerStartedAt.getTime();
    if (!Number.isFinite(latencyMs)) {
      return null;
    }
    return latencyMs;
  }

  private enforceErrorFieldsByProviderStatus(
    record: Pick<
      AiProviderCallRecordEntity,
      'providerStatus' | 'normalizedErrorCode' | 'providerErrorCode' | 'errorMessage'
    >,
  ): void {
    if (record.providerStatus === 'succeeded') {
      record.normalizedErrorCode = null;
      record.providerErrorCode = null;
      record.errorMessage = null;
    }
  }

  private toView(entity: AiProviderCallRecordEntity): AiProviderCallRecordView {
    return {
      id: entity.id,
      asyncTaskRecordId: entity.asyncTaskRecordId,
      traceId: entity.traceId,
      callSeq: entity.callSeq,
      accountId: entity.accountId,
      nicknameSnapshot: entity.nicknameSnapshot,
      bizType: entity.bizType,
      bizKey: entity.bizKey,
      bizSubKey: entity.bizSubKey,
      source: entity.source,
      provider: entity.provider,
      model: entity.model,
      taskType: entity.taskType,
      providerRequestId: entity.providerRequestId,
      providerStatus: entity.providerStatus,
      promptTokens: entity.promptTokens,
      completionTokens: entity.completionTokens,
      totalTokens: entity.totalTokens,
      costAmount: entity.costAmount,
      costCurrency: entity.costCurrency,
      normalizedErrorCode: entity.normalizedErrorCode,
      providerErrorCode: entity.providerErrorCode,
      errorMessage: entity.errorMessage,
      providerStartedAt: entity.providerStartedAt,
      providerFinishedAt: entity.providerFinishedAt,
      providerLatencyMs: entity.providerLatencyMs,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
