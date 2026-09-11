import type { Dataset } from "@/types/dataset";
import type { CleaningOperation } from "@/types/cleaning";
import { isMissing } from "@/utils/csv/profileDataset";

/**
 * Pure function — applies `operations` in order to `original` and returns
 * a new Dataset. The original is never mutated.
 */
export function cleanDataset(
  original: Dataset,
  operations: CleaningOperation[]
): Dataset {
  if (operations.length === 0) return original;

  // Deep-clone the rows so we never touch the original
  let rows: Record<string, unknown>[] = original.rows.map((r) => ({ ...r }));

  for (const op of operations) {
    switch (op.type) {
      case "remove_duplicates":
        rows = applyRemoveDuplicates(rows, original.columns.map((c) => c.name), op);
        break;
      case "fill_missing":
        rows = applyFillMissing(rows, op);
        break;
      case "normalize_text":
        rows = applyNormalizeText(rows, op);
        break;
      case "convert_type":
        rows = applyConvertType(rows, op);
        break;
      case "remove_outlier_rows":
        rows = applyRemoveOutlierRows(rows, op);
        break;
    }
  }

  return {
    ...original,
    rows,
    rowCount: rows.length,
  };
}

// ---------------------------------------------------------------------------
// remove_duplicates
// config: { keep: "first" | "last" }
// ---------------------------------------------------------------------------

function applyRemoveDuplicates(
  rows: Record<string, unknown>[],
  columnNames: string[],
  op: CleaningOperation
): Record<string, unknown>[] {
  const keep = (op.config.keep as "first" | "last") ?? "first";

  if (keep === "first") {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = columnNames.map((c) => String(row[c] ?? "")).join("\x00");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else {
    // keep last — iterate in reverse, then re-reverse
    const seen = new Set<string>();
    const result: Record<string, unknown>[] = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const key = columnNames.map((c) => String(rows[i][c] ?? "")).join("\x00");
      if (!seen.has(key)) {
        seen.add(key);
        result.unshift(rows[i]);
      }
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// fill_missing
// config: { column: string; fillValue: string | number | null }
//   fillValue null means "leave empty" (no-op)
// ---------------------------------------------------------------------------

function applyFillMissing(
  rows: Record<string, unknown>[],
  op: CleaningOperation
): Record<string, unknown>[] {
  const column = op.column;
  if (!column) return rows;
  const fillValue = op.config.fillValue;
  if (fillValue === null || fillValue === undefined) return rows;
  const fill = String(fillValue);

  return rows.map((row) => {
    if (!isMissing(row[column])) return row;
    return { ...row, [column]: fill };
  });
}

// ---------------------------------------------------------------------------
// normalize_text
// config: { column: string; normalizations: Array<"trim"|"lowercase"|"uppercase"|"titlecase"> }
// ---------------------------------------------------------------------------

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );
}

function applyNormalizeText(
  rows: Record<string, unknown>[],
  op: CleaningOperation
): Record<string, unknown>[] {
  const column = op.column;
  if (!column) return rows;
  const normalizations = (op.config.normalizations as string[]) ?? [];
  if (normalizations.length === 0) return rows;

  return rows.map((row) => {
    if (isMissing(row[column])) return row;
    let val = String(row[column]);
    for (const norm of normalizations) {
      if (norm === "trim") val = val.trim();
      else if (norm === "lowercase") val = val.toLowerCase();
      else if (norm === "uppercase") val = val.toUpperCase();
      else if (norm === "titlecase") val = titleCase(val);
    }
    return { ...row, [column]: val };
  });
}

// ---------------------------------------------------------------------------
// convert_type
// config: { column: string; targetType: "number" | "date" | "boolean" }
//   Leaves unconvertible values as-is.
// ---------------------------------------------------------------------------

function applyConvertType(
  rows: Record<string, unknown>[],
  op: CleaningOperation
): Record<string, unknown>[] {
  const column = op.column;
  if (!column) return rows;
  const targetType = op.config.targetType as "number" | "date" | "boolean";

  return rows.map((row) => {
    if (isMissing(row[column])) return row;
    const raw = String(row[column]);
    if (targetType === "number") {
      const n = parseFloat(raw.replace(/,/g, ""));
      if (!isNaN(n)) return { ...row, [column]: n };
    } else if (targetType === "date") {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return { ...row, [column]: d.toISOString().slice(0, 10) };
    } else if (targetType === "boolean") {
      const lower = raw.trim().toLowerCase();
      if (["true", "yes", "1"].includes(lower)) return { ...row, [column]: "true" };
      if (["false", "no", "0"].includes(lower)) return { ...row, [column]: "false" };
    }
    return row; // leave unconvertible as-is
  });
}

// ---------------------------------------------------------------------------
// remove_outlier_rows
// config: { rowIndices: number[] }  — indices into the current row array
// ---------------------------------------------------------------------------

function applyRemoveOutlierRows(
  rows: Record<string, unknown>[],
  op: CleaningOperation
): Record<string, unknown>[] {
  const indices = new Set<number>((op.config.rowIndices as number[]) ?? []);
  if (indices.size === 0) return rows;
  return rows.filter((_, i) => !indices.has(i));
}
