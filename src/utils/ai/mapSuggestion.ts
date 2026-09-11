import type { CleaningOperation, CleaningOperationType } from "@/types/cleaning";
import type { AiSuggestion } from "@/types/ai";
import type { DatasetProfile } from "@/types/profile";

// Supported operation types in the cleaning engine
const SUPPORTED_OPERATION_TYPES = new Set<CleaningOperationType>([
  "remove_duplicates",
  "fill_missing",
  "normalize_text",
  "convert_type",
  "remove_outlier_rows",
]);

/**
 * Attempts to map an AI suggestion to a concrete CleaningOperation.
 *
 * Returns null if:
 * - The suggestion has no operationType
 * - The operationType is not supported by the existing cleaning engine
 * - The required column is missing for column-scoped operations
 */
export function mapSuggestionToOperation(
  suggestion: AiSuggestion,
  profile: DatasetProfile
): CleaningOperation | null {
  const { operationType, column, strategy } = suggestion;

  if (!operationType) return null;
  if (!SUPPORTED_OPERATION_TYPES.has(operationType)) return null;

  const id = `ai_${suggestion.id}_${Date.now()}`;

  switch (operationType) {
    case "remove_duplicates": {
      const keep = strategy === "last" ? "last" : "first";
      return {
        id,
        type: "remove_duplicates",
        config: { keep },
        description: `Remove duplicate rows (keep ${keep} occurrence)`,
        affectedCount: profile.duplicateRowCount,
      };
    }

    case "fill_missing": {
      if (!column) return null;
      const colProfile = profile.columns.find((c) => c.name === column);
      if (!colProfile) return null;

      // Determine fill value from strategy hint
      let fillValue: string | number = "Unknown";
      let fillLabel = '"Unknown"';

      if (strategy === "zero" || strategy === "0") {
        fillValue = "0";
        fillLabel = "0";
      } else if (strategy === "mean" && colProfile.numericStats) {
        fillValue = String(Math.round(colProfile.numericStats.mean * 100) / 100);
        fillLabel = `mean (${fillValue})`;
      } else if (strategy === "median" && colProfile.numericStats) {
        fillValue = String(colProfile.numericStats.median);
        fillLabel = `median (${fillValue})`;
      } else if (strategy && !["unknown", "empty", "leave"].includes(strategy.toLowerCase())) {
        // Treat strategy as a literal custom value
        fillValue = strategy;
        fillLabel = `"${strategy}"`;
      }

      return {
        id,
        type: "fill_missing",
        column,
        config: { fillValue },
        description: `Fill ${colProfile.missingCount} missing value${colProfile.missingCount !== 1 ? "s" : ""} in \`${column}\` with ${fillLabel}`,
        affectedCount: colProfile.missingCount,
      };
    }

    case "normalize_text": {
      if (!column) return null;
      const colProfile = profile.columns.find((c) => c.name === column);
      if (!colProfile) return null;

      // Parse normalizations from strategy hint
      const normalizations: string[] = [];
      const strat = (strategy ?? "trim_lowercase").toLowerCase();

      if (strat.includes("trim")) normalizations.push("trim");
      if (strat.includes("lower")) normalizations.push("lowercase");
      else if (strat.includes("upper")) normalizations.push("uppercase");
      else if (strat.includes("title")) normalizations.push("titlecase");

      // Default to trim + lowercase if nothing was parsed
      if (normalizations.length === 0) {
        normalizations.push("trim", "lowercase");
      }

      const label = normalizations.join(" + ");
      const affected = colProfile.inconsistentGroups.reduce(
        (s, g) => s + g.rawValues.length,
        0
      );

      return {
        id,
        type: "normalize_text",
        column,
        config: { normalizations },
        description: `Normalize \`${column}\` (${label})`,
        affectedCount: affected,
      };
    }

    case "convert_type": {
      if (!column) return null;
      const colProfile = profile.columns.find((c) => c.name === column);
      if (!colProfile) return null;

      const targetType = (strategy as "number" | "date" | "boolean") ?? "number";
      const validTargets = ["number", "date", "boolean"];
      if (!validTargets.includes(targetType)) return null;

      return {
        id,
        type: "convert_type",
        column,
        config: { targetType },
        description: `Convert \`${column}\` to ${targetType}`,
        affectedCount: colProfile.totalValues,
      };
    }

    // remove_outlier_rows requires specific row indices which the AI doesn't know —
    // we cannot map this from a suggestion without re-running IQR detection.
    case "remove_outlier_rows":
      return null;
  }
}
