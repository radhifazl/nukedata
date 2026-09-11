import type { DatasetProfile, ColumnProfile, ColumnType } from "@/types/profile";
import type {
  ChartRecommendation,
  ChartType,
  AggregationFn,
  VizConfig,
} from "@/types/visualization";
import { CHART_RECOMMENDATIONS } from "@/types/visualization";

/**
 * Returns the ordered list of chart recommendations for a given column type.
 * The first entry is the default/preferred option.
 */
export function getRecommendations(type: ColumnType): ChartRecommendation[] {
  return CHART_RECOMMENDATIONS[type] ?? CHART_RECOMMENDATIONS.unknown;
}

/**
 * Returns the default (first) recommendation for a column type.
 */
export function getDefaultRecommendation(
  type: ColumnType
): ChartRecommendation {
  return getRecommendations(type)[0];
}

/**
 * Builds a default VizConfig for a given column.
 * Used when the user adds a new visualization.
 */
export function buildDefaultConfig(
  column: ColumnProfile,
  id: string
): VizConfig {
  const rec = getDefaultRecommendation(column.inferredType);
  return {
    id,
    chartType: rec.chartType,
    xColumn: column.name,
    yColumn: null,
    aggregation: rec.defaultAggregation,
    useCleanedData: false,
  };
}

/**
 * Returns column candidates for the Y axis given a chart type.
 * For scatter / bar / line, the Y column must be numeric.
 */
export function getYColumnCandidates(
  profile: DatasetProfile,
  chartType: ChartType,
  xColumn: string
): ColumnProfile[] {
  if (chartType !== "scatter" && chartType !== "bar" && chartType !== "line") {
    return [];
  }
  return profile.columns.filter(
    (c) => c.name !== xColumn && c.inferredType === "number"
  );
}

/**
 * Returns a human-readable label for an aggregation function.
 */
export function aggregationLabel(fn: AggregationFn): string {
  switch (fn) {
    case "count":
      return "Count";
    case "sum":
      return "Sum";
    case "mean":
      return "Average";
    case "min":
      return "Min";
    case "max":
      return "Max";
  }
}

/**
 * Returns the aggregation functions available for a given chart type and
 * whether a Y column is present.
 */
export function getAvailableAggregations(
  chartType: ChartType,
  hasYColumn: boolean
): AggregationFn[] {
  if (chartType === "histogram" || chartType === "donut") {
    // These charts always use count internally; no user choice
    return ["count"];
  }
  if (chartType === "scatter") {
    // Scatter doesn't aggregate
    return ["count"];
  }
  if (hasYColumn) {
    return ["sum", "mean", "min", "max"];
  }
  return ["count"];
}
