// src/infrastructure/database/transaction/typeorm-persistence-transaction-context.ts
// Re-export from types layer for backward compatibility

export {
  createPersistenceTransactionContext as createTypeOrmPersistenceTransactionContext,
  getTransactionEntityManager as getTypeOrmEntityManager,
} from '@app-types/common/transaction.types';
