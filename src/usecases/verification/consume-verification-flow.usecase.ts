// src/usecases/verification/consume-verification-flow.usecase.ts

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { VerificationRecordType } from '@app-types/models/verification-record.types';
import { DomainError, VERIFICATION_RECORD_ERROR } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import { VerificationReadQueryService } from '@src/modules/verification-record/queries/verification-read.query.service';
import { VerificationRecordService } from '@src/modules/verification-record/verification-record.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';
import {
  resolveConsumeTargetConstraint,
  throwConsumeFailure,
  type VerificationConsumeContext,
} from '@src/modules/verification-record/verification-record-consume.shared';
import { ResetPasswordHandler } from './password/reset-password.handler';
import {
  ConsumeVerificationFlowParams,
  VerificationFlowContext,
  VerificationFlowHandler,
  VerificationFlowResult,
} from './types/consume.types';

/**
 * 验证流程消费用例
 * 负责协调验证码的分发到具体业务用例、以及最终的状态落账
 *
 * 工作流程：
 * 1. 前端先调用 findVerificationRecord 预读验证记录（不在事务中）
 * 2. 前端收集必要数据后调用此用例进行消费
 * 3. 在事务中执行业务逻辑和验证码消费
 *
 * 注意：此用例不再包含预读步骤，预读应该通过独立的 findVerificationRecord GraphQL 查询完成
 */
@Injectable()
export class ConsumeVerificationFlowUsecase {
  /**
   * 注册的验证流程处理器映射
   */
  private readonly handlers = new Map<VerificationRecordType, VerificationFlowHandler>();

  constructor(
    private readonly verificationRecordService: VerificationRecordService,
    private readonly verificationReadQueryService: VerificationReadQueryService,
    private readonly resetPasswordHandler: ResetPasswordHandler,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {
    this.registerHandler(this.resetPasswordHandler);
  }

  /**
   * 注册验证流程处理器
   * @param handler 处理器实例
   */
  registerHandler(handler: VerificationFlowHandler): void {
    for (const type of handler.supportedTypes) {
      if (this.handlers.has(type)) {
        throw new DomainError(
          VERIFICATION_RECORD_ERROR.HANDLER_CONFLICT,
          `验证流程处理器冲突: ${type} 已被注册`,
          {
            type,
          },
        );
      }
      this.handlers.set(type, handler);
    }
  }

  /**
   * 执行验证流程
   *
   * 注意：此方法假设前端已经通过 findVerificationRecord 预读了验证记录
   * 并收集了必要的数据，现在直接进行消费操作
   *
   * @param params 流程参数
   * @returns 验证流程结果
   */
  async execute(params: ConsumeVerificationFlowParams): Promise<VerificationFlowResult> {
    const { token, consumedByAccountId, expectedType, transactionContext, resetPassword } = params;

    const run = async (
      activeTransactionContext: PersistenceTransactionContext,
    ): Promise<VerificationFlowResult> => {
      // 第一步：在事务中重新验证并获取验证记录视图
      // 这里需要重新验证是因为从预读到消费之间可能有状态变化
      const recordView = await this.verificationReadQueryService.findConsumableRecord(
        token,
        params.audience,
        params.email,
        params.phone,
        activeTransactionContext,
      );

      if (!recordView) {
        throw new DomainError(
          VERIFICATION_RECORD_ERROR.VERIFICATION_INVALID,
          '验证码已被使用或已失效',
          { token, expectedType },
        );
      }

      // 第二步：验证 expectedType（如果提供）
      if (expectedType && recordView.type !== expectedType) {
        throw new DomainError(
          VERIFICATION_RECORD_ERROR.VERIFICATION_INVALID,
          `验证记录类型不匹配，期望: ${expectedType}，实际: ${recordView.type}`,
          { expectedType, actualType: recordView.type },
        );
      }

      // 第三步：获取对应的业务处理器
      const handler = this.getHandler(recordView.type);

      // 第四步：构建验证流程上下文
      const context: VerificationFlowContext = {
        recordView,
        consumedByAccountId,
        transactionContext: activeTransactionContext,
        resetPassword, // 传递密码重置载荷
      };

      // 第五步：执行业务逻辑
      const businessResult = await handler.handle(context);

      // 第六步：消费验证记录（在同一事务中）
      await this.consumeVerificationRecord({
        token,
        consumedByAccountId,
        expectedType: recordView.type,
        transactionContext: activeTransactionContext,
      });

      return businessResult;
    };

    return transactionContext
      ? await run(transactionContext)
      : await this.transactionRunner.run(run);
  }

  /**
   * 获取指定类型的处理器
   * @param type 验证记录类型
   * @returns 对应的处理器
   */
  private getHandler(type: VerificationRecordType): VerificationFlowHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new DomainError(
        VERIFICATION_RECORD_ERROR.VERIFICATION_INVALID,
        `不支持的验证记录类型: ${type}`,
        { type },
      );
    }
    return handler;
  }

  /**
   * 获取所有支持的验证记录类型
   * @returns 支持的类型数组
   */
  getSupportedTypes(): VerificationRecordType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 检查是否支持指定类型
   * @param type 验证记录类型
   * @returns 是否支持
   */
  isTypeSupported(type: VerificationRecordType): boolean {
    return this.handlers.has(type);
  }

  private async consumeVerificationRecord(params: {
    token: string;
    consumedByAccountId?: number;
    expectedType?: VerificationRecordType;
    transactionContext?: Parameters<
      VerificationRecordService['consumeRecord']
    >[0]['transactionContext'];
  }): Promise<void> {
    const { token, consumedByAccountId, expectedType, transactionContext } = params;
    const now = new Date();
    const context: VerificationConsumeContext = { consumedByAccountId, expectedType, now };
    const targetConstraint = resolveConsumeTargetConstraint(context);
    const tokenFp = this.verificationRecordService.generateTokenFingerprint(token);

    const { affected, validationRecord } = await this.verificationRecordService.consumeRecord({
      where: { tokenFp },
      context: {
        expectedType,
        consumedByAccountId,
        now,
        targetConstraint,
      },
      transactionContext,
    });

    if (affected === 0) {
      throwConsumeFailure(validationRecord, context);
    }
  }
}
