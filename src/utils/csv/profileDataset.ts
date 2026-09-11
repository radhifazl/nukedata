import type { Dataset } from "@/types/dataset";
import type {
  ColumnProfile,
  ColumnType,
  DataIssue,
  DatasetProfile,
  InconsistentGroup,
  NumericStats,
} from "@/types/profile";

/** Extended column profile used only during profiling; not exposed outside this module. */
type ColumnProfileInternal = ColumnProfile & { outlierCount: number };

// ---------------------------------------------------------------------------
// Missing-value detection
// ---------------------------------------------------------------------------

/**
 * Canonical set of string tokens treated as missing.
 * Values are compared after trimming and lowercasing.
 * We intentionally do not include vague words like "unknown" or "none",
 * as those may carry real meaning in a dataset.
 */
const MISSING_TOKENS = new Set([
  "",
  "n/a",
  "na",
  "null",
  "nil",
  "-",
  "—",
  ".",
  "?",
]);

/**
 * Returns true if a raw cell value should be treated as missing.
 * The original value is never modified.
 */
export function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const str = String(value).trim().toLowerCase();
  return MISSING_TOKENS.has(str);
}

// ---------------------------------------------------------------------------
// Type inference helpers
// ---------------------------------------------------------------------------

/**
 * Regex for detecting ISO and common date strings.
 * We are intentionally conservative: a plain 4-digit year on its own
 * should NOT be classified as a date.
 */
const DATE_RE =
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{4}$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const BOOLEAN_TOKENS = new Set(["true", "false", "yes", "no", "1", "0"]);

function looksNumeric(str: string): boolean {
  // Accept integers, decimals, negatives, and numbers with commas as thousands separators.
  return /^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(str.trim());
}

function looksBoolean(str: string): boolean {
  return BOOLEAN_TOKENS.has(str.trim().toLowerCase());
}

function looksDate(str: string): boolean {
  if (!DATE_RE.test(str.trim())) return false;
  // Validate that the date parses to a real date
  const d = new Date(str.trim());
  return !isNaN(d.getTime());
}

/**
 * Infer the column type from a sample of non-missing string values.
 *
 * Strategy:
 *   1. Count how many values look like each type.
 *   2. A type wins if ≥ 80 % of non-missing values match — this allows for
 *      a small number of inconsistent values without changing the inferred type.
 *   3. Boolean is tested before number because "1"/"0" are numeric too;
 *      a column that's ONLY "true"/"false"/"yes"/"no" wins boolean.
 *   4. Date is tested before number for the same reason.
 *   5. Falls back to "text" if no threshold is met, or "unknown" if there are
 *      no non-missing values at all.
 */
function inferType(nonMissingValues: string[]): ColumnType {
  const total = nonMissingValues.length;
  if (total === 0) return "unknown";

  const threshold = 0.8;

  const boolCount = nonMissingValues.filter(looksBoolean).length;
  if (boolCount / total >= threshold) return "boolean";

  const dateCount = nonMissingValues.filter(looksDate).length;
  if (dateCount / total >= threshold) return "date";

  const numCount = nonMissingValues.filter(looksNumeric).length;
  if (numCount / total >= threshold) return "number";

  return "text";
}

// ---------------------------------------------------------------------------
// Numeric statistics
// ---------------------------------------------------------------------------

function parseNumeric(str: string): number {
  // Strip thousands-separator commas before parsing.
  return parseFloat(str.replace(/,/g, ""));
}

function calcMean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function calcMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calcStdDev(nums: number[], mean: number): number {
  const variance =
    nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function calcNumericStats(nonMissingValues: string[]): NumericStats {
  const nums = nonMissingValues.map(parseNumeric);
  const sorted = [...nums].sort((a, b) => a - b);
  const mean = calcMean(nums);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: calcMedian(sorted),
    stdDev: calcStdDev(nums, mean),
  };
}

// ---------------------------------------------------------------------------
// Outlier detection (IQR method)
// ---------------------------------------------------------------------------

/**
 * Returns the number of values outside [Q1 − 1.5×IQR, Q3 + 1.5×IQR].
 * Only meaningful for numeric columns with > 3 non-missing values.
 */
function countOutliers(nonMissingValues: string[]): number {
  if (nonMissingValues.length < 4) return 0;
  const sorted = nonMissingValues.map(parseNumeric).sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return 0; // All values equal — no outliers possible.
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return sorted.filter((v) => v < lower || v > upper).length;
}

// ---------------------------------------------------------------------------
// Date statistics
// ---------------------------------------------------------------------------

