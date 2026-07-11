declare const persistenceTransactionContextBrand: unique symbol;

export interface PersistenceTransactionContext {
  readonly [persistenceTransactionContextBrand]: 'PersistenceTransactionContext';
}

// [KEPT:业务保留] 重新导出 getTransactionEntityManager 以兼容业务代码
// 模板 v1.6.0 已将其重命名为 getTypeOrmEntityManager 并移至 typeorm-persistence-transaction-context.ts
export { getTypeOrmEntityManager as getTransactionEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
