// src/types/common/transaction.types.ts
// 事务上下文类型与运行时映射

import type { EntityManager } from 'typeorm';

declare const persistenceTransactionContextBrand: unique symbol;

export interface PersistenceTransactionContext {
  readonly [persistenceTransactionContextBrand]: 'PersistenceTransactionContext';
}

// ── 事务上下文 → EntityManager 映射（WeakMap 保证内存安全） ──

const transactionContextManagers = new WeakMap<PersistenceTransactionContext, EntityManager>();

/**
 * 创建一个与 TypeORM EntityManager 关联的事务上下文
 * 仅由 infrastructure 层的事务管理器调用
 */
export function createPersistenceTransactionContext(
  manager: EntityManager,
): PersistenceTransactionContext {
  const ctx = Object.freeze({}) as PersistenceTransactionContext;
  transactionContextManagers.set(ctx, manager);
  return ctx;
}

/**
 * 从事务上下文中获取关联的 TypeORM EntityManager
 * 当上下文无效时抛出错误
 */
export function getTransactionEntityManager(context: PersistenceTransactionContext): EntityManager {
  const manager = transactionContextManagers.get(context);
  if (!manager) {
    throw new Error('Invalid persistence transaction context');
  }
  return manager;
}
