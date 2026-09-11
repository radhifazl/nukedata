"use client";
import { useRef, useState } from "react";
import { useDataset } from "@/context/DatasetContext";
import {
  exportDatasetAsCsv,
  cleanedFilename,
  cleanedXlsxFilename,
  originalXlsxFilename,
} from "@/utils/export/exportCsv";
import { exportDatasetAsXlsx } from "@/utils/export/exportXlsx";
import { buildCleaningSummary, downloadSummaryJson } from "@/utils/export/exportSummary";
import type { Dataset } from "@/types/dataset";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DatasetVersion = "cleaned" | "original";
type ExportFormat = "xlsx" | "csv";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scoreColour(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-danger";
}

function exportFilename(
  originalName: string,
  version: DatasetVersion,
  format: ExportFormat
): string {
  if (format === "xlsx") {
    return version === "cleaned"
      ? cleanedXlsxFilename(originalName)
      : originalXlsxFilename(originalName);
  }
  // CSV
  return version === "cleaned"
    ? cleanedFilename(originalName)
    : originalName.replace(/\.[^.]+$/, "") + ".csv";
}

function doExport(dataset: Dataset, filename: string, format: ExportFormat): void {
  if (format === "xlsx") {
    exportDatasetAsXlsx(dataset, filename);
  } else {
    exportDatasetAsCsv(dataset, filename);
  }
}

const OP_TYPE_LABEL: Record<string, string> = {
  remove_duplicates: "Removed duplicates",
  fill_missing: "Filled missing values",
  normalize_text: "Normalized text",
  convert_type: "Converted type",
  remove_outlier_rows: "Removed outlier rows",
};

// ---------------------------------------------------------------------------
// Radio option sub-component
// ---------------------------------------------------------------------------

function RadioOption({
  name,
  value,
  current,
  label,
  sublabel,
  onChange,
}: {
  name: string;
  value: string;
  current: string;
  label: string;
  sublabel?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-sm border px-4 py-3 transition-colors ${
        current === value
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-surface-elevated"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="mt-0.5 accent-primary"
      />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sublabel && <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>}
      </div>
    </label>
  );
}

// ---------------------------------------------------------------------------
// ExportTab
// ---------------------------------------------------------------------------

