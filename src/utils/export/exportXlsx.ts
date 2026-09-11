import * as XLSX from "xlsx";
import type { Dataset } from "@/types/dataset";
import { triggerDownload } from "./exportCsv";

/**
 * Serializes a Dataset to a real Excel workbook (.xlsx) and triggers a
 * browser download.
 *
 * Uses the `xlsx` library that is already a project dependency (used by
 * the input parser for .xls/.xlsx files).
 *
 * Column order is preserved. Values are written as their native JS type so
 * that Excel recognizes numbers and booleans without extra formatting.
 * Empty / null / undefined cells are written as empty strings so Excel
 * renders a blank cell rather than 0.
 *
 * @param dataset  The dataset to export (original or cleaned).
 * @param filename The suggested filename including the .xlsx extension.
 */
export function exportDatasetAsXlsx(dataset: Dataset, filename: string): void {
  if (dataset.rows.length === 0 && dataset.columns.length === 0) {
    return; // safety-net; callers should guard
  }

  const columnNames = dataset.columns.map((c) => c.name);

  // Build the sheet data as an array of arrays.
  // Row 0 = headers; subsequent rows = data.
  // XLSX.utils.aoa_to_sheet is the simplest path and avoids key-ordering
  // surprises that come with object-based approaches.
  const sheetData: unknown[][] = [
    columnNames,
    ...dataset.rows.map((row) =>
      columnNames.map((col) => {
        const val = row[col];
        // Preserve empty / null / undefined as empty string so Excel
        // renders a blank cell, not 0 or "null".
        if (val === null || val === undefined || val === "") return "";
        return val;
      })
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Optional: set column widths to a comfortable default so the spreadsheet
  // is immediately readable when opened. Cap at 40 characters.
  worksheet["!cols"] = columnNames.map((name) => ({
    wch: Math.min(40, Math.max(10, name.length + 2)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

  // Write to binary array buffer and download as a Blob.
  const buffer: ArrayBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  triggerDownload(blob, filename);
}
