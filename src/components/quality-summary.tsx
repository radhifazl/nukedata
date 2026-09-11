import type { DatasetProfile } from "@/types/profile";

interface QualitySummaryProps {
  profile: DatasetProfile;
}

/** Colour class for the quality score ring / label. */
function scoreColour(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

export function QualitySummary({ profile }: QualitySummaryProps) {
  const completeRows = profile.rowCount - profile.incompleteRowCount;
  const totalMissing = profile.columns.reduce(
    (sum, c) => sum + c.missingCount,
    0
  );
  const totalOutliers = profile.issues
    .filter((i) => i.type === "potential_outliers")
    .reduce((sum, i) => sum + i.count, 0);
  const inconsistentCols = profile.issues.filter(
    (i) => i.type === "inconsistent_values"
  ).length;

  return (
    <div className="border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-sm font-medium">Data Quality</p>
        <span
          className={`font-mono text-lg font-semibold tabular-nums ${scoreColour(profile.qualityScore)}`}
        >
          {profile.qualityScore}
          <span className="text-xs font-normal text-muted-foreground"> / 100</span>
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <SummaryStat
          label="Complete rows"
          value={completeRows.toLocaleString()}
          sub={`of ${profile.rowCount.toLocaleString()}`}
          variant={completeRows === profile.rowCount ? "good" : "neutral"}
        />
        <SummaryStat
          label="Missing values"
          value={totalMissing.toLocaleString()}
          sub={totalMissing === 0 ? "none detected" : "across all columns"}
          variant={totalMissing === 0 ? "good" : "warn"}
        />
        <SummaryStat
          label="Duplicate rows"
          value={profile.duplicateRowCount.toLocaleString()}
          sub={profile.duplicateRowCount === 0 ? "none detected" : "exact duplicates"}
          variant={profile.duplicateRowCount === 0 ? "good" : "warn"}
        />
        <SummaryStat
          label="Issues"
          value={profile.issues.length.toLocaleString()}
          sub={
            totalOutliers > 0
              ? `incl. ${totalOutliers} outlier${totalOutliers !== 1 ? "s" : ""}`
              : inconsistentCols > 0
              ? `incl. ${inconsistentCols} inconsistent col${inconsistentCols !== 1 ? "s" : ""}`
              : profile.issues.length === 0
              ? "none detected"
              : "detected"
          }
          variant={profile.issues.length === 0 ? "good" : "warn"}
        />
      </div>
    </div>
  );
}

type StatVariant = "good" | "warn" | "neutral";

function SummaryStat({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub: string;
  variant: StatVariant;
}) {
  const valueColour =
    variant === "good"
      ? "text-success"
      : variant === "warn"
      ? "text-warning"
      : "text-foreground";

  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueColour}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
