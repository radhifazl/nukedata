import type {
  NumericColumnStats,
  CategoricalColumnStats,
  DateColumnStats,
  BooleanColumnStats,
} from "@/utils/stats";

/** Basic column data types inferred from cell values. */
export type ColumnType = "text" | "number" | "boolean" | "date" | "unknown";

/** Severity of a detected data-quality issue. */
export type IssueSeverity = "low" | "medium" | "high";

/**
 * Categories of data-quality issues the profiler can detect.
 * This enum drives both detection logic and display labels.
 */
export type DataIssueType =
  | "missing_values"
  | "duplicate_rows"
  | "inconsistent_values"
  | "potential_outliers"
  | "empty_column";

/**
 * @deprecated Use NumericColumnStats from utils/stats instead.
 * Kept for backward compat with anything that imports NumericStats from here.
 */
export type NumericStats = NumericColumnStats;

/** Statistics calculated only for date columns. */
export type DateStats = DateColumnStats;

/** Full profile of a single column. */
export interface ColumnProfile {
  name: string;
  inferredType: ColumnType;
  /** Number of non-missing values. */
  totalValues: number;
  missingCount: number;
  uniqueCount: number;
  /** Ratio of unique non-missing values to total non-missing values (0–1). */
  uniqueRatio: number;
  /** True when this column has zero non-missing values (entirely empty). */
  isEmpty: boolean;
  numericStats: NumericColumnStats | null;
  dateStats: DateColumnStats | null;
  categoricalStats: CategoricalColumnStats | null;
  booleanStats: BooleanColumnStats | null;
  /** Distinct normalised values that share a normalised form (inconsistency candidates). */
  inconsistentGroups: InconsistentGroup[];
}

/**
 * A group of raw values that collapse to the same normalised form
 * (trim + lowercase), indicating possible inconsistent representation.
 */
export interface InconsistentGroup {
  normalizedForm: string;
  rawValues: string[];
}

/** A single detected data-quality issue. */
export interface DataIssue {
  /** Stable identifier — used as React key. */
  id: string;
  type: DataIssueType;
  severity: IssueSeverity;
  /** Column name if the issue is column-specific; undefined for row-level issues. */
  column?: string;
  count: number;
  description: string;
}

/**
 * The complete profile of a parsed dataset.
 *
 * Computed once by `profileDataset()` and stored alongside the dataset.
 * The profiler never mutates the source data.
 */
export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  /** Number of rows that contain at least one missing value. */
  incompleteRowCount: number;
  duplicateRowCount: number;
  /** Number of columns with zero non-missing values. */
  emptyColumnCount: number;
  columns: ColumnProfile[];
  issues: DataIssue[];
  /**
   * Data-quality score from 0–100.
   *
   * Scoring logic (documented in profileDataset.ts):
   *   starts at 100
   *   − missingValuePenalty  (up to 30 pts — only non-empty columns)
   *   − duplicatePenalty     (up to 20 pts based on duplicate ratio)
   *   − inconsistencyPenalty (up to 20 pts, 5 pts per affected column, max 4)
   *   − outlierPenalty       (up to 10 pts based on outlier ratio)
   *   − emptyColumnPenalty   (up to 10 pts, 2.5 pts per empty column, max 4)
   *   clamped to [0, 100]
   */
  qualityScore: number;
}
