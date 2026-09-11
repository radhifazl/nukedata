"use client";
import { useState } from "react";
import type { ColumnProfile } from "@/types/profile";

interface ColumnProfilesProps {
  columns: ColumnProfile[];
}

const TYPE_LABEL: Record<string, string> = {
  text: "Text",
  number: "Number",
  boolean: "Boolean",
  date: "Date",
  unknown: "Unknown",
};

export function ColumnProfiles({ columns }: ColumnProfilesProps) {
  return (
    <div className="flex flex-col divide-y divide-border border border-border bg-surface">
      {columns.map((col) => (
        <ColumnCard key={col.name} col={col} />
      ))}
    </div>
  );
}

function ColumnCard({ col }: { col: ColumnProfile }) {
  const [open, setOpen] = useState(false);

  const hasDetails =
    col.numericStats !== null ||
    col.dateStats !== null ||
    col.inconsistentGroups.length > 0;

  const hasInconsistency = col.inconsistentGroups.length > 0;
  const hasOutliers =
    col.numericStats !== null &&
    (() => {
      // Re-use the pre-computed count surfaced as an issue; here we just show
      // the warning indicator on the card — the exact count is in the issues list.
      return false; // actual outlier indicator comes from issues, not column profile
    })();

  void hasOutliers; // suppress unused warning — kept for future use

  return (
    <div className="px-5 py-4">
      {/* Top row: name + type badge + toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-foreground">
              {col.name}
            </span>
            <span className="border border-border px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
              {TYPE_LABEL[col.inferredType] ?? col.inferredType}
            </span>
            {hasInconsistency && (
              <span className="issue-badge issue-warning">
                Inconsistent values
              </span>
            )}
            {col.missingCount > 0 && (
              <span className="issue-badge issue-danger">
                {col.missingCount} missing
              </span>
            )}
          </div>
          {/* Summary line */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {col.totalValues.toLocaleString()} value{col.totalValues !== 1 ? "s" : ""}
            {" · "}
            {col.uniqueCount.toLocaleString()} unique
            {" · "}
            {col.missingCount === 0
              ? "complete"
              : `${col.missingCount.toLocaleString()} missing`}
          </p>
        </div>

        {hasDetails && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-elevated"
            aria-expanded={open}
            aria-controls={`col-details-${col.name}`}
          >
            {open ? "Hide ↑" : "Details ↓"}
          </button>
        )}
      </div>

      {/* Expandable details */}
      {open && hasDetails && (
        <div
          id={`col-details-${col.name}`}
          className="mt-4 space-y-4 border-t border-border pt-4"
        >
          {/* Numeric stats */}
          {col.numericStats && (
            <div>
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Numeric Statistics
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-5">
                {(
                  [
                    ["Min", col.numericStats.min],
                    ["Max", col.numericStats.max],
                    ["Mean", col.numericStats.mean],
                    ["Median", col.numericStats.median],
                    ["Std Dev", col.numericStats.stdDev],
                  ] as [string, number][]
                ).map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[0.68rem] text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {Number.isFinite(val)
                        ? val % 1 === 0
                          ? val.toLocaleString()
                          : val.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date stats */}
          {col.dateStats && (
            <div>
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Date Range
              </p>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <p className="text-[0.68rem] text-muted-foreground">Earliest</p>
                  <p className="text-sm font-medium text-foreground">
                    {col.dateStats.earliest || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[0.68rem] text-muted-foreground">Latest</p>
                  <p className="text-sm font-medium text-foreground">
                    {col.dateStats.latest || "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Inconsistent groups */}
          {col.inconsistentGroups.length > 0 && (
            <div>
              <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Inconsistent Representations
              </p>
              <div className="space-y-2">
                {col.inconsistentGroups.slice(0, 8).map((group) => (
                  <div
                    key={group.normalizedForm}
                    className="flex flex-wrap gap-1.5"
                  >
                    {group.rawValues.map((v) => (
                      <code
                        key={v}
                        className="border border-warning/40 bg-warning/5 px-1.5 py-0.5 font-mono text-xs text-foreground"
                      >
                        {v}
                      </code>
                    ))}
                    <span className="self-center text-xs text-muted-foreground">
                      → same when normalised
                    </span>
                  </div>
                ))}
                {col.inconsistentGroups.length > 8 && (
                  <p className="text-xs text-muted-foreground">
                    and {col.inconsistentGroups.length - 8} more group
                    {col.inconsistentGroups.length - 8 !== 1 ? "s" : ""}…
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
