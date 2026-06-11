// src/modules/common/database/database-error.helper.ts
// 跨 bounded context 复用的数据库错误检测工具

import { QueryFailedError } from 'typeorm';

/**
 * 检测是否为唯一约束冲突错误
 * 支持 MySQL (ER_DUP_ENTRY) 和 PostgreSQL (23505)
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const errorObj = error as unknown as Record<string, unknown>;

  // TypeORM v0.3: 优先从 driverError 字段读取稳定的错误信息
  const driverError = errorObj.driverError as Record<string, unknown> | undefined;

  if (driverError) {
    if (
      driverError.code === 'ER_DUP_ENTRY' ||
      driverError.errno === 1062 ||
      driverError.sqlState === '23000' ||
      driverError.code === '23505'
    ) {
      return true;
    }
  }

  // 兼容性处理：如果 driverError 不存在，回退到直接读取 error 对象
  if (
    errorObj.code === 'ER_DUP_ENTRY' ||
    errorObj.errno === 1062 ||
    errorObj.sqlState === '23000' ||
    errorObj.code === '23505'
  ) {
    return true;
  }

  return false;
}