function calcDateStats(
  nonMissingValues: string[]
): { earliest: string; latest: string } {
  const times = nonMissingValues
    .map((v) => new Date(v.trim()).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);
  if (times.length === 0) return { earliest: "", latest: "" };
  return {
    earliest: new Date(times[0]).toISOString().slice(0, 10),
    latest: new Date(times[times.length - 1]).toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Inconsistency detection
// ---------------------------------------------------------------------------

/**
 * For a text/categorical column, find groups of raw values that share the
 * same normalised form (trim + lowercase) but differ in their original form.
 *
 * Only groups with ≥ 2 distinct raw representations are returned.
 * The original values are never modified.
 */
function detectInconsistentGroups(
  nonMissingValues: string[]
): InconsistentGroup[] {
  // Build a map: normalizedForm → Set<rawValue>
  const map = new Map<string, Set<string>>();
  for (const raw of nonMissingValues) {
    const norm = raw.trim().toLowerCase();
    if (!map.has(norm)) map.set(norm, new Set());
    map.get(norm)!.add(raw.trim()); // trim for display but keep original case
  }
  const groups: InconsistentGroup[] = [];
  for (const [normalizedForm, rawSet] of map) {
    if (rawSet.size >= 2) {
      groups.push({
        normalizedForm,
        rawValues: Array.from(rawSet),
      });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Duplicate-row detection
// ---------------------------------------------------------------------------

/**
 * Returns the number of rows that are exact duplicates of an earlier row.
 * Rows are compared by serialising all cell values to a string key.
 * The original dataset is not mutated.
 */
function countDuplicateRows(
  rows: Record<string, unknown>[],
  columnNames: string[]
): number {
  const seen = new Set<string>();
  let dupes = 0;
  for (const row of rows) {
    const key = columnNames.map((c) => String(row[c] ?? "")).join("\x00");
    if (seen.has(key)) {
      dupes++;
    } else {
      seen.add(key);
    }
  }
  return dupes;
}

// ---------------------------------------------------------------------------
// Quality score
// ---------------------------------------------------------------------------

/**
 * Calculates a data-quality score from 0–100 based on detected issues.
 *
 * Penalty schedule (all clamped to their maximum before summing):
 *   Missing values  : up to 30 pts  (missRatio × 30, where missRatio = missingCells / totalCells)
 *   Duplicate rows  : up to 20 pts  (dupRatio  × 20, where dupRatio  = duplicates  / rowCount)
 *   Inconsistencies : up to 20 pts  (5 pts per column with any inconsistent group, max 4 columns)
 *   Outliers        : up to 10 pts  (outlierRatio × 10, where outlierRatio = outlierCells / totalNumericCells)
 *
 * Final score = 100 − totalPenalty, clamped to [0, 100].
 */
function calcQualityScore({
  totalCells,
  totalMissing,
  rowCount,
  duplicateRowCount,
  columnsWithInconsistencies,
  totalNumericCells,
  totalOutliers,
}: {
  totalCells: number;
  totalMissing: number;
  rowCount: number;
  duplicateRowCount: number;
  columnsWithInconsistencies: number;
  totalNumericCells: number;
  totalOutliers: number;
}): number {
  const missPenalty =
    totalCells > 0 ? (totalMissing / totalCells) * 30 : 0;
  const dupPenalty =
    rowCount > 0 ? (duplicateRowCount / rowCount) * 20 : 0;
  const inconsistencyPenalty = Math.min(columnsWithInconsistencies, 4) * 5;
  const outlierPenalty =
    totalNumericCells > 0 ? (totalOutliers / totalNumericCells) * 10 : 0;

  const total = missPenalty + dupPenalty + inconsistencyPenalty + outlierPenalty;
  return Math.round(Math.max(0, Math.min(100, 100 - total)));
}

// ---------------------------------------------------------------------------
// Main profiler
// ---------------------------------------------------------------------------

/**
 * Profiles a parsed dataset.
 *
 * - Reads `dataset.rows` and `dataset.columns` but never modifies them.
 * - Returns a fully self-contained `DatasetProfile`.
 * - Designed to be called once after parsing; results are stored in context.
 * - The heavy loops are synchronous and suitable for Web Worker migration later.
 */
export function profileDataset(dataset: Dataset): DatasetProfile {
  const columnNames = dataset.columns.map((c) => c.name);
  const rows = dataset.rows;
  const rowCount = rows.length;

  // --- Per-column pass ---
  // For each column gather raw string values, classify, and compute stats.
  type ColAccum = {
    nonMissing: string[];
    missingCount: number;
  };

  const accumulators: ColAccum[] = columnNames.map(() => ({
    nonMissing: [],
    missingCount: 0,
  }));

  for (const row of rows) {
    for (let ci = 0; ci < columnNames.length; ci++) {
      const raw = row[columnNames[ci]];
      if (isMissing(raw)) {
        accumulators[ci].missingCount++;
      } else {
        accumulators[ci].nonMissing.push(String(raw));
      }
    }
  }

  // Track totals needed for scoring
  let totalMissing = 0;
  let totalNumericCells = 0;
  let totalOutliers = 0;
  let columnsWithInconsistencies = 0;

  const columnProfiles: ColumnProfile[] = columnNames.map((name, ci) => {
    const { nonMissing, missingCount } = accumulators[ci];
    totalMissing += missingCount;

    const inferredType = inferType(nonMissing);

    // Unique values
    const uniqueSet = new Set(nonMissing);
    const uniqueCount = uniqueSet.size;
    const uniqueRatio =
      nonMissing.length > 0 ? uniqueCount / nonMissing.length : 0;

    // Numeric stats + outliers
    let numericStats = null;
    let outlierCount = 0;
    if (inferredType === "number" && nonMissing.length > 0) {
      numericStats = calcNumericStats(nonMissing);
      outlierCount = countOutliers(nonMissing);
      totalNumericCells += nonMissing.length;
      totalOutliers += outlierCount;
    }

    // Date stats
    let dateStats = null;
    if (inferredType === "date" && nonMissing.length > 0) {
      dateStats = calcDateStats(nonMissing);
    }

    // Inconsistency detection (text/unknown columns only)
    let inconsistentGroups: InconsistentGroup[] = [];
    if (inferredType === "text" || inferredType === "unknown") {
      inconsistentGroups = detectInconsistentGroups(nonMissing);
      if (inconsistentGroups.length > 0) columnsWithInconsistencies++;
    }

    return {
      name,
      inferredType,
      totalValues: nonMissing.length,
      missingCount,
      uniqueCount,
      uniqueRatio,
      numericStats,
      dateStats,
      inconsistentGroups,
      outlierCount,
    } satisfies ColumnProfileInternal;
  });

  // --- Row-level pass for duplicates and incomplete rows ---
  const duplicateRowCount = countDuplicateRows(rows, columnNames);

  let incompleteRowCount = 0;
  for (const row of rows) {
    const hasAnyMissing = columnNames.some((c) => isMissing(row[c]));
    if (hasAnyMissing) incompleteRowCount++;
  }

  // --- Issues ---
  const issues: DataIssue[] = [];

  // Missing values — one issue per column that has any
  for (const col of columnProfiles) {
    if (col.missingCount > 0) {
      const ratio = col.missingCount / rowCount;
      const severity =
        ratio >= 0.2 ? "high" : ratio >= 0.05 ? "medium" : "low";
      issues.push({
        id: `missing_${col.name}`,
        type: "missing_values",
        severity,
        column: col.name,
        count: col.missingCount,
        description: `${col.missingCount.toLocaleString()} missing value${col.missingCount !== 1 ? "s" : ""} in \`${col.name}\``,
      });
    }
  }

  // Duplicate rows
  if (duplicateRowCount > 0) {
    const ratio = duplicateRowCount / rowCount;
    const severity = ratio >= 0.1 ? "high" : ratio >= 0.02 ? "medium" : "low";
    issues.push({
      id: "duplicate_rows",
      type: "duplicate_rows",
      severity,
      count: duplicateRowCount,
      description: `${duplicateRowCount.toLocaleString()} duplicate row${duplicateRowCount !== 1 ? "s" : ""} detected`,
    });
  }

  // Inconsistent values — one issue per affected column
  for (const col of columnProfiles) {
    if (col.inconsistentGroups.length > 0) {
      const affectedValues = col.inconsistentGroups.reduce(
        (sum, g) => sum + g.rawValues.length,
        0
      );
      issues.push({
        id: `inconsistent_${col.name}`,
        type: "inconsistent_values",
        severity: "medium",
        column: col.name,
        count: affectedValues,
        description: `\`${col.name}\` contains ${col.inconsistentGroups.length} group${col.inconsistentGroups.length !== 1 ? "s" : ""} of values that differ only in case or whitespace`,
      });
    }
  }

  // Potential outliers — use the count already computed in the column pass
  for (const col of columnProfiles as ColumnProfileInternal[]) {
    if (col.outlierCount > 0) {
      issues.push({
        id: `outliers_${col.name}`,
        type: "potential_outliers",
        severity: "low",
        column: col.name,
        count: col.outlierCount,
        description: `${col.outlierCount} potential outlier${col.outlierCount !== 1 ? "s" : ""} detected in \`${col.name}\``,
      });
    }
  }

  // --- Quality score ---
  const qualityScore = calcQualityScore({
    totalCells: rowCount * columnNames.length,
    totalMissing,
    rowCount,
    duplicateRowCount,
    columnsWithInconsistencies,
    totalNumericCells,
    totalOutliers,
  });

  return {
    rowCount,
    columnCount: columnNames.length,
    incompleteRowCount,
    duplicateRowCount,
    columns: columnProfiles,
    issues,
    qualityScore,
  };
}
