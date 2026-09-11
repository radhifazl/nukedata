export type CleaningOperationType =
  | "remove_duplicates"
  | "fill_missing"
  | "normalize_text"
  | "convert_type"
  | "remove_outlier_rows";

export interface CleaningOperation {
  id: string;
  type: CleaningOperationType;
  column?: string;
  config: Record<string, unknown>;
  /** Human-readable summary e.g. "Fill missing email with Unknown" */
  description: string;
  /** How many rows/values are affected */
  affectedCount: number;
}
