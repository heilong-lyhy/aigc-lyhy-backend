export const QM_WORKER_ENTRY_OPTIONS = Symbol('QM_WORKER_ENTRY_OPTIONS');

export type QmWorkerEntryFlag = 'aiEnabled' | 'emailEnabled' | 'magicItemCraftEnabled';

export interface QmWorkerEntryOptions {
  readonly aiEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly magicItemCraftEnabled: boolean;
}
