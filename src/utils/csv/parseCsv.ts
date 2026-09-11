import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Dataset } from "@/types/dataset";

export type ParseCsvResult =
  | { ok: true; dataset: Dataset }
  | { ok: false; error: string };

export function parseCsv(file: File): Promise<ParseCsvResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "xls" || ext === "xlsx") {
    return parseWorkbook(file);
  }

  return new Promise((resolve) => {
    if (ext !== "csv" && file.type !== "text/csv") {
      resolve({ ok: false, error: "Only CSV, XLS, and XLSX files are supported." });
      return;
    }

    if (file.size === 0) {
      resolve({ ok: false, error: "This file is empty." });
      return;
    }

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete(result) {
        if (result.errors.length > 0) {
          const critical = result.errors.find(
            (e) => e.type === "Delimiter" || e.type === "Quotes"
          );
          if (critical) {
            resolve({
              ok: false,
              error:
                "We couldn't read this CSV. Check that the file is a valid CSV and try again.",
            });
            return;
          }
        }

        const rawFields = result.meta.fields ?? [];

        if (rawFields.length === 0) {
          resolve({
            ok: false,
            error:
              "We couldn't read this CSV. Check that the file is a valid CSV and try again.",
          });
          return;
        }

        const rows = result.data;

        if (rows.length === 0) {
          resolve({
            ok: false,
            error: "This dataset contains columns but no rows.",
          });
          return;
        }

        const dataset: Dataset = {
          name: file.name,
          fileSize: file.size,
          columns: rawFields.map((name) => ({ name })),
          rows,
          rowCount: rows.length,
          createdAt: new Date().toISOString(),
        };

        resolve({ ok: true, dataset });
      },
      error(err) {
        resolve({
          ok: false,
          error: "We couldn't read this CSV. Check that the file is a valid CSV and try again.",
        });
        console.error("PapaParse error:", err);
      },
    });
  });
}

async function parseWorkbook(file: File): Promise<ParseCsvResult> {
  if (file.size === 0) {
    return { ok: false, error: "This spreadsheet file is empty." };
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { ok: false, error: "This spreadsheet does not contain any worksheets." };
    }

    const values = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
    });

    const [headerRow, ...dataRows] = values;
    const columns = (headerRow as unknown[] ?? []).map((v) => String(v).trim());

    if (columns.length === 0 || columns.every((c) => !c)) {
      return { ok: false, error: "This spreadsheet needs a header row to be imported." };
    }

    if (dataRows.length === 0) {
      return { ok: false, error: "This dataset contains columns but no rows." };
    }

    const rows = dataRows.map((row) =>
      Object.fromEntries(
        columns.map((col, i) => [col, (row as unknown[])[i] ?? ""])
      )
    );

    return {
      ok: true,
      dataset: {
        name: file.name,
        fileSize: file.size,
        columns: columns.map((name) => ({ name })),
        rows,
        rowCount: rows.length,
        createdAt: new Date().toISOString(),
      },
    };
  } catch {
    return {
      ok: false,
      error: "We couldn't read this spreadsheet. Check that the file is valid and try again.",
    };
  }
}
