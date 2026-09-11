import type { Dataset } from "@/types/dataset";
import type { DatasetProfile } from "@/types/profile";
import type { CleaningOperation } from "@/types/cleaning";
import type { CleaningSummary } from "@/types/export";

/**
 * Builds a CleaningSummary from the current application state.
 * Uses the cleaned dataset row count when operations have been applied,
 * otherwise falls back to the original.
 */
export function buildCleaningSummary(
  dataset: Dataset,
  originalProfile: DatasetProfile,
  operations: CleaningOperation[],
  cleanedDataset: Dataset | null,
  cleanedProfile: DatasetProfile | null
): CleaningSummary {
  const rowsAfter =
    cleanedDataset !== null ? cleanedDataset.rowCount : dataset.rowCount;
  const qualityAfter =
    cleanedProfile !== null
      ? cleanedProfile.qualityScore
      : originalProfile.qualityScore;

  return {
    exportedAt: new Date().toISOString(),
    dataset: {
      name: dataset.name,
      rowsBefore: dataset.rowCount,
      rowsAfter,
      columns: dataset.columns.length,
    },
    quality: {
      before: originalProfile.qualityScore,
      after: qualityAfter,
    },
    operations: operations.map((op) => {
      const entry: CleaningSummary["operations"][number] = {
        type: op.type,
        description: op.description,
        affectedCount: op.affectedCount,
      };
      if (op.column) entry.column = op.column;
      return entry;
    }),
  };
}

/**
 * Serializes the summary to formatted JSON and triggers a browser download.
 */
export function downloadSummaryJson(
  summary: CleaningSummary,
  datasetName: string
): void {
  const json = JSON.stringify(summary, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const dot = datasetName.lastIndexOf(".");
  const base = dot > 0 ? datasetName.slice(0, dot) : datasetName;
  const filename = `${base}_cleaning_summary.json`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
