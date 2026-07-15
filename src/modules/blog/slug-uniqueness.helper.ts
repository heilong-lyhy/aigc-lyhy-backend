// src/modules/blog/slug-uniqueness.helper.ts
// Blog 域共享的 slug 唯一性断言工具
// BlogPost / BlogCategory / BlogTag 均需要 slug 唯一检查，逻辑完全相同，仅错误码不同

import { DomainError } from '@core/common/errors/domain-error';
import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { getTypeOrmEntityManager as getTransactionEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';

/**
 * 通用的 slug 唯一性断言
 * @param repo - 当前事务或默认的 Repository
 * @param slug - 待检查的 slug
 * @param errorCode - 违反时抛出的错误码
 * @param errorMessage - 违反时抛出的错误消息
 * @param excludeId - 排除的实体 ID（更新场景）
 */
export async function assertSlugUnique(
  repo: Repository<{ id: number; slug: string }>,
  slug: string,
  errorCode: string,
  errorMessage: string,
  excludeId?: number,
): Promise<void> {
  const existing = await repo.findOne({ where: { slug } });
  if (existing && existing.id !== excludeId) {
    throw new DomainError(errorCode, errorMessage);
  }
}

/**
 * 获取事务内或默认的 Repository
 * Blog 域内各 service/query.service 共享的事务感知 Repository 获取模式
 */
export function getTransactionalRepo<T extends object>(
  entityClass: new () => T,
  defaultRepo: Repository<T>,
  transactionContext?: PersistenceTransactionContext,
): Repository<T> {
  return transactionContext
    ? getTransactionEntityManager(transactionContext).getRepository(entityClass)
    : defaultRepo;
}
