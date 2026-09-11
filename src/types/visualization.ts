import type { ColumnType } from "@/types/profile";

// ---------------------------------------------------------------------------
// Chart types supported by the visualization tab
// ---------------------------------------------------------------------------

export type ChartType =
  | "bar"        // categorical X, numeric Y — counts or aggregated value
  | "line"       // ordered X (date or numeric), numeric Y
  | "histogram"  // distribution of a single numeric column
  | "scatter"    // two numeric columns
  | "donut";     // categorical distribution (proportion)

// ---------------------------------------------------------------------------
// Aggregation functions for bar / line charts
// ---------------------------------------------------------------------------

export type AggregationFn = "count" | "sum" | "mean" | "min" | "max";

// ---------------------------------------------------------------------------
// A single visualization configuration created by the user
// ---------------------------------------------------------------------------

export interface VizConfig {
  /** Stable identifier (Date.now() string is fine) */
  id: string;
  chartType: ChartType;
  /** X-axis column (bar, line, scatter) or the single column (histogram, donut) */
  xColumn: string;
  /** Y-axis column (bar, line, scatter only) */
  yColumn: string | null;
  /** Aggregation function for bar / line charts */
  aggregation: AggregationFn;
  /** Whether to use the cleaned dataset when available */
  useCleanedData: boolean;
}

// ---------------------------------------------------------------------------
// Chart-ready data produced by the transform layer
// ---------------------------------------------------------------------------

export interface BarChartData {
  kind: "bar";
  labels: string[];
  values: number[];
  xLabel: string;
  yLabel: string;
}

export interface LineChartData {
  kind: "line";
  labels: string[];
  values: number[];
  xLabel: string;
  yLabel: string;
}

export interface HistogramData {
  kind: "histogram";
  bins: Array<{ label: string; count: number }>;
  xLabel: string;
}

export interface ScatterData {
  kind: "scatter";
  points: Array<{ x: number; y: number }>;
  xLabel: string;
  yLabel: string;
}

export interface DonutData {
  kind: "donut";
  slices: Array<{ label: string; value: number }>;
  xLabel: string;
}

export type ChartData =
  | BarChartData
  | LineChartData
  | HistogramData
  | ScatterData
  | DonutData;

// ---------------------------------------------------------------------------
// Recommendation system
// ---------------------------------------------------------------------------

export interface ChartRecommendation {
  chartType: ChartType;
  /** Short label to show in the UI */
  label: string;
  /** Default aggregation for this recommendation */
  defaultAggregation: AggregationFn;
  /** Whether a Y column is required */
  needsYColumn: boolean;
}

/** Map from ColumnType to the chart types that make sense for it. */
export const CHART_RECOMMENDATIONS: Record<ColumnType, ChartRecommendation[]> =
  {
    number: [
      {
        chartType: "histogram",
        label: "Histogram",
        defaultAggregation: "count",
        needsYColumn: false,
      },
      {
        chartType: "bar",
        label: "Bar chart",
        defaultAggregation: "mean",
        needsYColumn: false,
      },
    ],
    text: [
      {
        chartType: "donut",
        label: "Donut chart",
        defaultAggregation: "count",
        needsYColumn: false,
      },
      {
        chartType: "bar",
        label: "Bar chart",
        defaultAggregation: "count",
        needsYColumn: false,
      },
    ],
    boolean: [
      {
        chartType: "donut",
        label: "Donut chart",
        defaultAggregation: "count",
        needsYColumn: false,
      },
    ],
    date: [
      {
        chartType: "line",
        label: "Line chart",
        defaultAggregation: "count",
        needsYColumn: false,
      },
      {
        chartType: "bar",
        label: "Bar chart",
        defaultAggregation: "count",
        needsYColumn: false,
      },
    ],
    unknown: [
      {
        chartType: "bar",
        label: "Bar chart",
        defaultAggregation: "count",
        needsYColumn: false,
      },
    ],
  };
