"use client";
import { useState, useMemo } from "react";
import type { DataIssue } from "@/types/profile";
import type { CleaningOperation } from "@/types/cleaning";
import { useDataset } from "@/context/DatasetContext";
import { isMissing } from "@/utils/csv/profileDataset";

interface CleaningPanelProps {
  issue: DataIssue | null;
  onClose: () => void;
}

export function CleaningPanel({ issue, onClose }: CleaningPanelProps) {
  if (!issue) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center border border-border bg-surface p-8 text-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Select an issue to fix</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click any issue on the left to open a cleaning panel.
          </p>
        </div>
      </div>
    );
  }

  return <ActiveCleaningPanel issue={issue} onClose={onClose} />;
}

function ActiveCleaningPanel({
  issue,
  onClose,
}: {
  issue: DataIssue;
  onClose: () => void;
}) {
  const { dataset, cleanedDataset, addOperation } = useDataset();

  if (!dataset) return null;

  // Use the current effective dataset so previews and computations reflect the
  // state after prior operations, not the original unmodified data.
  const effectiveDataset = cleanedDataset ?? dataset;

  switch (issue.type) {
    case "duplicate_rows":
      return (
        <DuplicatesPanel issue={issue} dataset={effectiveDataset} addOperation={addOperation} onClose={onClose} />
      );
    case "missing_values":
      return (
        <MissingValuesPanel
          issue={issue}
          dataset={effectiveDataset}
          colType={getColType(issue, effectiveDataset)}
          addOperation={addOperation}
          onClose={onClose}
        />
      );
    case "inconsistent_values":
      return (
        <InconsistentPanel
          issue={issue}
          dataset={effectiveDataset}
          addOperation={addOperation}
          onClose={onClose}
        />
      );
    case "potential_outliers":
      return (
        <OutliersPanel
          issue={issue}
          dataset={effectiveDataset}
          addOperation={addOperation}
          onClose={onClose}
        />
      );
    default:
      return (
        <div className="border border-border bg-surface p-6 text-sm text-muted-foreground">
          No cleaning action available for this issue type.
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColType(
  issue: DataIssue,
  dataset: import("@/types/dataset").Dataset
): "text" | "number" | "date" {
  if (!issue.column) return "text";
  // Simple heuristic: scan non-missing values
  const vals = dataset.rows
    .map((r) => r[issue.column!])
    .filter((v) => !isMissing(v))
    .map((v) => String(v))
    .slice(0, 50);
  const numericCount = vals.filter((v) =>
    /^-?\d+(\.\d+)?$/.test(v.trim())
  ).length;
  const dateCount = vals.filter((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && v.includes("-");
  }).length;
  const threshold = vals.length * 0.7;
  if (numericCount >= threshold && threshold > 0) return "number";
  if (dateCount >= threshold && threshold > 0) return "date";
  return "text";
}

function calcMean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function calcMedian(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function uniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function PanelWrapper({
  title,
  description,
  children,
  onApply,
  onClose,
  applyLabel,
  applyDisabled,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onApply: () => void;
  onClose: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
}) {
  return (
    <div className="border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <button onClick={onClose} className="button-secondary px-4 py-1.5 text-sm min-h-0">
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={applyDisabled}
          className="button-primary px-4 py-1.5 text-sm min-h-0 disabled:opacity-50"
        >
          {applyLabel ?? "Apply"}
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function Preview({ before, after }: { before: string[]; after: string[] }) {
  if (before.length === 0) return null;
  return (
    <div>
      <SectionLabel>Before / After preview</SectionLabel>
      <div className="mt-1.5 grid grid-cols-2 gap-px border border-border bg-border text-xs">
        <div className="bg-surface px-3 py-2">
          <p className="mb-1 font-medium text-muted-foreground">Before</p>
          {before.map((v, i) => (
            <p key={i} className="truncate font-mono text-foreground py-0.5">
              {v || <span className="italic text-danger/70">missing</span>}
            </p>
          ))}
        </div>
        <div className="bg-surface px-3 py-2">
          <p className="mb-1 font-medium text-success">After</p>
          {after.map((v, i) => (
            <p key={i} className="truncate font-mono text-foreground py-0.5">
              {v || <span className="italic text-danger/70">missing</span>}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Duplicates Panel
// ---------------------------------------------------------------------------

function DuplicatesPanel({
  issue,
  dataset,
  addOperation,
  onClose,
}: {
  issue: DataIssue;
  dataset: import("@/types/dataset").Dataset;
  addOperation: (op: CleaningOperation) => void;
  onClose: () => void;
}) {
  const [keep, setKeep] = useState<"first" | "last">("first");

  // Preview: show up to 10 duplicate rows
  const dupRows = useMemo(() => {
    const colNames = dataset.columns.map((c) => c.name);
    const seen = new Map<string, number>();
    const dupes: { idx: number; key: string }[] = [];
    for (let i = 0; i < dataset.rows.length; i++) {
      const key = colNames.map((c) => String(dataset.rows[i][c] ?? "")).join("\x00");
      if (seen.has(key)) {
        dupes.push({ idx: i, key });
      } else {
        seen.set(key, i);
      }
    }
    return dupes.slice(0, 10);
  }, [dataset]);

  function handleApply() {
    addOperation({
      id: uniqueId(),
      type: "remove_duplicates",
      config: { keep },
      description: `Remove ${issue.count} duplicate row${issue.count !== 1 ? "s" : ""} (keep ${keep})`,
      affectedCount: issue.count,
    });
    onClose();
  }

  return (
    <PanelWrapper
      title="Remove duplicate rows"
      description={issue.description}
      onApply={handleApply}
      onClose={onClose}
      applyLabel={`Remove ${issue.count} duplicate${issue.count !== 1 ? "s" : ""}`}
    >
      <div>
        <SectionLabel>Which copy to keep</SectionLabel>
        <div className="mt-2 flex flex-col gap-2">
          {(["first", "last"] as const).map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="dup-keep"
                value={opt}
                checked={keep === opt}
                onChange={() => setKeep(opt)}
                className="accent-primary"
              />
              Keep {opt} occurrence
            </label>
          ))}
        </div>
      </div>

      {dupRows.length > 0 && (
        <div>
          <SectionLabel>Sample duplicate rows (row numbers)</SectionLabel>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {dupRows.map(({ idx }) => (
              <span
                key={idx}
                className="border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
              >
                #{idx + 1}
              </span>
            ))}
            {issue.count > 10 && (
              <span className="text-xs text-muted-foreground self-center">
                +{issue.count - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </PanelWrapper>
  );
}

// ---------------------------------------------------------------------------
// Missing Values Panel
// ---------------------------------------------------------------------------

function MissingValuesPanel({
  issue,
  dataset,
  colType,
  addOperation,
  onClose,
}: {
  issue: DataIssue;
  dataset: import("@/types/dataset").Dataset;
  colType: "text" | "number" | "date";
  addOperation: (op: CleaningOperation) => void;
  onClose: () => void;
}) {
  const column = issue.column!;

  // Options vary by column type
  type FillOption = "leave" | "unknown" | "zero" | "mean" | "median" | "custom";
  const defaultOption: FillOption = colType === "number" ? "zero" : "unknown";
  const [fillOption, setFillOption] = useState<FillOption>(defaultOption);
  const [customValue, setCustomValue] = useState("");

  const numericValues = useMemo(() => {
    if (colType !== "number") return [];
    return dataset.rows
      .map((r) => r[column])
      .filter((v) => !isMissing(v))
      .map((v) => parseFloat(String(v).replace(/,/g, "")))
      .filter((n) => !isNaN(n));
  }, [dataset.rows, column, colType]);

  const mean = numericValues.length > 0 ? Math.round(calcMean(numericValues) * 100) / 100 : 0;
  const median = numericValues.length > 0 ? calcMedian(numericValues) : 0;

  function fillValue(): string | null {
    if (fillOption === "leave") return null;
    if (fillOption === "unknown") return "Unknown";
    if (fillOption === "zero") return "0";
    if (fillOption === "mean") return String(mean);
    if (fillOption === "median") return String(median);
    if (fillOption === "custom") return customValue;
    return null;
  }

  // Before/after preview
  const previewBefore = useMemo(() => {
    return dataset.rows
      .filter((r) => isMissing(r[column]))
      .slice(0, 8)
      .map(() => "");
  }, [dataset.rows, column]);

  const fv = fillValue();
  const previewAfter = previewBefore.map(() => fv ?? "");

  const options: { value: FillOption; label: string }[] = colType === "number"
    ? [
        { value: "leave", label: "Leave empty" },
        { value: "zero", label: "Replace with 0" },
        { value: "mean", label: `Replace with mean (${mean})` },
        { value: "median", label: `Replace with median (${median})` },
        { value: "custom", label: "Custom value" },
      ]
    : colType === "date"
    ? [
        { value: "leave", label: "Leave empty" },
        { value: "custom", label: "Custom date value" },
      ]
    : [
        { value: "leave", label: "Leave empty" },
        { value: "unknown", label: 'Replace with "Unknown"' },
        { value: "custom", label: "Custom value" },
      ];

  function handleApply() {
    const fval = fillValue();
    if (fval === null) {
      onClose();
      return;
    }
    addOperation({
      id: uniqueId(),
      type: "fill_missing",
      column,
      config: { fillValue: fval },
      description: `Fill ${issue.count} missing \`${column}\` value${issue.count !== 1 ? "s" : ""} with "${fval}"`,
      affectedCount: issue.count,
    });
    onClose();
  }

  return (
    <PanelWrapper
      title={`Fill missing values in \`${column}\``}
      description={issue.description}
      onApply={handleApply}
      onClose={onClose}
      applyLabel={fillOption === "leave" ? "Skip" : `Fill ${issue.count} value${issue.count !== 1 ? "s" : ""}`}
    >
      <div>
        <SectionLabel>Fill strategy</SectionLabel>
        <div className="mt-2 flex flex-col gap-2">
          {options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="fill-option"
                value={opt.value}
                checked={fillOption === opt.value}
                onChange={() => setFillOption(opt.value)}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {fillOption === "custom" && (
        <div>
          <SectionLabel>Custom fill value</SectionLabel>
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder={colType === "date" ? "e.g. 2024-01-01" : "Enter value…"}
            className="mt-1.5 h-8 w-full border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {fillOption !== "leave" && fv !== null && (
        <Preview before={previewBefore} after={previewAfter} />
      )}
    </PanelWrapper>
  );
}

// ---------------------------------------------------------------------------
// Inconsistent Values Panel
// ---------------------------------------------------------------------------

function InconsistentPanel({
  issue,
  dataset,
  addOperation,
  onClose,
}: {
  issue: DataIssue;
  dataset: import("@/types/dataset").Dataset;
  addOperation: (op: CleaningOperation) => void;
  onClose: () => void;
}) {
  const column = issue.column!;
  type NormOpt = "trim" | "lowercase" | "uppercase" | "titlecase";
  const [selected, setSelected] = useState<Set<NormOpt>>(new Set(["trim", "lowercase"]));

  function toggle(opt: NormOpt) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      return next;
    });
  }

  // Preview: sample up to 8 non-missing values
  const sampleValues = useMemo(() => {
    return dataset.rows
      .map((r) => r[column])
      .filter((v) => !isMissing(v))
      .map((v) => String(v))
      .slice(0, 8);
  }, [dataset.rows, column]);

  function applyNorms(val: string): string {
    let v = val;
    if (selected.has("trim")) v = v.trim();
    if (selected.has("lowercase")) v = v.toLowerCase();
    if (selected.has("uppercase")) v = v.toUpperCase();
    if (selected.has("titlecase")) {
      v = v.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
    return v;
  }

  const previewAfter = sampleValues.map(applyNorms);

  function handleApply() {
    const normalizations = Array.from(selected);
    if (normalizations.length === 0) {
      onClose();
      return;
    }
    addOperation({
      id: uniqueId(),
      type: "normalize_text",
      column,
      config: { normalizations },
      description: `Normalize \`${column}\` (${normalizations.join(", ")})`,
      affectedCount: issue.count,
    });
    onClose();
  }

  const NORM_OPTIONS: { value: NormOpt; label: string }[] = [
    { value: "trim", label: "Trim whitespace" },
    { value: "lowercase", label: "Lowercase" },
    { value: "uppercase", label: "Uppercase" },
    { value: "titlecase", label: "Title case" },
  ];

  return (
    <PanelWrapper
      title={`Normalize \`${column}\``}
      description={issue.description}
      onApply={handleApply}
      onClose={onClose}
      applyLabel="Apply normalizations"
      applyDisabled={selected.size === 0}
    >
      <div>
        <SectionLabel>Normalizations to apply</SectionLabel>
        <div className="mt-2 flex flex-col gap-2">
          {NORM_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {sampleValues.length > 0 && (
        <Preview before={sampleValues} after={previewAfter} />
      )}
    </PanelWrapper>
  );
}

// ---------------------------------------------------------------------------
// Outliers Panel
// ---------------------------------------------------------------------------

function OutliersPanel({
  issue,
  dataset,
  addOperation,
  onClose,
}: {
  issue: DataIssue;
  dataset: import("@/types/dataset").Dataset;
  addOperation: (op: CleaningOperation) => void;
  onClose: () => void;
}) {
  const column = issue.column!;

  // Detect outlier row indices (IQR method)
  const outlierRows = useMemo(() => {
    const vals: { idx: number; val: number }[] = [];
    for (let i = 0; i < dataset.rows.length; i++) {
      const raw = dataset.rows[i][column];
      if (isMissing(raw)) continue;
      const n = parseFloat(String(raw).replace(/,/g, ""));
      if (!isNaN(n)) vals.push({ idx: i, val: n });
    }
    if (vals.length < 4) return [];
    const sorted = [...vals].sort((a, b) => a.val - b.val);
    const nums = sorted.map((v) => v.val);
    const q1 = nums[Math.floor(nums.length * 0.25)];
    const q3 = nums[Math.floor(nums.length * 0.75)];
    const iqr = q3 - q1;
    if (iqr === 0) return [];
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return vals
      .filter(({ val }) => val < lower || val > upper)
      .slice(0, 20);
  }, [dataset.rows, column]);

  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(
    new Set(outlierRows.map((r) => r.idx))
  );

  function toggleRow(idx: number) {
    setCheckedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function handleApply() {
    const rowIndices = Array.from(checkedIndices);
    if (rowIndices.length === 0) {
      onClose();
      return;
    }
    addOperation({
      id: uniqueId(),
      type: "remove_outlier_rows",
      column,
      config: { rowIndices },
      description: `Remove ${rowIndices.length} outlier row${rowIndices.length !== 1 ? "s" : ""} from \`${column}\``,
      affectedCount: rowIndices.length,
    });
    onClose();
  }

  return (
    <PanelWrapper
      title={`Remove outliers in \`${column}\``}
      description={issue.description}
      onApply={handleApply}
      onClose={onClose}
      applyLabel={
        checkedIndices.size > 0
          ? `Remove ${checkedIndices.size} row${checkedIndices.size !== 1 ? "s" : ""}`
          : "Skip"
      }
    >
      <div className="text-xs border border-warning/30 bg-warning/5 px-3 py-2 text-warning">
        ⚠ Outliers may be valid data. Review carefully before removing.
      </div>

      {outlierRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No outliers could be computed.</p>
      ) : (
        <div>
          <SectionLabel>Detected outlier values — select rows to remove</SectionLabel>
          <div className="mt-2 max-h-48 overflow-y-auto border border-border bg-surface">
            {outlierRows.map(({ idx, val }) => (
              <label
                key={idx}
                className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-xs hover:bg-surface-elevated last:border-0"
              >
                <input
                  type="checkbox"
                  checked={checkedIndices.has(idx)}
                  onChange={() => toggleRow(idx)}
                  className="accent-primary"
                />
                <span className="text-muted-foreground font-mono">Row {idx + 1}</span>
                <span className="ml-auto font-mono font-medium text-foreground">{val}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </PanelWrapper>
  );
}
