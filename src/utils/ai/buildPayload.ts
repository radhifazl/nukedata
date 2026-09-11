import type { DatasetProfile } from "@/types/profile";
import type {
  AiAnalysisPayload,
  AiColumnPayload,
  AiIssuePayload,
} from "@/types/ai";

/**
 * Builds the minimal AI analysis payload from the existing DatasetProfile.
 *
 * Privacy notes:
 * - No raw dataset rows are included.
 * - Only statistical summaries and issue metadata are sent.
 * - Sample values (e.g. inconsistent group examples) are intentionally excluded
 *   to minimise exposure of potentially sensitive data.
 */
export function buildAiPayload(profile: DatasetProfile): AiAnalysisPayload {
  const columns: AiColumnPayload[] = profile.columns.map((col) => {
    const base: AiColumnPayload = {
      name: col.name,
      type: col.inferredType,
      missing: col.missingCount,
      unique: col.uniqueCount,
      uniqueRatio: Math.round(col.uniqueRatio * 1000) / 1000,
    };

    if (col.numericStats) {
      base.min = col.numericStats.min;
      base.max = col.numericStats.max;
      base.mean = Math.round(col.numericStats.mean * 100) / 100;
      base.median = col.numericStats.median;
    }

    if (col.dateStats) {
      base.earliest = col.dateStats.earliest;
      base.latest = col.dateStats.latest;
    }

    if (col.inconsistentGroups.length > 0) {
      base.inconsistentGroupCount = col.inconsistentGroups.length;
    }

    return base;
  });

  const issues: AiIssuePayload[] = profile.issues.map((issue) => ({
    id: issue.id,
    type: issue.type,
    severity: issue.severity,
    column: issue.column,
    count: issue.count,
    description: issue.description,
  }));

  return {
    rowCount: profile.rowCount,
    columnCount: profile.columnCount,
    qualityScore: profile.qualityScore,
    duplicateRowCount: profile.duplicateRowCount,
    incompleteRowCount: profile.incompleteRowCount,
    columns,
    issues,
  };
}
