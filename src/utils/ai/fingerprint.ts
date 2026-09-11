import type { Dataset } from "@/types/dataset";
import type { CleaningOperation } from "@/types/cleaning";

/**
 * Computes a lightweight, deterministic fingerprint for the current dataset
 * + operations state.
 *
 * The fingerprint changes when:
 *   - The dataset itself changes (new file uploaded)
 *   - Any cleaning operation is added, undone, or reset
 *
 * It does NOT change on re-renders, tab switches, or profile re-computation.
 *
 * Implementation: we join a small set of stable identifiers with "|".
 * We deliberately avoid hashing the full row data on every call — the
 * combination of dataset creation timestamp + row/column count + ordered
 * operation IDs is sufficient to detect every meaningful change.
 */
export function computeFingerprint(
  dataset: Dataset,
  operations: CleaningOperation[]
): string {
  const columnNames = dataset.columns.map((c) => c.name).join(",");
  const opIds = operations.map((o) => o.id).join(",");
  return [
    dataset.createdAt,
    String(dataset.rowCount),
    String(dataset.columns.length),
    columnNames,
    opIds,
  ].join("|");
}
