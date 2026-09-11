import type { DatasetProfile, DataIssueType } from "@/types/profile";

const ISSUE_ICONS: Record<DataIssueType, string> = {
  missing_values: "○",
  duplicate_rows: "⊡",
  inconsistent_values: "≈",
  potential_outliers: "◇",
};

const ISSUE_TYPE_LABELS: Record<DataIssueType, string> = {
  missing_values: "Missing values",
  duplicate_rows: "Duplicate rows",
  inconsistent_values: "Inconsistent values",
  potential_outliers: "Potential outliers",
};

interface OverviewTabProps {
  profile: DatasetProfile;
  totalMissing: number;
  onFocusIssue: (type: DataIssueType, column?: string) => void;
  onFocusColumn: (name: string) => void;
  onOpenClean: (issueId: string) => void;
}

function scoreLabel(score: number): { text: string; colour: string } {
  if (score >= 90) return { text: "Good quality", colour: "text-success" };
  if (score >= 70) return { text: "Acceptable quality", colour: "text-warning" };
  return { text: "Needs attention", colour: "text-danger" };
}

// Group issues by type so we can show one row per issue type in the summary
function groupIssues(profile: DatasetProfile) {
  const map = new Map<
    DataIssueType,
    { totalCount: number; columns: string[] }
  >();
  for (const issue of profile.issues) {
    const existing = map.get(issue.type);
    if (existing) {
      existing.totalCount += issue.count;
      if (issue.column) existing.columns.push(issue.column);
    } else {
      map.set(issue.type, {
        totalCount: issue.count,
        columns: issue.column ? [issue.column] : [],
      });
    }
  }
  return map;
}

export function OverviewTab({
  profile,
  totalMissing,
  onFocusIssue,
  onFocusColumn,
  onOpenClean,
}: OverviewTabProps) {
  const { text: qualityText, colour: qualityColour } = scoreLabel(
    profile.qualityScore
  );
  const grouped = groupIssues(profile);
  const completeRows = profile.rowCount - profile.incompleteRowCount;

  // Top columns to highlight — those with any issues
  const problematicColumns = profile.columns
    .filter(
      (c) =>
        c.missingCount > 0 ||
        c.inconsistentGroups.length > 0
    )
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {/* ── Quality score + metrics ───────────────────────────────── */}
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {/* Quality score */}
        <div className="bg-surface px-5 py-4 sm:col-span-2 lg:col-span-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Data Quality
          </p>
          <p className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${qualityColour}`}>
            {profile.qualityScore}
            <span className="text-base font-normal text-muted-foreground"> / 100</span>
          </p>
          <p className={`mt-0.5 text-xs font-medium ${qualityColour}`}>
            {qualityText}
          </p>
        </div>

        <MetricCell
          label="Complete rows"
          value={completeRows.toLocaleString()}
          sub={`of ${profile.rowCount.toLocaleString()} total`}
          variant={completeRows === profile.rowCount ? "good" : "warn"}
        />
        <MetricCell
          label="Missing values"
          value={totalMissing.toLocaleString()}
          sub={totalMissing === 0 ? "none" : `across ${profile.columns.filter(c => c.missingCount > 0).length} column${profile.columns.filter(c => c.missingCount > 0).length !== 1 ? "s" : ""}`}
          variant={totalMissing === 0 ? "good" : "warn"}
        />
        <MetricCell
          label="Duplicate rows"
          value={profile.duplicateRowCount.toLocaleString()}
          sub={profile.duplicateRowCount === 0 ? "none detected" : "exact duplicates"}
          variant={profile.duplicateRowCount === 0 ? "good" : "warn"}
        />
      </div>

      {/* ── Issues summary ────────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
          {grouped.size === 0
            ? "No issues detected"
            : `${profile.issues.length} issue${profile.issues.length !== 1 ? "s" : ""} detected`}
        </h3>

        {grouped.size === 0 ? (
          <div className="border border-border bg-surface px-5 py-6 text-center text-sm text-success">
            This dataset looks clean.
          </div>
        ) : (
          <div className="divide-y divide-border border border-border bg-surface">
            {(
              [
                "missing_values",
                "duplicate_rows",
                "inconsistent_values",
                "potential_outliers",
              ] as DataIssueType[]
            )
              .filter((type) => grouped.has(type))
              .map((type) => {
                const info = grouped.get(type)!;
                // Find the first issue id for this type (for Fix → button)
                const firstIssue = profile.issues.find((i) => i.type === type);
                return (
                  <div
                    key={type}
                    className="flex w-full items-center gap-4 px-5 py-3.5"
                  >
                    <span className="shrink-0 font-mono text-sm text-muted-foreground" aria-hidden>
                      {ISSUE_ICONS[type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {ISSUE_TYPE_LABELS[type]}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {info.totalCount.toLocaleString()} value{info.totalCount !== 1 ? "s" : ""}
                        {info.columns.length > 0 &&
                          ` · ${info.columns.length} column${info.columns.length !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="shrink-0 flex gap-3 text-xs">
                      <button
                        onClick={() => onFocusIssue(type, info.columns[0])}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        View →
                      </button>
                      {firstIssue && (
                        <button
                          onClick={() => onOpenClean(firstIssue.id)}
                          className="font-medium text-success hover:underline"
                        >
                          Fix →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── Problematic columns ───────────────────────────────────── */}
      {problematicColumns.length > 0 && (
        <div>
          <h3 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Columns with issues
          </h3>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {problematicColumns.map((col) => (
              <button
                key={col.name}
                onClick={() => onFocusColumn(col.name)}
                className="flex items-center justify-between bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium text-foreground">
                    {col.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[
                      col.missingCount > 0 && `${col.missingCount} missing`,
                      col.inconsistentGroups.length > 0 && "inconsistent values",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Column type breakdown ─────────────────────────────────── */}
      <ColumnTypeSummary profile={profile} />
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub: string;
  variant: "good" | "warn" | "neutral";
}) {
  const valueClass =
    variant === "good"
      ? "text-success"
      : variant === "warn"
      ? "text-warning"
      : "text-foreground";
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function ColumnTypeSummary({ profile }: { profile: DatasetProfile }) {
  const counts: Record<string, number> = {};
  for (const col of profile.columns) {
    counts[col.inferredType] = (counts[col.inferredType] ?? 0) + 1;
  }
  const TYPE_LABEL: Record<string, string> = {
    text: "Text",
    number: "Number",
    boolean: "Boolean",
    date: "Date",
    unknown: "Unknown",
  };
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
        Column types
      </h3>
      <div className="flex flex-wrap gap-2">
        {entries.map(([type, count]) => (
          <div
            key={type}
            className="flex items-center gap-2 border border-border bg-surface px-3 py-2"
          >
            <span className="text-sm font-medium text-foreground">
              {TYPE_LABEL[type] ?? type}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
