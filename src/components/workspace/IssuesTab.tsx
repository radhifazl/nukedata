import { useState } from "react";
import type { DataIssue, DataIssueType, DatasetProfile } from "@/types/profile";

const ALL_TYPES: DataIssueType[] = [
  "missing_values",
  "duplicate_rows",
  "inconsistent_values",
  "potential_outliers",
];

const TYPE_LABEL: Record<DataIssueType, string> = {
  missing_values: "Missing values",
  duplicate_rows: "Duplicate rows",
  inconsistent_values: "Inconsistent values",
  potential_outliers: "Potential outliers",
};

const TYPE_ICON: Record<DataIssueType, string> = {
  missing_values: "○",
  duplicate_rows: "⊡",
  inconsistent_values: "≈",
  potential_outliers: "◇",
};

const SEVERITY_BADGE: Record<string, string> = {
  high: "issue-badge issue-danger",
  medium: "issue-badge issue-warning",
  low: "border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground",
};

interface IssuesTabProps {
  profile: DatasetProfile;
  onFocusIssue: (type: DataIssueType, column?: string) => void;
  onOpenClean: (issueId: string) => void;
}

export function IssuesTab({ profile, onFocusIssue, onOpenClean }: IssuesTabProps) {
  const [typeFilter, setTypeFilter] = useState<DataIssueType | "all">("all");

  const presentTypes = ALL_TYPES.filter((t) =>
    profile.issues.some((i) => i.type === t)
  );

  const filtered =
    typeFilter === "all"
      ? profile.issues
      : profile.issues.filter((i) => i.type === typeFilter);

  // Sort high → medium → low
  const sorted = [...filtered].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  if (profile.issues.length === 0) {
    return (
      <div className="border border-border bg-surface px-8 py-16 text-center">
        <p className="text-sm font-medium text-success">No issues detected</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          This dataset looks clean.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Type filter */}
      <div className="flex flex-wrap gap-1">
        <TypeChip
          active={typeFilter === "all"}
          onClick={() => setTypeFilter("all")}
        >
          All ({profile.issues.length})
        </TypeChip>
        {presentTypes.map((t) => {
          const count = profile.issues.filter((i) => i.type === t).length;
          return (
            <TypeChip
              key={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            >
              {TYPE_LABEL[t]} ({count})
            </TypeChip>
          );
        })}
      </div>

      {/* Issue list */}
      <div className="divide-y divide-border border border-border bg-surface">
        {sorted.map((issue) => (
          <IssueRow key={issue.id} issue={issue} onFocus={onFocusIssue} onOpenClean={onOpenClean} />
        ))}
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  onFocus,
  onOpenClean,
}: {
  issue: DataIssue;
  onFocus: (type: DataIssueType, column?: string) => void;
  onOpenClean: (issueId: string) => void;
}) {
  return (
    <div className="flex w-full items-start gap-4 px-5 py-4">
      <span
        className="mt-0.5 shrink-0 font-mono text-base text-muted-foreground"
        aria-hidden
      >
        {TYPE_ICON[issue.type]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            {TYPE_LABEL[issue.type]}
          </p>
          <span className={SEVERITY_BADGE[issue.severity]}>
            {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
          </span>
          {issue.column && (
            <code className="border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
              {issue.column}
            </code>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <InlineCode text={issue.description} />
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="font-mono text-xs text-muted-foreground">
          ×{issue.count.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onFocus(issue.type, issue.column)}
            className="text-[0.65rem] text-primary hover:underline"
          >
            View →
          </button>
          <button
            onClick={() => onOpenClean(issue.id)}
            className="text-[0.65rem] font-medium text-success hover:underline"
          >
            Fix →
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code
            key={i}
            className="rounded-sm bg-surface-elevated px-1 font-mono text-[0.75em] text-foreground"
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 text-xs transition-colors ${
        active
          ? "border border-primary bg-primary/10 font-medium text-primary"
          : "border border-border bg-surface text-muted-foreground hover:bg-surface-elevated"
      }`}
    >
      {children}
    </button>
  );
}
