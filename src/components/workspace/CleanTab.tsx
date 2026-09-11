"use client";
import { useState, useEffect } from "react";
import type { DataIssue, DataIssueType, DatasetProfile } from "@/types/profile";
import { CleaningPanel } from "./CleaningPanel";
import { CleaningHistory } from "./CleaningHistory";

const TYPE_ICON: Record<DataIssueType, string> = {
  missing_values: "○",
  duplicate_rows: "⊡",
  inconsistent_values: "≈",
  potential_outliers: "◇",
};

const TYPE_LABEL: Record<DataIssueType, string> = {
  missing_values: "Missing values",
  duplicate_rows: "Duplicate rows",
  inconsistent_values: "Inconsistent values",
  potential_outliers: "Potential outliers",
};

const SEVERITY_BADGE: Record<string, string> = {
  high: "issue-badge issue-danger",
  medium: "issue-badge issue-warning",
  low: "border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground",
};

interface CleanTabProps {
  profile: DatasetProfile;
  initialIssueId?: string | null;
}

export function CleanTab({ profile, initialIssueId }: CleanTabProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    initialIssueId ?? null
  );

  // When the profile updates (after a fix), clear the selection if the issue
  // no longer exists — prevents the panel from showing a stale/resolved issue.
  useEffect(() => {
    if (selectedIssueId && !profile.issues.some((i) => i.id === selectedIssueId)) {
      setSelectedIssueId(null);
    }
  }, [profile.issues, selectedIssueId]);

  const selectedIssue =
    profile.issues.find((i) => i.id === selectedIssueId) ?? null;

  if (profile.issues.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border border-border bg-surface px-8 py-16 text-center">
          <p className="text-sm font-medium text-success">No issues to fix</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            This dataset looks clean — no issues were detected.
          </p>
        </div>
        <CleaningHistory />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Left: issues list */}
        <div className="border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {profile.issues.length} issue{profile.issues.length !== 1 ? "s" : ""} detected
            </p>
          </div>
          <div className="divide-y divide-border">
            {profile.issues.map((issue) => (
              <button
                key={issue.id}
                onClick={() =>
                  setSelectedIssueId(
                    selectedIssueId === issue.id ? null : issue.id
                  )
                }
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  selectedIssueId === issue.id
                    ? "bg-primary/5"
                    : "hover:bg-surface-elevated"
                }`}
              >
                <span
                  className="mt-0.5 shrink-0 font-mono text-sm text-muted-foreground"
                  aria-hidden
                >
                  {TYPE_ICON[issue.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground">
                      {TYPE_LABEL[issue.type]}
                    </p>
                    <span className={SEVERITY_BADGE[issue.severity]}>
                      {issue.severity.charAt(0).toUpperCase() +
                        issue.severity.slice(1)}
                    </span>
                  </div>
                  {issue.column && (
                    <code className="mt-0.5 block truncate font-mono text-[0.65rem] text-muted-foreground">
                      {issue.column}
                    </code>
                  )}
                  <p className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">
                    ×{issue.count.toLocaleString()}
                  </p>
                </div>
                {selectedIssueId === issue.id && (
                  <span className="shrink-0 text-xs text-primary">Fix →</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right: cleaning panel */}
        <div>
          <CleaningPanel
            issue={selectedIssue}
            onClose={() => setSelectedIssueId(null)}
          />
        </div>
      </div>

      {/* Below: history */}
      <CleaningHistory />
    </div>
  );
}
