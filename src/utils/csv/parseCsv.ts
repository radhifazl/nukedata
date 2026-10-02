import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Dataset } from "@/types/dataset";

export type ParseCsvResult =
  | { ok: true; dataset: Dataset }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Schema normalization helpers
// ---------------------------------------------------------------------------

/**
 * Builds the authoritative column list from raw header fields.
 *
 * Rules:
 *   1. Trim each field name.
 *   2. Remove trailing blank column names (phantom columns from trailing delimiters).
 *   3. Keep genuinely empty columns that appear in the interior of the header
 *      (e.g. "Name,,Phone" keeps the middle column, renamed to a placeholder).
 */
export function normalizeColumns(rawFields: string[]): string[] {
  // Trim all field names
  const trimmed = rawFields.map((f) => f.trim());

  // Strip trailing empty/blank fields — these come from "A,B,C,D," trailing delimiters
  let end = trimmed.length;
  while (end > 0 && trimmed[end - 1] === "") {
    end--;
  }
  const withoutTrailing = trimmed.slice(0, end);

  // Rename interior blank header fields so they are identifiable
  return withoutTrailing.map((name, i) =>
    name === "" ? `(Unnamed Column ${i + 1})` : name
  );
}

/**
 * Clamps a parsed row to the canonical column schema.
 *
 * - Extra fields (row wider than schema) are discarded.
 * - Missing fields (row narrower than schema) are filled with "".
 *
 * This ensures no phantom column is created from a trailing delimiter
 * that happens to appear only on data rows and not on the header.
 */
function normalizeRow(
  row: Record<string, unknown>,
  columns: string[],
  rawFields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const col of columns) {
    // rawFields may differ from columns (interior blank renames), look up by original field name
    const rawIdx = rawFields.findIndex((f, i) => {
      const trimmed = f.trim();
      const canonical = trimmed === "" ? `(Unnamed Column ${i + 1})` : trimmed;
      return canonical === col;
    });
    result[col] = rawIdx !== -1 ? (row[rawFields[rawIdx]] ?? "") : "";
  }
  return result;
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

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

        // ── Normalize columns (strip trailing phantom fields) ──
        const columns = normalizeColumns(rawFields);

        if (columns.length === 0) {
          resolve({
            ok: false,
            error:
              "We couldn't read this CSV. Check that the file is a valid CSV and try again.",
          });
          return;
        }

        // ── Normalize rows (clamp to schema, fill short rows) ──
        const rows = result.data.map((row) =>
          normalizeRow(row, columns, rawFields)
        );

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
          columns: columns.map((name) => ({ name })),
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

// ---------------------------------------------------------------------------
// XLSX / XLS parser
// ---------------------------------------------------------------------------

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
    const rawHeaderValues = (headerRow as unknown[] ?? []).map((v) => String(v));

    // ── Normalize columns (strip trailing blank headers) ──
    const columns = normalizeColumns(rawHeaderValues);

    if (columns.length === 0 || columns.every((c) => !c)) {
      return { ok: false, error: "This spreadsheet needs a header row to be imported." };
    }

    if (dataRows.length === 0) {
      return { ok: false, error: "This dataset contains columns but no rows." };
    }

    // ── Build rows clamped to the canonical column schema ──
    // rawHeaderValues is used to locate the original column position.
    const schemaIndices = columns.map((col) =>
      rawHeaderValues.findIndex((h, i) => {
        const trimmed = h.trim();
        const canonical = trimmed === "" ? `(Unnamed Column ${i + 1})` : trimmed;
        return canonical === col;
      })
    );

    const rows = dataRows.map((row) =>
      Object.fromEntries(
        columns.map((col, ci) => {
          const srcIdx = schemaIndices[ci];
          const val = srcIdx !== -1 ? (row as unknown[])[srcIdx] ?? "" : "";
          return [col, val];
        })
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
