// src/core/common/password/normalize-password.ts

/**
 * 密码预处理：拒绝空/纯空白密码 → NFKC 规范化 → 检测首尾空格
 * 遵循 input-normalize 契约：统一抛 DomainError，调用方透传或 usecase 显式映射
 */
import { DomainError, INPUT_NORMALIZE_ERROR } from '@core/common/errors/domain-error';

export function validatePasswordNormalize(password: string): string {
  if (!password || /^\s*$/u.test(password)) {
    throw new DomainError(INPUT_NORMALIZE_ERROR.REQUIRED_TEXT_EMPTY, '密码不能为空或纯空白字符');
  }

  const normalizedPassword = password.normalize('NFKC');

  if (/^\s|\s$/u.test(normalizedPassword)) {
    throw new DomainError(INPUT_NORMALIZE_ERROR.INVALID_TEXT, '密码首尾不能包含空格');
  }

  return normalizedPassword;
}
