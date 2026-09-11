/**
 * The dataset section of a cleaning summary export.
 * Contains only safe, non-sensitive metadata — no raw row values.
 */
export interface SummaryDatasetMeta {
  name: string;
  /** Number of rows in the original dataset. */
  rowsBefore: number;
  /** Number of rows after all cleaning operations. */
  rowsAfter: number;
  columns: number;
}

/** Quality-score section of the summary. */
export interface SummaryQuality {
  /** Quality score of the original dataset (0–100). */
  before: number;
  /** Quality score after cleaning (same as before if no operations). */
  after: number;
}

/** One operation entry in the exported cleaning summary. */
export interface SummaryOperation {
  type: string;
  /** Human-readable description of what was done. */
  description: string;
  /** Number of rows/values affected. */
  affectedCount: number;
  /** Column the operation targeted, if applicable. */
  column?: string;
}

/**
 * The complete cleaning summary that can be exported as JSON.
 * Designed to be human-readable and safely shareable.
 */
export interface CleaningSummary {
  /** ISO timestamp of when the summary was generated. */
  exportedAt: string;
  dataset: SummaryDatasetMeta;
  quality: SummaryQuality;
  operations: SummaryOperation[];
}
