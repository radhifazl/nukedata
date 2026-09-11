"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ChartData } from "@/types/visualization";

// ---------------------------------------------------------------------------
// Colour palette — limited, consistent, avoids purple/red confusion
// ---------------------------------------------------------------------------

const PALETTE = [
  "#3447a6",
  "#0ea5a0",
  "#f0ad55",
  "#5ad5a6",
  "#8797fa",
  "#f48d8d",
  "#a3adbd",
  "#667085",
];

function colour(i: number): string {
  return PALETTE[i % PALETTE.length];
}

// ---------------------------------------------------------------------------
// Shared axis / tooltip style
// ---------------------------------------------------------------------------

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
};

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--foreground)",
};

// ---------------------------------------------------------------------------
// Helper: truncate long tick labels
// ---------------------------------------------------------------------------

function truncateTick(value: string, maxLen = 14): string {
  if (typeof value !== "string") return String(value);
  return value.length > maxLen ? value.slice(0, maxLen - 1) + "…" : value;
}

// ---------------------------------------------------------------------------
// Sub-components per chart kind
// ---------------------------------------------------------------------------

function BarViz({ data }: { data: Extract<ChartData, { kind: "bar" }> }) {
  const chartData = data.labels.map((label, i) => ({
    label,
    value: data.values[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ ...AXIS_STYLE }}
          tickFormatter={(v) => truncateTick(v)}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={60}
          label={{
            value: data.xLabel,
            position: "insideBottom",
            offset: -10,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
        />
        <YAxis
          tick={{ ...AXIS_STYLE }}
          width={55}
          label={{
            value: data.yLabel,
            angle: -90,
            position: "insideLeft",
            offset: 10,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [
            typeof value === "number" ? value.toLocaleString() : String(value ?? ""),
            data.yLabel,
          ]}
        />
        <Bar dataKey="value" fill={colour(0)} radius={[2, 2, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineViz({ data }: { data: Extract<ChartData, { kind: "line" }> }) {
  const chartData = data.labels.map((label, i) => ({
    label,
    value: data.values[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ ...AXIS_STYLE }}
          tickFormatter={(v) => truncateTick(v)}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={60}
          label={{
            value: data.xLabel,
            position: "insideBottom",
            offset: -10,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
        />
        <YAxis
          tick={{ ...AXIS_STYLE }}
          width={55}
          label={{
            value: data.yLabel,
            angle: -90,
            position: "insideLeft",
            offset: 10,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [
            typeof value === "number" ? value.toLocaleString() : String(value ?? ""),
            data.yLabel,
          ]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={colour(0)}
          strokeWidth={2}
          dot={chartData.length <= 60}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function HistogramViz({
  data,
}: {
  data: Extract<ChartData, { kind: "histogram" }>;
}) {
  const chartData = data.bins.map((b) => ({ label: b.label, count: b.count }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 0, bottom: 56 }}
        barCategoryGap="2%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ ...AXIS_STYLE }}
          tickFormatter={(v) => truncateTick(v, 10)}
          angle={-40}
          textAnchor="end"
          interval={0}
          height={64}
          label={{
            value: data.xLabel,
            position: "insideBottom",
            offset: -14,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
        />
        <YAxis
          tick={{ ...AXIS_STYLE }}
          width={50}
          label={{
            value: "Count",
            angle: -90,
            position: "insideLeft",
            offset: 10,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [
            typeof value === "number" ? value.toLocaleString() : String(value ?? ""),
            "Count",
          ]}
        />
        <Bar dataKey="count" fill={colour(2)} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ScatterViz({
  data,
}: {
  data: Extract<ChartData, { kind: "scatter" }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="x"
          name={data.xLabel}
          tick={{ ...AXIS_STYLE }}
          label={{
            value: data.xLabel,
            position: "insideBottom",
            offset: -8,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
          height={40}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={data.yLabel}
          tick={{ ...AXIS_STYLE }}
          width={55}
          label={{
            value: data.yLabel,
            angle: -90,
            position: "insideLeft",
            offset: 10,
            style: { ...AXIS_STYLE, fontWeight: 500 },
          }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(value, name) => [
            typeof value === "number" ? value.toLocaleString() : String(value ?? ""),
            String(name ?? ""),
          ]}
        />
        <Scatter data={data.points} fill={colour(0)} opacity={0.65} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function DonutViz({ data }: { data: Extract<ChartData, { kind: "donut" }> }) {
  const total = data.slices.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data.slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="40%"
            outerRadius="70%"
            paddingAngle={2}
          >
            {data.slices.map((_, i) => (
              <Cell key={i} fill={colour(i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [
              typeof value === "number"
                ? `${value.toLocaleString()} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`
                : String(value ?? ""),
              String(name ?? ""),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
            formatter={(value) => truncateTick(value, 20)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface VizChartProps {
  data: ChartData;
}

/**
 * Renders the appropriate Recharts chart for the given chart data.
 * No side effects — purely declarative.
 */
export function VizChart({ data }: VizChartProps) {
  switch (data.kind) {
    case "bar":
      return <BarViz data={data} />;
    case "line":
      return <LineViz data={data} />;
    case "histogram":
      return <HistogramViz data={data} />;
    case "scatter":
      return <ScatterViz data={data} />;
    case "donut":
      return <DonutViz data={data} />;
  }
}
