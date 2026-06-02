export interface QueueMagicItemCraftJobInput {
  readonly itemName: string;
  readonly itemType: string;
  readonly materialLevel: number;
  readonly requestNote?: string;
  readonly actorAccountId?: number | null;
  readonly actorActiveRole?: string | null;
  readonly traceId?: string;
}

export interface QueueMagicItemCraftJobResult {
  readonly jobId: string;
  readonly traceId: string;
}
