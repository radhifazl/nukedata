import type { Dataset } from "@/types/dataset";
import type { DatasetProfile } from "@/types/profile";
import type {
  VizConfig,
  ChartData,
  BarChartData,
  LineChartData,
  HistogramData,
  ScatterData,
  DonutData,
  AggregationFn,
} from "@/types/visualization";
import { isMissing } from "@/utils/csv/profileDataset";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum distinct categories shown in bar / donut charts. */
const MAX_CATEGORIES = 30;
/** Number of histogram bins. */
const HISTOGRAM_BINS = 20;
/** Maximum scatter plot points rendered (random sample above this). */
const MAX_SCATTER_POINTS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number | null {
  if (isMissing(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function aggregate(values: number[], fn: AggregationFn): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case "count":
      return values.length;
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}

/**
 * Groups rows by the string value of `xColumn` and aggregates numeric values
 * of `yColumn` (or simply counts rows when `yColumn` is null).
 */
function groupAndAggregate(
  rows: Record<string, unknown>[],
  xColumn: string,
  yColumn: string | null,
  fn: AggregationFn
): Array<{ label: string; value: number }> {
  const buckets = new Map<string, number[]>();

  for (const row of rows) {
    const rawX = row[xColumn];
    if (isMissing(rawX)) continue;
    const label = String(rawX).trim();
    if (!buckets.has(label)) buckets.set(label, []);
    const bucket = buckets.get(label)!;

    if (yColumn) {
      const n = toNumber(row[yColumn]);
      if (n !== null) bucket.push(n);
    } else {
      bucket.push(1); // count
    }
  }

  const results = Array.from(buckets.entries()).map(([label, vals]) => ({
    label,
    value: fn === "count" ? vals.length : aggregate(vals, fn),
  }));

  // Sort descending by value, then truncate
  results.sort((a, b) => b.value - a.value);
  if (results.length > MAX_CATEGORIES) {
    const kept = results.slice(0, MAX_CATEGORIES - 1);
    const otherValue = results
      .slice(MAX_CATEGORIES - 1)
      .reduce((s, r) => s + r.value, 0);
    kept.push({ label: "Other", value: Math.round(otherValue * 100) / 100 });
    return kept;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Per-chart-type transforms
// ---------------------------------------------------------------------------

function buildBarData(
  config: VizConfig,
  rows: Record<string, unknown>[],
  profile: DatasetProfile
): BarChartData {
  const { xColumn, yColumn, aggregation } = config;
  const groups = groupAndAggregate(rows, xColumn, yColumn, aggregation);
  const yLabel = yColumn
    ? `${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of ${yColumn}`
    : "Count";

  return {
    kind: "bar",
    labels: groups.map((g) => g.label),
    values: groups.map((g) => g.value),
    xLabel: xColumn,
    yLabel,
  };
}

function buildLineData(
  config: VizConfig,
  rows: Record<string, unknown>[],
  profile: DatasetProfile
): LineChartData {
  const { xColumn, yColumn, aggregation } = config;
  const groups = groupAndAggregate(rows, xColumn, yColumn, aggregation);

  // Sort alphabetically / chronologically for line charts
  groups.sort((a, b) => a.label.localeCompare(b.label));

  const yLabel = yColumn
    ? `${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of ${yColumn}`
    : "Count";

  return {
    kind: "line",
    labels: groups.map((g) => g.label),
    values: groups.map((g) => g.value),
    xLabel: xColumn,
    yLabel,
  };
}

function buildHistogramData(
  config: VizConfig,
  rows: Record<string, unknown>[],
  profile: DatasetProfile
): HistogramData {
  const { xColumn } = config;
  const colProfile = profile.columns.find((c) => c.name === xColumn);

  // Collect numeric values
  const values: number[] = [];
  for (const row of rows) {
    const n = toNumber(row[xColumn]);
    if (n !== null) values.push(n);
  }

  if (values.length === 0) {
    return { kind: "histogram", bins: [], xLabel: xColumn };
  }

  const min = colProfile?.numericStats?.min ?? Math.min(...values);
  const max = colProfile?.numericStats?.max ?? Math.max(...values);

  if (min === max) {
    return {
      kind: "histogram",
      bins: [{ label: String(min), count: values.length }],
      xLabel: xColumn,
    };
  }

  const binCount = Math.min(HISTOGRAM_BINS, Math.ceil(Math.sqrt(values.length)));
  const binWidth = (max - min) / binCount;
  const counts = new Array<number>(binCount).fill(0);

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
    counts[idx]++;
  }

  const bins = counts.map((count, i) => {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    const label =
      `${lo % 1 === 0 ? lo : lo.toFixed(1)}–${hi % 1 === 0 ? hi : hi.toFixed(1)}`;
    return { label, count };
  });

  return { kind: "histogram", bins, xLabel: xColumn };
}

function buildScatterData(
  config: VizConfig,
  rows: Record<string, unknown>[]
): ScatterData {
  const { xColumn, yColumn } = config;
  if (!yColumn) {
    return { kind: "scatter", points: [], xLabel: xColumn, yLabel: "" };
  }

  const allPoints: Array<{ x: number; y: number }> = [];
  for (const row of rows) {
    const x = toNumber(row[xColumn]);
    const y = toNumber(row[yColumn]);
    if (x !== null && y !== null) allPoints.push({ x, y });
  }

  // Sample if too many points
  let points = allPoints;
  if (allPoints.length > MAX_SCATTER_POINTS) {
    // Reservoir-style: pick evenly spaced indices
    const step = allPoints.length / MAX_SCATTER_POINTS;
    points = [];
    for (let i = 0; i < MAX_SCATTER_POINTS; i++) {
      points.push(allPoints[Math.floor(i * step)]);
    }
  }

  return {
    kind: "scatter",
    points,
    xLabel: xColumn,
    yLabel: yColumn,
  };
}

function buildDonutData(
  config: VizConfig,
  rows: Record<string, unknown>[]
): DonutData {
  const { xColumn } = config;
  const groups = groupAndAggregate(rows, xColumn, null, "count");

  return {
    kind: "donut",
    slices: groups.map((g) => ({ label: g.label, value: g.value })),
    xLabel: xColumn,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Transforms a dataset + viz config into chart-ready data.
 * All heavy computation lives here — the chart component only renders.
 */
export function transformForChart(
  config: VizConfig,
  dataset: Dataset,
  profile: DatasetProfile
): ChartData {
  const rows = dataset.rows;

  switch (config.chartType) {
    case "bar":
      return buildBarData(config, rows, profile);
    case "line":
      return buildLineData(config, rows, profile);
    case "histogram":
      return buildHistogramData(config, rows, profile);
    case "scatter":
      return buildScatterData(config, rows);
    case "donut":
      return buildDonutData(config, rows);
  }
}
