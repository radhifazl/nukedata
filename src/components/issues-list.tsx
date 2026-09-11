import type { DataIssue, DataIssueType, IssueSeverity } from "@/types/profile";

interface IssuesListProps {
  issues: DataIssue[];
}

const TYPE_LABEL: Record<DataIssueType, string> = {
  missing_values: "Missing values",
  duplicate_rows: "Duplicate rows",
  inconsistent_values: "Inconsistent values",
  potential_outliers: "Potential outliers",
};

const SEVERITY_CLASS: Record<IssueSeverity, string> = {
  high: "issue-badge issue-danger",
  medium: "issue-badge issue-warning",
  low: "border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground",
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const ISSUE_ICON: Record<DataIssueType, string> = {
  missing_values: "○",
  duplicate_rows: "⊡",
  inconsistent_values: "≈",
  potential_outliers: "◇",
};

export function IssuesList({ issues }: IssuesListProps) {
  if (issues.length === 0) {
    return (
      <div className="border border-border bg-surface px-5 py-8 text-center">
        <p className="text-sm font-medium text-success">No issues detected</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This dataset looks clean.
        </p>
      </div>
    );
  }

  // Sort: high → medium → low
  const sorted = [...issues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="flex flex-col divide-y divide-border border border-border bg-surface">
      {sorted.map((issue) => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

function IssueRow({ issue }: { issue: DataIssue }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      {/* Icon */}
      <span
        className="mt-0.5 shrink-0 font-mono text-base text-muted-foreground"
        aria-hidden
      >
        {ISSUE_ICON[issue.type]}
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            {TYPE_LABEL[issue.type]}
          </p>
          <span className={SEVERITY_CLASS[issue.severity]}>
            {SEVERITY_LABEL[issue.severity]}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {/* Render inline code in description (backtick-delimited) */}
          <IssueDescription text={issue.description} />
        </p>
      </div>

      {/* Count badge */}
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        ×{issue.count.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * Renders a description string, turning `backtick` spans into <code> elements.
 */
function IssueDescription({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code
            key={i}
            className="rounded-sm bg-surface-elevated px-1 font-mono text-[0.75em] text-foreground"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
