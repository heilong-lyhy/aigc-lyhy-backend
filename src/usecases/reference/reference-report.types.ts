// src/usecases/reference/reference-report.types.ts

export interface ReferenceReportItem {
  readonly groupKey: string;
  readonly profileCount: number;
  readonly profileNames: readonly string[];
}

export interface ReferenceReportView {
  readonly groupCount: number;
  readonly totalProfiles: number;
  readonly items: readonly ReferenceReportItem[];
}
