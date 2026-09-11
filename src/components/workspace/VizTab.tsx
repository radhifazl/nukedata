"use client";
import { useState, useMemo } from "react";
import type { DatasetProfile } from "@/types/profile";
import type { VizConfig, ChartType, AggregationFn } from "@/types/visualization";
import { CHART_RECOMMENDATIONS } from "@/types/visualization";
import { useDataset } from "@/context/DatasetContext";
import { VizChart } from "./VizChart";
import { transformForChart } from "@/utils/visualization/transform";
import {
  buildDefaultConfig,
  getYColumnCandidates,
  getAvailableAggregations,
  aggregationLabel,
  getRecommendations,
} from "@/utils/visualization/recommend";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: "Bar chart",
  line: "Line chart",
  histogram: "Histogram",
  scatter: "Scatter plot",
  donut: "Donut chart",
};

// ---------------------------------------------------------------------------
// VizCard — one visualization block
// ---------------------------------------------------------------------------

interface VizCardProps {
  config: VizConfig;
  profile: DatasetProfile;
  onUpdate: (updated: VizConfig) => void;
  onRemove: () => void;
}

function VizCard({ config, profile, onUpdate, onRemove }: VizCardProps) {
  const { dataset, cleanedDataset } = useDataset();
  const [expanded, setExpanded] = useState(true);

  const activeDataset = config.useCleanedData && cleanedDataset
    ? cleanedDataset
    : dataset;

  const activeProfile = useMemo(() => {
    if (config.useCleanedData && cleanedDataset) {
      // When using cleaned data, profile is already computed in context
      // but we need the profile for the active dataset. Use the original
      // profile for column metadata (types/stats are the same structure).
    }
    return profile;
  }, [config.useCleanedData, cleanedDataset, profile]);

  const xColProfile = profile.columns.find((c) => c.name === config.xColumn);

  const chartData = useMemo(() => {
    if (!activeDataset) return null;
    try {
      return transformForChart(config, activeDataset, activeProfile);
    } catch {
      return null;
    }
  }, [config, activeDataset, activeProfile]);

  const yColumnCandidates = useMemo(
    () => getYColumnCandidates(profile, config.chartType, config.xColumn),
    [profile, config.chartType, config.xColumn]
  );

  const availableAggregations = useMemo(
    () => getAvailableAggregations(config.chartType, config.yColumn !== null),
    [config.chartType, config.yColumn]
  );

  const recommendedChartTypes: ChartType[] = xColProfile
    ? getRecommendations(xColProfile.inferredType).map((r) => r.chartType)
    : (Object.keys(CHART_RECOMMENDATIONS) as ChartType[]);

  // All chart types always available; recommended ones appear first
  const allChartTypes: ChartType[] = [
    ...recommendedChartTypes,
    ...Object.keys(CHART_TYPE_LABELS).filter(
      (t) => !recommendedChartTypes.includes(t as ChartType)
    ) as ChartType[],
  ];

  function handleXColumnChange(name: string) {
    const newXProfile = profile.columns.find((c) => c.name === name);
    if (!newXProfile) return;
    const recs = getRecommendations(newXProfile.inferredType);
    const firstRec = recs[0];
    onUpdate({
      ...config,
      xColumn: name,
      chartType: firstRec.chartType,
      aggregation: firstRec.defaultAggregation,
      yColumn: null,
    });
  }

  function handleChartTypeChange(chartType: ChartType) {
    const needsY = chartType === "scatter";
    const newAgg: AggregationFn =
      chartType === "histogram" || chartType === "donut" ? "count" : config.aggregation;
    onUpdate({
      ...config,
      chartType,
      yColumn: needsY ? config.yColumn : null,
      aggregation: newAgg,
    });
  }

  function handleYColumnChange(name: string) {
    onUpdate({
      ...config,
      yColumn: name === "" ? null : name,
      aggregation: name === "" ? "count" : config.aggregation,
    });
  }

  function handleAggregationChange(fn: AggregationFn) {
    onUpdate({ ...config, aggregation: fn });
  }

  const hasCleanedData = !!cleanedDataset;
  const showYColumn =
    config.chartType === "scatter" ||
    config.chartType === "bar" ||
    config.chartType === "line";

  // Empty state messages
  let emptyMessage: string | null = null;
  if (chartData) {
    if (chartData.kind === "bar" && chartData.labels.length === 0)
      emptyMessage = "No data to display for this selection.";
    else if (chartData.kind === "line" && chartData.labels.length === 0)
      emptyMessage = "No data to display for this selection.";
    else if (chartData.kind === "histogram" && chartData.bins.length === 0)
      emptyMessage = "This column has no numeric values to display.";
    else if (chartData.kind === "scatter" && chartData.points.length === 0)
      emptyMessage = config.yColumn
        ? "No rows with valid values in both columns."
        : "Select a Y column to plot a scatter chart.";
    else if (chartData.kind === "donut" && chartData.slices.length === 0)
      emptyMessage = "No data to display for this selection.";
  }

  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-elevated">
        <span className="text-sm font-medium flex-1 truncate">
          {CHART_TYPE_LABELS[config.chartType]}
          <span className="ml-2 text-muted-foreground font-normal">
            — {config.xColumn}
            {config.yColumn ? ` vs ${config.yColumn}` : ""}
          </span>
        </span>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-muted-foreground hover:text-foreground transition-colors text-xs px-2 py-1 rounded hover:bg-muted"
          title={expanded ? "Collapse" : "Expand"}
          aria-label={expanded ? "Collapse chart" : "Expand chart"}
        >
          {expanded ? "▲ Collapse" : "▼ Expand"}
        </button>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-danger transition-colors text-xs px-2 py-1 rounded hover:bg-muted"
          title="Remove chart"
          aria-label="Remove chart"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="p-4 flex flex-col gap-4">
          {/* Controls row */}
          <div className="flex flex-wrap gap-3">
            {/* Column selector */}
            <label className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-xs text-muted-foreground font-medium">Column</span>
              <select
                value={config.xColumn}
                onChange={(e) => handleXColumnChange(e.target.value)}
                className="text-sm border border-border rounded px-2 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {profile.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Chart type selector */}
            <label className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-xs text-muted-foreground font-medium">Chart type</span>
              <select
                value={config.chartType}
                onChange={(e) => handleChartTypeChange(e.target.value as ChartType)}
                className="text-sm border border-border rounded px-2 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {allChartTypes.map((ct) => (
                  <option key={ct} value={ct}>
                    {CHART_TYPE_LABELS[ct]}
                    {recommendedChartTypes.includes(ct) ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </label>

            {/* Y column selector (scatter/bar/line) */}
            {showYColumn && (
              <label className="flex flex-col gap-1 min-w-[140px]">
                <span className="text-xs text-muted-foreground font-medium">
                  Y column
                  {config.chartType === "scatter" && (
                    <span className="ml-1 text-danger">*</span>
                  )}
                </span>
                <select
                  value={config.yColumn ?? ""}
                  onChange={(e) => handleYColumnChange(e.target.value)}
                  className="text-sm border border-border rounded px-2 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— None (count rows)</option>
                  {yColumnCandidates.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {yColumnCandidates.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No numeric columns available
                  </span>
                )}
              </label>
            )}

            {/* Aggregation selector */}
            {availableAggregations.length > 1 && (
              <label className="flex flex-col gap-1 min-w-[120px]">
                <span className="text-xs text-muted-foreground font-medium">Aggregation</span>
                <select
                  value={config.aggregation}
                  onChange={(e) =>
                    handleAggregationChange(e.target.value as AggregationFn)
                  }
                  className="text-sm border border-border rounded px-2 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableAggregations.map((fn) => (
                    <option key={fn} value={fn}>
                      {aggregationLabel(fn)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Data version toggle */}
            {hasCleanedData && (
              <label className="flex flex-col gap-1 justify-end">
                <span className="text-xs text-muted-foreground font-medium">
                  Data version
                </span>
                <div className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    id={`cleaned-${config.id}`}
                    checked={config.useCleanedData}
                    onChange={(e) =>
                      onUpdate({ ...config, useCleanedData: e.target.checked })
                    }
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  <label
                    htmlFor={`cleaned-${config.id}`}
                    className="cursor-pointer select-none text-foreground"
                  >
                    Use cleaned data
                  </label>
                </div>
              </label>
            )}
          </div>

          {/* Chart */}
          {!chartData ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Unable to render chart.
            </div>
          ) : emptyMessage ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <VizChart data={chartData} />
          )}

          {/* Sample/truncation notice */}
          {chartData && chartData.kind === "scatter" && !emptyMessage && (
            (() => {
              const totalRows = (activeDataset?.rows.length ?? 0);
              if (totalRows > 500) {
                return (
                  <p className="text-xs text-muted-foreground">
                    Showing a sample of 500 points from {totalRows.toLocaleString()} rows.
                  </p>
                );
              }
              return null;
            })()
          )}
          {chartData &&
            (chartData.kind === "bar" || chartData.kind === "donut") &&
            !emptyMessage &&
            (() => {
              const totalCats = chartData.kind === "bar"
                ? chartData.labels.length
                : chartData.slices.length;
              if (
                chartData.kind === "bar" &&
                chartData.labels[chartData.labels.length - 1] === "Other"
              ) {
                return (
                  <p className="text-xs text-muted-foreground">
                    Showing top 29 categories. Remaining values are grouped as "Other".
                  </p>
                );
              }
              if (
                chartData.kind === "donut" &&
                chartData.slices[chartData.slices.length - 1]?.label === "Other"
              ) {
                return (
                  <p className="text-xs text-muted-foreground">
                    Showing top 29 categories. Remaining values are grouped as "Other".
                  </p>
                );
              }
              return null;
            })()
          }
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VizTab — public entry point
// ---------------------------------------------------------------------------

interface VizTabProps {
  profile: DatasetProfile;
}

export function VizTab({ profile }: VizTabProps) {
  const { dataset } = useDataset();
  const [configs, setConfigs] = useState<VizConfig[]>([]);

  function addChart() {
    if (!profile.columns.length) return;
    // Pick the first column that has data
    const col =
      profile.columns.find((c) => c.totalValues > 0) ?? profile.columns[0];
    const id = String(Date.now());
    setConfigs((prev) => [...prev, buildDefaultConfig(col, id)]);
  }

  function updateConfig(updated: VizConfig) {
    setConfigs((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  function removeConfig(id: string) {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  }

  if (!dataset) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Visualize</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explore your dataset with charts. Each chart can be independently
            configured.
          </p>
        </div>
        <button
          onClick={addChart}
          className="button-secondary text-sm flex items-center gap-1.5"
        >
          <span aria-hidden>+</span> Add chart
        </button>
      </div>

      {/* Empty state */}
      {configs.length === 0 && (
        <div className="rounded-md border border-border border-dashed bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium">No charts yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Add a chart to start exploring{" "}
            <span className="font-medium">{dataset.name}</span>.
          </p>
          <button onClick={addChart} className="button-primary text-sm">
            Add your first chart
          </button>
        </div>
      )}

      {/* Chart cards */}
      {configs.map((config) => (
        <VizCard
          key={config.id}
          config={config}
          profile={profile}
          onUpdate={updateConfig}
          onRemove={() => removeConfig(config.id)}
        />
      ))}
    </div>
  );
}
