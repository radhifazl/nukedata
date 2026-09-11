"use client";
import { useState, useMemo } from "react";
import type { ColumnProfile, ColumnType, DatasetProfile } from "@/types/profile";

const TYPE_LABEL: Record<ColumnType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Boolean",
  date: "Date",
  unknown: "Unknown",
};

type TypeFilter = ColumnType | "all";
type IssueFilter = "all" | "has_issues" | "no_issues";

interface ColumnsTabProps {
  profile: DatasetProfile;
  focusedColumn: string | null;
  onFocusColumn: (name: string | null) => void;
}

export function ColumnsTab({ profile, focusedColumn, onFocusColumn }: ColumnsTabProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");

  const columnHasIssue = useMemo(() => {
    const s = new Set<string>();
    for (const issue of profile.issues) {
      if (issue.column) s.add(issue.column);
    }
    return s;
  }, [profile.issues]);

  const filtered = useMemo(() => {
    return profile.columns.filter((col) => {
      if (search && !col.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && col.inferredType !== typeFilter) return false;
      if (issueFilter === "has_issues" && !columnHasIssue.has(col.name)) return false;
      if (issueFilter === "no_issues" && columnHasIssue.has(col.name)) return false;
      return true;
    });
  }, [profile.columns, search, typeFilter, issueFilter, columnHasIssue]);

  const activeColumn = focusedColumn
    ? profile.columns.find((c) => c.name === focusedColumn) ?? null
    : null;

  // Available type values in this dataset
  const availableTypes = useMemo(
    () => Array.from(new Set(profile.columns.map((c) => c.inferredType))),
    [profile.columns]
  );

  return (
    <div className="flex gap-0">
      {/* ── Column list ─────────────────────────────────────────── */}
      <div className={`min-w-0 flex-1 ${activeColumn ? "hidden sm:block" : ""}`}>
        {/* Controls */}
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns…"
            className="h-8 min-w-[10rem] flex-1 border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-1">
            {(["all", ...availableTypes] as (TypeFilter)[]).map((t) => (
              <FilterChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
              >
                {t === "all" ? "All types" : TYPE_LABEL[t as ColumnType]}
              </FilterChip>
            ))}
          </div>
          <div className="flex gap-1">
            {(["all", "has_issues", "no_issues"] as IssueFilter[]).map((f) => (
              <FilterChip
                key={f}
                active={issueFilter === f}
                onClick={() => setIssueFilter(f)}
              >
                {f === "all" ? "All" : f === "has_issues" ? "Has issues" : "Clean"}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Count */}
        <p className="mb-2 text-xs text-muted-foreground">
          {filtered.length} of {profile.columns.length} column{profile.columns.length !== 1 ? "s" : ""}
        </p>

        {/* Table */}
        <div className="border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-elevated">
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Column</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Missing</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Unique</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No columns match the current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((col) => {
                    const hasIssue = columnHasIssue.has(col.name);
                    const isSelected = focusedColumn === col.name;
                    return (
                      <tr
                        key={col.name}
                        onClick={() => onFocusColumn(isSelected ? null : col.name)}
                        className={`cursor-pointer border-t border-border transition-colors ${
                          isSelected
                            ? "bg-primary/5"
                            : "hover:bg-surface-elevated"
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-sm font-medium text-foreground">
                            {col.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="border border-border px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                            {TYPE_LABEL[col.inferredType]}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono text-xs tabular-nums ${col.missingCount > 0 ? "text-warning" : "text-muted-foreground"}`}>
                          {col.missingCount > 0 ? col.missingCount.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {col.uniqueCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          {hasIssue ? (
                            <span className="issue-badge issue-warning">Issues</span>
                          ) : (
                            <span className="text-xs text-success">✓ Clean</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Detail panel ────────────────────────────────────────── */}
      {activeColumn && (
        <div className="w-full border border-border bg-surface sm:ml-4 sm:w-72 sm:shrink-0 lg:w-80">
          <ColumnDetailPanel
            col={activeColumn}
            rowCount={profile.rowCount}
            onClose={() => onFocusColumn(null)}
          />
        </div>
      )}
    </div>
  );
}

function ColumnDetailPanel({
  col,
  rowCount,
  onClose,
}: {
  col: ColumnProfile;
  rowCount: number;
  onClose: () => void;
}) {
  const completeness =
    rowCount > 0
      ? ((col.totalValues / rowCount) * 100).toFixed(1)
      : "100.0";
  const completenessNum = parseFloat(completeness);
  const barWidth = Math.max(0, Math.min(100, completenessNum));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-foreground">
            {col.name}
          </p>
          <span className="border border-border px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
            {TYPE_LABEL[col.inferredType]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 grid h-7 w-7 place-items-center border border-border text-muted-foreground hover:bg-surface-elevated"
          aria-label="Close detail panel"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Key stats */}
        <div className="space-y-2">
          <DetailRow label="Values" value={col.totalValues.toLocaleString()} />
          <DetailRow
            label="Missing"
            value={col.missingCount > 0 ? col.missingCount.toLocaleString() : "0"}
            valueClass={col.missingCount > 0 ? "text-warning" : "text-muted-foreground"}
          />
          <DetailRow label="Unique" value={col.uniqueCount.toLocaleString()} />
          <DetailRow
            label="Unique ratio"
            value={`${(col.uniqueRatio * 100).toFixed(1)}%`}
          />
        </div>

        {/* Completeness bar */}
        <div>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-muted-foreground">Completeness</span>
            <span className={`font-medium ${completenessNum < 95 ? "text-warning" : "text-success"}`}>
              {completeness}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-border">
            <div
              className={`h-full transition-all ${completenessNum >= 95 ? "bg-success" : completenessNum >= 80 ? "bg-warning" : "bg-danger"}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Numeric stats */}
        {col.numericStats && (
          <div>
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Statistics
            </p>
            <div className="space-y-1.5">
              {(
                [
                  ["Min", col.numericStats.min],
                  ["Max", col.numericStats.max],
                  ["Mean", col.numericStats.mean],
                  ["Median", col.numericStats.median],
                  ["Std Dev", col.numericStats.stdDev],
                ] as [string, number][]
              ).map(([label, val]) => (
                <DetailRow
                  key={label}
                  label={label}
                  value={
                    Number.isFinite(val)
                      ? val % 1 === 0
                        ? val.toLocaleString()
                        : val.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : "—"
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Date range */}
        {col.dateStats && (
          <div>
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Date Range
            </p>
            <div className="space-y-1.5">
              <DetailRow label="Earliest" value={col.dateStats.earliest || "—"} />
              <DetailRow label="Latest" value={col.dateStats.latest || "—"} />
            </div>
          </div>
        )}

        {/* Inconsistent groups */}
        {col.inconsistentGroups.length > 0 && (
          <div>
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-widest text-warning">
              Inconsistent values
            </p>
            <div className="space-y-2">
              {col.inconsistentGroups.slice(0, 6).map((group) => (
                <div key={group.normalizedForm} className="flex flex-wrap gap-1">
                  {group.rawValues.map((v) => (
                    <code
                      key={v}
                      className="border border-warning/30 bg-warning/5 px-1.5 py-0.5 font-mono text-xs text-foreground"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              ))}
              {col.inconsistentGroups.length > 6 && (
                <p className="text-xs text-muted-foreground">
                  + {col.inconsistentGroups.length - 6} more group{col.inconsistentGroups.length - 6 !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-xs font-medium tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function FilterChip({
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
      className={`h-8 px-2.5 text-xs transition-colors ${
        active
          ? "border border-primary bg-primary/10 font-medium text-primary"
          : "border border-border bg-surface text-muted-foreground hover:bg-surface-elevated"
      }`}
    >
      {children}
    </button>
  );
}
