export const QM_WORKER_ENTRY_OPTIONS = Symbol('QM_WORKER_ENTRY_OPTIONS');

export type QmWorkerEntryFlag = 'aiEnabled' | 'emailEnabled' | 'magicItemCraftEnabled'; // [KEPT:业务保留] 添加 magicItemCraftEnabled

export interface QmWorkerEntryOptions {
  readonly aiEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly magicItemCraftEnabled: boolean; // [KEPT:业务保留]
}
