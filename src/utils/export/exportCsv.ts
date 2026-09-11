import type { Dataset } from "@/types/dataset";

// ---------------------------------------------------------------------------
// CSV serialization
// ---------------------------------------------------------------------------

/**
 * Serializes a Dataset to RFC 4180–compliant CSV text.
 *
 * Includes a UTF-8 BOM and a `sep=,` directive so Excel opens the file
 * correctly regardless of the user's locale list-separator setting.
 *
 * - Commas, double-quotes, newlines, and carriage returns in values are
 *   handled by RFC 4180 quoting.
 * - Null / undefined cells are serialized as empty strings.
 * - CRLF line endings are used throughout (required by RFC 4180 and
 *   expected by most spreadsheet applications).
 */
export function serializeDatasetToCsv(dataset: Dataset): string {
  const columns = dataset.columns.map((c) => c.name);
  const lines: string[] = [];

  // `sep=,` on its own line tells Excel which delimiter this file uses.
  // Standard CSV parsers (PapaParse, Python csv, etc.) treat this as a
  // comment / skip it gracefully because it is not a data row.
  lines.push("sep=,");

  // Header row
  lines.push(columns.map(quoteCell).join(","));

  // Data rows
  for (const row of dataset.rows) {
    lines.push(columns.map((col) => quoteCell(row[col])).join(","));
  }

  // UTF-8 BOM + CRLF-separated lines.
  // The BOM (\uFEFF) tells Excel this is UTF-8, preserving Unicode / Indonesian
  // characters instead of falling back to the system ANSI code page.
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * RFC 4180–compliant CSV cell quoting.
 * Always returns a plain string ready to embed in a CSV line.
 */
function quoteCell(value: unknown): string {
  const str =
    value === null || value === undefined ? "" : String(value);

  // Must quote if the cell contains a comma, double-quote, LF, or CR
  if (
    str.includes('"') ||
    str.includes(",") ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

/**
 * Triggers a browser download of a CSV string as a .csv file.
 * The Blob type is set to text/csv;charset=utf-8 which also helps some
 * operating systems and browsers identify the encoding correctly.
 */
export function downloadCsv(csvText: string, filename: string): void {
  // Use Uint8Array to preserve the BOM byte exactly — some environments
  // strip the BOM when constructing a Blob from a raw JS string.
  const encoded = new TextEncoder().encode(csvText);
  const blob = new Blob([encoded], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

/**
 * Triggers a browser download for any Blob.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

/**
 * Returns the base name (no extension) of a dataset filename.
 *   "customers.csv"  → "customers"
 *   "data.xlsx"      → "data"
 *   "report"         → "report"
 */
function baseName(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  return dot > 0 ? originalName.slice(0, dot) : originalName;
}

/**
 * Derives the export CSV filename for the cleaned dataset.
 *   "customers.csv"  → "customers_cleaned.csv"
 *   "data.xlsx"      → "data_cleaned.csv"
 */
export function cleanedFilename(originalName: string): string {
  return `${baseName(originalName)}_cleaned.csv`;
}

/**
 * Derives the export XLSX filename for the cleaned dataset.
 *   "customers.csv"  → "customers_cleaned.xlsx"
 *   "data.xlsx"      → "data_cleaned.xlsx"
 */
export function cleanedXlsxFilename(originalName: string): string {
  return `${baseName(originalName)}_cleaned.xlsx`;
}

/**
 * Derives the export XLSX filename for the original dataset.
 *   "customers.csv"  → "customers.xlsx"
 *   "data.xlsx"      → "data.xlsx"
 */
export function originalXlsxFilename(originalName: string): string {
  return `${baseName(originalName)}.xlsx`;
}

// ---------------------------------------------------------------------------
// Convenience: serialize + download
// ---------------------------------------------------------------------------

/**
 * Serializes a Dataset as CSV and immediately triggers a browser download.
 */
export function exportDatasetAsCsv(dataset: Dataset, filename?: string): void {
  if (dataset.rows.length === 0 && dataset.columns.length === 0) {
    return; // safety-net; callers should guard
  }
  const csv = serializeDatasetToCsv(dataset);
  downloadCsv(csv, filename ?? cleanedFilename(dataset.name));
}
