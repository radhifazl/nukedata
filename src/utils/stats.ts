/**
 * Centralized statistical utilities used by:
 *   - profileDataset (profiling pass)
 *   - CleaningPanel (fill-missing mean/median suggestions)
 *
 * All functions operate on arrays of already-validated numbers or strings.
 * None of these functions treat missing values as zero.
 *
 * Convention: population statistics (not sample) are used throughout, since
 * we are describing the entire uploaded dataset, not estimating a population.
 * Labels in the UI say "Std Dev" not "s" to avoid confusion.
 */

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/** Parse a raw cell string to a finite number, stripping thousands-separator commas. */
export function parseNumericValue(str: string): number | null {
  const n = parseFloat(str.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Returns the percentile value at position p (0–1) using linear interpolation. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function calcSum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

export function calcMean(nums: number[]): number {
  if (nums.length === 0) return NaN;
  return calcSum(nums) / nums.length;
}

export function calcMedian(sorted: number[]): number {
  return percentile(sorted, 0.5);
}

export function calcVariance(nums: number[], mean: number): number {
  if (nums.length === 0) return NaN;
  // Population variance
  return nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / nums.length;
}

export function calcStdDev(nums: number[], mean: number): number {
  return Math.sqrt(calcVariance(nums, mean));
}

// ---------------------------------------------------------------------------
// Full numeric stats
// ---------------------------------------------------------------------------

export interface NumericColumnStats {
  count: number;        // non-missing values
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  variance: number;
  stdDev: number;
  p10: number;
  p90: number;
  p95: number;
  p99: number;
}

/**
 * Compute all numeric statistics from an array of already-validated numeric strings.
 * Returns null when the input is empty.
 */
export function calcNumericStats(nonMissingValues: string[]): NumericColumnStats | null {
  if (nonMissingValues.length === 0) return null;

  const nums = nonMissingValues
    .map(parseNumericValue)
    .filter((n): n is number => n !== null);

  if (nums.length === 0) return null;

  const sorted = [...nums].sort((a, b) => a - b);
  const mean = calcMean(nums);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);

  return {
    count: nums.length,
    sum: calcSum(nums),
    mean,
    median: calcMedian(sorted),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    q1,
    q3,
    iqr: q3 - q1,
    variance: calcVariance(nums, mean),
    stdDev: calcStdDev(nums, mean),
    p10: percentile(sorted, 0.1),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

// ---------------------------------------------------------------------------
// Outlier detection — IQR method
// reused by both profiler and CleaningPanel
// ---------------------------------------------------------------------------

/**
 * Returns the number of values outside [Q1 − 1.5×IQR, Q3 + 1.5×IQR].
 * Only meaningful for columns with ≥ 4 non-missing values.
 */
export function countOutliers(nonMissingValues: string[]): number {
  if (nonMissingValues.length < 4) return 0;
  const nums = nonMissingValues
    .map(parseNumericValue)
    .filter((n): n is number => n !== null);
  if (nums.length < 4) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return 0;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return nums.filter((v) => v < lower || v > upper).length;
}

/**
 * Returns the row indices (into `rows`) of outliers in the given column.
 * Used by CleaningPanel.
 */
export function getOutlierRowIndices(
  rows: Record<string, unknown>[],
  column: string,
  isMissingFn: (v: unknown) => boolean
): number[] {
  const nums: Array<{ idx: number; val: number }> = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][column];
    if (isMissingFn(raw)) continue;
    const n = parseNumericValue(String(raw));
    if (n !== null) nums.push({ idx: i, val: n });
  }
  if (nums.length < 4) return [];
  const sorted = nums.map((r) => r.val).sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return [];
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return nums.filter((r) => r.val < lower || r.val > upper).map((r) => r.idx);
}

// ---------------------------------------------------------------------------
// Categorical / mode statistics
// ---------------------------------------------------------------------------

export interface TopValue {
  value: string;
  count: number;
  percentage: number; // 0–100
}

export interface CategoricalColumnStats {
  /** Most frequent value(s). Multiple entries when tied. */
  modes: TopValue[];
  /** Top N values by frequency (includes the mode). */
  topValues: TopValue[];
}

const TOP_N = 10;

/**
 * Computes mode and top-N values for a categorical/text column.
 * Operates on non-missing string values.
 * Handles ties (multiple values with equal highest frequency).
 */
export function calcCategoricalStats(
  nonMissingValues: string[],
  totalRows: number
): CategoricalColumnStats | null {
  if (nonMissingValues.length === 0) return null;

  // Frequency map
  const freq = new Map<string, number>();
  for (const v of nonMissingValues) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }

  // Sort by frequency desc, then alphabetically for stable ordering
  const sorted = Array.from(freq.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  const maxFreq = sorted[0][1];

  // All values tied at the top frequency are considered modes
  const modes: TopValue[] = sorted
    .filter(([, c]) => c === maxFreq)
    .map(([value, count]) => ({
      value,
      count,
      percentage: totalRows > 0 ? (count / totalRows) * 100 : 0,
    }));

  const topValues: TopValue[] = sorted.slice(0, TOP_N).map(([value, count]) => ({
    value,
    count,
    percentage: totalRows > 0 ? (count / totalRows) * 100 : 0,
  }));

  return { modes, topValues };
}

// ---------------------------------------------------------------------------
// Date statistics
// ---------------------------------------------------------------------------

export interface DateColumnStats {
  earliest: string;
  latest: string;
  /** Number of calendar days between earliest and latest */
  rangeDays: number | null;
}

export function calcDateStats(nonMissingValues: string[]): DateColumnStats | null {
  if (nonMissingValues.length === 0) return null;
  const times = nonMissingValues
    .map((v) => new Date(v.trim()).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);
  if (times.length === 0) return null;
  const earliest = new Date(times[0]).toISOString().slice(0, 10);
  const latest = new Date(times[times.length - 1]).toISOString().slice(0, 10);
  const rangeDays = Math.round((times[times.length - 1] - times[0]) / 86_400_000);
  return { earliest, latest, rangeDays };
}

// ---------------------------------------------------------------------------
// Boolean statistics
// ---------------------------------------------------------------------------

export interface BooleanColumnStats {
  trueCount: number;
  falseCount: number;
  truePercentage: number;
  falsePercentage: number;
}

const TRUE_TOKENS = new Set(["true", "yes", "1"]);
const FALSE_TOKENS = new Set(["false", "no", "0"]);

export function calcBooleanStats(
  nonMissingValues: string[],
  totalRows: number
): BooleanColumnStats | null {
  if (nonMissingValues.length === 0) return null;
  let trueCount = 0;
  let falseCount = 0;
  for (const v of nonMissingValues) {
    const lower = v.trim().toLowerCase();
    if (TRUE_TOKENS.has(lower)) trueCount++;
    else if (FALSE_TOKENS.has(lower)) falseCount++;
  }
  return {
    trueCount,
    falseCount,
    truePercentage: totalRows > 0 ? (trueCount / totalRows) * 100 : 0,
    falsePercentage: totalRows > 0 ? (falseCount / totalRows) * 100 : 0,
  };
}
