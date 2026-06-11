export interface QueueMagicItemCraftJobInput {
  readonly itemName: string;
  readonly itemType: string;
  readonly materialLevel: number;
  readonly requestNote?: string;
  readonly traceId?: string;
}

export interface QueueMagicItemCraftJobResult {
  readonly jobId: string;
  readonly traceId: string;
}
