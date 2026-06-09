// src/modules/verification-record/verification-record-consume.shared.ts
// 验证记录消费流程的共享逻辑，供同域及跨域 usecase 复用

import {
  VerificationRecordType,
  VerificationRecordStatus,
} from '@app-types/models/verification-record.types';
import {
  DomainError,
  PERMISSION_ERROR,
  VERIFICATION_RECORD_ERROR,
} from '@core/common/errors/domain-error';
import type {
  VerificationRecordConsumeTargetConstraint,
  VerificationRecordValidationSnapshot,
} from './verification-record.service';

/**
 * 验证消费上下文
 */
export interface VerificationConsumeContext {
  consumedByAccountId?: number;
  expectedType?: VerificationRecordType;
  now: Date;
}

/**
 * 根据消费上下文解析目标约束
 */
export function resolveConsumeTargetConstraint(
  context: VerificationConsumeContext,
): VerificationRecordConsumeTargetConstraint {
  const { consumedByAccountId, expectedType } = context;
  if (consumedByAccountId !== undefined) {
    return { mode: 'MATCH_OR_NULL', accountId: consumedByAccountId };
  }
  if (expectedType === VerificationRecordType.PASSWORD_RESET) {
    return { mode: 'IGNORE' };
  }
  return { mode: 'NULL_ONLY' };
}

/**
 * 目标账号权限校验（PASSWORD_RESET 类型允许匿名消费）
 */
function checkTargetAccountPermission(
  record: VerificationRecordValidationSnapshot,
  context: VerificationConsumeContext,
): void {
  if (record.type === VerificationRecordType.PASSWORD_RESET) {
    return;
  }
  if (record.targetAccountId && !context.consumedByAccountId) {
    throw new DomainError(PERMISSION_ERROR.ACCESS_DENIED, '此验证码需要登录后使用');
  }
  if (
    record.targetAccountId &&
    context.consumedByAccountId &&
    record.targetAccountId !== context.consumedByAccountId
  ) {
    throw new DomainError(PERMISSION_ERROR.ACCESS_DENIED, '您无权使用此验证码', {
      targetAccountId: record.targetAccountId,
      consumedByAccountId: context.consumedByAccountId,
    });
  }
}

/**
 * 验证消费失败时抛出对应的 DomainError
 */
export function throwConsumeFailure(
  record: VerificationRecordValidationSnapshot | null,
  context: VerificationConsumeContext,
  notFoundError: string = VERIFICATION_RECORD_ERROR.INVALID_TOKEN,
  notFoundMessage: string = '无效的验证 token',
): never {
  if (!record) {
    throw new DomainError(notFoundError, notFoundMessage);
  }

  // 类型校验
  if (context.expectedType && record.type !== context.expectedType) {
    throw new DomainError(VERIFICATION_RECORD_ERROR.VERIFICATION_INVALID, '验证码类型不匹配');
  }

  // 目标账号权限校验
  checkTargetAccountPermission(record, context);

  // 状态校验
  if (record.status !== VerificationRecordStatus.ACTIVE) {
    throw new DomainError(
      VERIFICATION_RECORD_ERROR.RECORD_ALREADY_CONSUMED,
      '验证码已被使用或已失效',
    );
  }

  // 过期校验（包含 180 秒宽限期）
  const gracePeriodMs = 180 * 1000;
  const expiresAtWithGracePeriod = new Date(record.expiresAt.getTime() + gracePeriodMs);
  if (expiresAtWithGracePeriod <= context.now) {
    throw new DomainError(VERIFICATION_RECORD_ERROR.RECORD_EXPIRED, '验证码已过期，请重新获取');
  }

  // 未生效校验
  if (record.notBefore && record.notBefore > context.now) {
    throw new DomainError(VERIFICATION_RECORD_ERROR.RECORD_NOT_ACTIVE_YET, '验证码尚未到使用时间');
  }

  // 所有检查都通过但仍失败，说明是未知错误
  throw new DomainError(VERIFICATION_RECORD_ERROR.CONSUMPTION_FAILED, '验证码已被使用或已失效');
}