export function ExportTab() {
  const {
    dataset,
    profile,
    operations,
    cleanedDataset,
    cleanedProfile,
  } = useDataset();

  const [version, setVersion] = useState<DatasetVersion>("cleaned");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showFeedback(msg: string) {
    setFeedback(msg);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4000);
  }

  if (!dataset || !profile) return null;

  const hasOperations = operations.length > 0;
  const effectiveDataset = cleanedDataset ?? dataset;
  const effectiveProfile = cleanedProfile ?? profile;
  const rowDelta = effectiveDataset.rowCount - dataset.rowCount;

  const targetDataset = version === "cleaned" ? effectiveDataset : dataset;

  function handleExport() {
    if (targetDataset.rows.length === 0) {
      showFeedback("Nothing to export — the dataset is empty.");
      return;
    }
    try {
      const filename = exportFilename(dataset!.name, version, format);
      doExport(targetDataset, filename, format);
      showFeedback(
        `Downloading ${filename} — ${targetDataset.rowCount.toLocaleString()} rows`
      );
    } catch {
      showFeedback("Export failed. Please try again.");
    }
  }

  function handleExportSummary() {
    if (!dataset || !profile) return;
    try {
      const summary = buildCleaningSummary(
        dataset,
        profile,
        operations,
        cleanedDataset,
        cleanedProfile
      );
      downloadSummaryJson(summary, dataset.name);
      showFeedback("Cleaning summary downloaded.");
    } catch {
      showFeedback("Export failed. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Export</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Download your dataset or cleaning summary.
          </p>
        </div>
        {feedback && (
          <p className="text-xs text-muted-foreground self-center">{feedback}</p>
        )}
      </div>

      {/* ── Export options ───────────────────────────────────────────── */}
      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Export dataset
          </p>
        </div>

        <div className="grid gap-6 px-5 py-5 sm:grid-cols-2">
          {/* Dataset version */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Dataset</p>
            <div className="flex flex-col gap-2">
              <RadioOption
                name="version"
                value="cleaned"
                current={version}
                label={hasOperations ? "Cleaned dataset" : "Current dataset"}
                sublabel={
                  hasOperations
                    ? `${effectiveDataset.rowCount.toLocaleString()} rows · ${operations.length} operation${operations.length !== 1 ? "s" : ""} applied`
                    : `${effectiveDataset.rowCount.toLocaleString()} rows · no cleaning applied`
                }
                onChange={(v) => setVersion(v as DatasetVersion)}
              />
              {hasOperations && (
                <RadioOption
                  name="version"
                  value="original"
                  current={version}
                  label="Original dataset"
                  sublabel={`${dataset.rowCount.toLocaleString()} rows · untouched`}
                  onChange={(v) => setVersion(v as DatasetVersion)}
                />
              )}
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Format</p>
            <div className="flex flex-col gap-2">
              <RadioOption
                name="format"
                value="xlsx"
                current={format}
                label="Excel (.xlsx)"
                sublabel="Recommended — opens as a proper table in Excel"
                onChange={(v) => setFormat(v as ExportFormat)}
              />
              <RadioOption
                name="format"
                value="csv"
                current={format}
                label="CSV (.csv)"
                sublabel="UTF-8 with BOM — compatible with Excel, Python, R"
                onChange={(v) => setFormat(v as ExportFormat)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {exportFilename(dataset.name, version, format)}
            </span>
            {" · "}
            {targetDataset.rowCount.toLocaleString()} row{targetDataset.rowCount !== 1 ? "s" : ""}
            {" · "}
            {dataset.columns.length} column{dataset.columns.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={handleExport}
            className="button-primary shrink-0 text-sm"
          >
            ↓ Export
          </button>
        </div>
      </div>

      {/* ── Dataset summary card ─────────────────────────────────────── */}
      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dataset summary
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
          {/* Filename */}
          <div className="px-5 py-4">
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">File</p>
            <p className="mt-1 truncate text-sm font-medium text-foreground" title={dataset.name}>
              {dataset.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatSize(dataset.fileSize)}</p>
          </div>

          {/* Rows */}
          <div className="px-5 py-4">
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Rows</p>
            {hasOperations ? (
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-sm text-muted-foreground line-through">
                  {dataset.rowCount.toLocaleString()}
                </span>
                <span className="text-[0.65rem] text-muted-foreground" aria-hidden>→</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {effectiveDataset.rowCount.toLocaleString()}
                </span>
              </div>
            ) : (
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {dataset.rowCount.toLocaleString()}
              </p>
            )}
            {rowDelta < 0 && (
              <p className="text-xs text-success">
                {Math.abs(rowDelta).toLocaleString()} removed
              </p>
            )}
          </div>

          {/* Columns */}
          <div className="px-5 py-4">
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Columns</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">
              {dataset.columns.length}
            </p>
          </div>

          {/* Quality score */}
          <div className="px-5 py-4">
            <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Quality score</p>
            {hasOperations && cleanedProfile ? (
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-sm text-muted-foreground line-through">
                  {profile.qualityScore}
                </span>
                <span className="text-[0.65rem] text-muted-foreground" aria-hidden>→</span>
                <span className={`font-mono text-sm font-semibold ${scoreColour(cleanedProfile.qualityScore)}`}>
                  {cleanedProfile.qualityScore}
                </span>
              </div>
            ) : (
              <p className={`mt-1 font-mono text-sm font-semibold ${scoreColour(profile.qualityScore)}`}>
                {profile.qualityScore}
              </p>
            )}
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
        </div>
      </div>

      {/* ── Cleaning operations log ──────────────────────────────────── */}
      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cleaning operations
            {hasOperations && (
              <span className="ml-2 font-mono normal-case text-xs text-foreground">
                {operations.length}
              </span>
            )}
          </p>
        </div>

        {!hasOperations ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">No cleaning operations applied.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Apply fixes in the Clean tab — they will appear here.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {operations.map((op, i) => (
              <li key={op.id} className="flex items-start gap-4 px-5 py-3">
                <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{op.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {OP_TYPE_LABEL[op.type] ?? op.type}
                    {op.column && (
                      <>
                        {" "}
                        <span aria-hidden>·</span>{" "}
                        <code className="font-mono">{op.column}</code>
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  ×{op.affectedCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Cleaning summary JSON ────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-surface px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">Cleaning Summary</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            JSON — operations log, row counts, quality delta
          </p>
        </div>
        <button
          onClick={handleExportSummary}
          className="button-secondary shrink-0 text-xs min-h-0 px-3 py-2"
        >
          ↓ JSON
        </button>
      </div>

    </div>
  );
}
