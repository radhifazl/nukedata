"use client";
import { useState, useMemo, useCallback } from "react";
import type { Dataset } from "@/types/dataset";
import type { DatasetProfile, DataIssueType } from "@/types/profile";
import { isMissing } from "@/utils/csv/profileDataset";
import { useDataset } from "@/context/DatasetContext";

const PAGE_SIZES = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

// Max columns shown by default; user can reveal more
const DEFAULT_VISIBLE_LIMIT = 20;

interface DataTabProps {
  dataset: Dataset;
  profile: DatasetProfile;
  focusedColumn: string | null;
  rowFilter: "all" | DataIssueType;
  onRowFilterChange: (f: "all" | DataIssueType) => void;
  onFocusColumn: (name: string | null) => void;
}

export function DataTab({
  dataset,
  profile,
  focusedColumn,
  rowFilter,
  onRowFilterChange,
  onFocusColumn,
}: DataTabProps) {
  const { operations, cleanedDataset } = useDataset();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [colPanelOpen, setColPanelOpen] = useState(false);
  const [showCleaned, setShowCleaned] = useState(false);

  // Active dataset: cleaned or original
  const activeDataset = showCleaned && cleanedDataset ? cleanedDataset : dataset;

  // Column visibility: start with a reasonable default
  const defaultVisible = useMemo(() => {
    const names = dataset.columns.map((c) => c.name);
    if (names.length <= DEFAULT_VISIBLE_LIMIT) return new Set(names);
    // Prioritise columns with issues
    const withIssues = new Set(
      profile.issues.filter((i) => i.column).map((i) => i.column!)
    );
    const visible = new Set<string>();
    for (const name of names) {
      if (visible.size >= DEFAULT_VISIBLE_LIMIT) break;
      if (withIssues.has(name)) visible.add(name);
    }
    for (const name of names) {
      if (visible.size >= DEFAULT_VISIBLE_LIMIT) break;
      visible.add(name);
    }
    return visible;
  }, [dataset.columns, profile.issues]);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(defaultVisible);

  // Columns that have issues — for header badges
  const colsWithIssues = useMemo(() => {
    const s = new Set<string>();
    for (const issue of profile.issues) {
      if (issue.column) s.add(issue.column);
    }
    return s;
  }, [profile.issues]);

  // Sets of row indices with various issues (for filtering)
  const rowIssueIndex = useMemo(() => {
    const missing = new Set<number>();
    const duplicate = new Set<number>();
    const inconsistent = new Set<number>();
    const outlier = new Set<number>();

    // Missing: check every row
    for (let i = 0; i < dataset.rows.length; i++) {
      const row = dataset.rows[i];
      if (
        dataset.columns.some((c) => isMissing(row[c.name]))
      ) {
        missing.add(i);
      }
    }

    // Duplicate: mark exact duplicates
    const seen = new Map<string, number>();
    for (let i = 0; i < dataset.rows.length; i++) {
      const key = dataset.columns
        .map((c) => String(dataset.rows[i][c.name] ?? ""))
        .join("\x00");
      if (seen.has(key)) {
        duplicate.add(i);
      } else {
        seen.set(key, i);
      }
    }

    // Inconsistent: rows where any text cell has a normalised-form collision
    const inconsistentCols = profile.columns.filter(
      (c) => c.inconsistentGroups.length > 0
    );
    if (inconsistentCols.length > 0) {
      // Build map: colName → Set of values that appear in multiple raw forms
      const affectedValues = new Map<string, Set<string>>();
      for (const col of inconsistentCols) {
        const vals = new Set<string>();
        for (const g of col.inconsistentGroups) {
          for (const v of g.rawValues) vals.add(v.trim().toLowerCase());
        }
        affectedValues.set(col.name, vals);
      }
      for (let i = 0; i < dataset.rows.length; i++) {
        for (const [colName, vals] of affectedValues) {
          const raw = dataset.rows[i][colName];
          if (!isMissing(raw) && vals.has(String(raw).trim().toLowerCase())) {
            inconsistent.add(i);
            break;
          }
        }
      }
    }

    // Outlier: rows where any numeric cell was flagged
    // We detect this from the issues: find outlier issues and re-check bounds
    const outlierIssues = profile.issues.filter(
      (iss) => iss.type === "potential_outliers" && iss.column
    );
    if (outlierIssues.length > 0) {
      for (const issue of outlierIssues) {
        const colName = issue.column!;
        const colProfile = profile.columns.find((c) => c.name === colName);
        if (!colProfile?.numericStats) continue;
        const vals = dataset.rows
          .map((r) => r[colName])
          .filter((v) => !isMissing(v))
          .map((v) => parseFloat(String(v).replace(/,/g, "")));
        const sorted = [...vals].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        if (iqr === 0) continue;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        for (let i = 0; i < dataset.rows.length; i++) {
          const raw = dataset.rows[i][colName];
          if (isMissing(raw)) continue;
          const num = parseFloat(String(raw).replace(/,/g, ""));
          if (num < lower || num > upper) outlier.add(i);
        }
      }
    }

    return { missing, duplicate, inconsistent, outlier };
  }, [dataset.rows, dataset.columns, profile.columns, profile.issues]);

  const rowsWithAnyIssue = useMemo(() => {
    const s = new Set<number>();
    for (const idx of rowIssueIndex.missing) s.add(idx);
    for (const idx of rowIssueIndex.duplicate) s.add(idx);
    for (const idx of rowIssueIndex.inconsistent) s.add(idx);
    for (const idx of rowIssueIndex.outlier) s.add(idx);
    return s;
  }, [rowIssueIndex]);

  // Filtered rows — use activeDataset so Cleaned view filters on cleaned rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return activeDataset.rows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row, idx }) => {
        // Row filter (always based on original issue index)
        if (rowFilter === "missing_values" && !rowIssueIndex.missing.has(idx)) return false;
        if (rowFilter === "duplicate_rows" && !rowIssueIndex.duplicate.has(idx)) return false;
        if (rowFilter === "inconsistent_values" && !rowIssueIndex.inconsistent.has(idx)) return false;
        if (rowFilter === "potential_outliers" && !rowIssueIndex.outlier.has(idx)) return false;

        // Search
        if (q) {
          const match = activeDataset.columns.some((c) => {
            const val = row[c.name];
            return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
          });
          if (!match) return false;
        }

        return true;
      });
  }, [activeDataset.rows, activeDataset.columns, rowFilter, rowIssueIndex, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }
  function handleRowFilter(f: "all" | DataIssueType) {
    onRowFilterChange(f);
    setPage(1);
  }
  function handlePageSize(n: PageSize) {
    setPageSize(n);
    setPage(1);
  }

  const toggleColumn = useCallback(
    (name: string) => {
      setVisibleColumns((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
    },
    []
  );

  // Columns in display order (preserve original order, only show visible)
  const displayColumns = activeDataset.columns.filter((c) => visibleColumns.has(c.name));
  const hiddenCount = activeDataset.columns.length - visibleColumns.size;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Original / Cleaned toggle ─────────────────────────────── */}
      {operations.length > 0 && (
        <div className="flex items-center gap-1 self-start border border-border bg-surface">
          <button
            onClick={() => setShowCleaned(false)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              !showCleaned
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface-elevated"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setShowCleaned(true)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              showCleaned
                ? "bg-success text-white"
                : "text-muted-foreground hover:bg-surface-elevated"
            }`}
          >
            Cleaned
          </button>
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search values…"
          className="h-8 min-w-[12rem] flex-1 border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />

        {/* Row filter */}
        <div className="flex flex-wrap gap-1">
          <RowFilterChip
            active={rowFilter === "all"}
            onClick={() => handleRowFilter("all")}
          >
            All rows
          </RowFilterChip>
          {rowsWithAnyIssue.size > 0 && (
            <RowFilterChip
              active={
                rowFilter === "missing_values" ||
                rowFilter === "duplicate_rows" ||
                rowFilter === "inconsistent_values" ||
                rowFilter === "potential_outliers"
              }
              onClick={() => handleRowFilter("missing_values")}
              warn
            >
              Rows with issues ({rowsWithAnyIssue.size})
            </RowFilterChip>
          )}
        </div>

        {/* Column visibility toggle */}
        <div className="relative">
          <button
            onClick={() => setColPanelOpen((v) => !v)}
            className={`flex h-8 items-center gap-1.5 border px-3 text-xs transition-colors ${
              colPanelOpen
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"
            }`}
          >
            Columns
            {hiddenCount > 0 && (
              <span className="font-mono text-[0.65rem] text-muted-foreground">
                ({visibleColumns.size}/{activeDataset.columns.length})
              </span>
            )}
            <span aria-hidden>{colPanelOpen ? "▲" : "▼"}</span>
          </button>

          {colPanelOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 max-h-72 w-56 overflow-y-auto border border-border bg-surface shadow-md">
              <div className="border-b border-border px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Show / hide columns</span>
                <button
                  onClick={() =>
                    setVisibleColumns(new Set(activeDataset.columns.map((c) => c.name)))
                  }
                  className="text-[0.65rem] text-primary hover:underline"
                >
                  Show all
                </button>
              </div>
              {activeDataset.columns.map((col) => (
                <label
                  key={col.name}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-elevated"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.name)}
                    onChange={() => toggleColumn(col.name)}
                    className="accent-primary"
                  />
                  <span className="truncate font-mono text-xs text-foreground">
                    {col.name}
                  </span>
                  {colsWithIssues.has(col.name) && (
                    <span className="ml-auto shrink-0 text-xs text-warning">⚠</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row count info */}
      <p className="text-xs text-muted-foreground">
        {filteredRows.length < activeDataset.rowCount ? (
          <>
            Showing{" "}
            <span className="font-medium text-foreground">
              {filteredRows.length.toLocaleString()}
            </span>{" "}
            of {activeDataset.rowCount.toLocaleString()} rows
            {search && ` matching "${search}"`}
          </>
        ) : (
          <>
            {activeDataset.rowCount.toLocaleString()} row{activeDataset.rowCount !== 1 ? "s" : ""}
          </>
        )}
        {hiddenCount > 0 && (
          <> · <span className="text-muted-foreground">{hiddenCount} column{hiddenCount !== 1 ? "s" : ""} hidden</span></>
        )}
      </p>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div
        className="border border-border bg-surface overflow-hidden"
        onClick={() => setColPanelOpen(false)}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-surface-elevated">
              <tr>
                {/* Row number */}
                <th className="sticky left-0 z-10 bg-surface-elevated px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                  #
                </th>
                {displayColumns.map((col) => {
                  const hasIssue = colsWithIssues.has(col.name);
                  const isFocused = focusedColumn === col.name;
                  return (
                    <th
                      key={col.name}
                      className={`whitespace-nowrap border-b border-l border-border px-4 py-2.5 text-xs font-medium transition-colors ${
                        isFocused
                          ? "bg-primary/10 text-primary"
                          : hasIssue
                          ? "text-warning"
                          : "text-muted-foreground"
                      }`}
                    >
                      <button
                        className="flex items-center gap-1.5 hover:text-foreground"
                        onClick={() =>
                          onFocusColumn(isFocused ? null : col.name)
                        }
                      >
                        {col.name}
                        {hasIssue && !isFocused && (
                          <span className="text-warning" aria-label="has issues">⚠</span>
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayColumns.length + 1}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No rows match the current filters.
                  </td>
                </tr>
              ) : (
                pageRows.map(({ row, idx }) => {
                  const hasIssue = rowsWithAnyIssue.has(idx);
                  return (
                    <tr
                      key={idx}
                      className={`border-t border-border ${
                        hasIssue
                          ? "hover:bg-warning/5"
                          : "hover:bg-surface-elevated"
                      }`}
                    >
                      {/* Row number */}
                      <td className="sticky left-0 z-10 bg-surface px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {idx + 1}
                      </td>
                      {displayColumns.map((col) => {
                        const val = row[col.name];
                        const missing = isMissing(val);
                        const display = missing ? "" : String(val);
                        const isFocused = focusedColumn === col.name;
                        const isColIssued = colsWithIssues.has(col.name);
                        // Changed-cell detection: compare against original when viewing cleaned
                        const isChanged =
                          showCleaned &&
                          cleanedDataset !== null &&
                          idx < dataset.rows.length &&
                          String(dataset.rows[idx][col.name] ?? "") !==
                            String(row[col.name] ?? "");

                        return (
                          <td
                            key={col.name}
                            className={`max-w-[200px] truncate border-l border-border px-4 py-2 font-mono text-xs tabular-nums transition-colors ${
                              isFocused
                                ? "bg-primary/5"
                                : isChanged
                                ? "bg-success/10"
                                : isColIssued && missing
                                ? "bg-danger/5"
                                : ""
                            }`}
                            title={display.length > 30 ? display : undefined}
                          >
                            {missing ? (
                              <span className="italic text-danger/70">missing</span>
                            ) : (
                              <span className={isChanged ? "text-success font-medium" : "text-foreground"}>
                                {display}
                              </span>
                            )}
                            {isChanged && (
                              <span
                                className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle"
                                aria-label="changed"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ────────────────────────────────────────────── */}
      {filteredRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Rows {startIdx + 1}–{Math.min(startIdx + pageSize, filteredRows.length)} of{" "}
            {filteredRows.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="dt-page-size">Per page:</label>
              <select
                id="dt-page-size"
                value={pageSize}
                onChange={(e) => handlePageSize(Number(e.target.value) as PageSize)}
                className="border border-border bg-surface px-2 py-1 text-xs text-foreground"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="border border-border bg-surface px-2.5 py-1 text-xs disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <span>
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="border border-border bg-surface px-2.5 py-1 text-xs disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowFilterChip({
  active,
  warn,
  onClick,
  children,
}: {
  active: boolean;
  warn?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-2.5 text-xs transition-colors ${
        active && warn
          ? "border border-warning bg-warning/10 font-medium text-warning"
          : active
          ? "border border-primary bg-primary/10 font-medium text-primary"
          : "border border-border bg-surface text-muted-foreground hover:bg-surface-elevated"
      }`}
    >
      {children}
    </button>
  );
}
