"use client";
import { useState } from "react";
import type { Dataset } from "@/types/dataset";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface DatasetTableProps {
  dataset: Dataset;
}

export function DatasetTable({ dataset }: DatasetTableProps) {
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(dataset.rowCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const visibleRows = dataset.rows.slice(startIndex, startIndex + pageSize);
  const startRow = startIndex + 1;
  const endRow = Math.min(startIndex + pageSize, dataset.rowCount);

  function handlePageSize(next: PageSize) {
    setPageSize(next);
    setPage(1);
  }

  if (dataset.rowCount === 0) {
    return (
      <div className="border border-border bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
        This dataset contains columns but no rows.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Table */}
      <div className="overflow-hidden border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="sticky top-0 bg-surface-elevated">
              <tr>
                {dataset.columns.map((col) => (
                  <th
                    key={col.name}
                    className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground"
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-t border-border hover:bg-surface-elevated/60"
                >
                  {dataset.columns.map((col) => {
                    const val = row[col.name];
                    const display =
                      val === null || val === undefined
                        ? ""
                        : String(val);
                    return (
                      <td
                        key={col.name}
                        className="max-w-[260px] truncate px-4 py-2.5 text-foreground"
                        title={display.length > 40 ? display : undefined}
                      >
                        {display === "" ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : (
                          display
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Showing rows {startRow}–{endRow} of{" "}
          {dataset.rowCount.toLocaleString()}
        </span>

        <div className="flex items-center gap-4">
          {/* Rows per page */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="rows-per-page">Rows per page:</label>
            <select
              id="rows-per-page"
              value={pageSize}
              onChange={(e) => handlePageSize(Number(e.target.value) as PageSize)}
              className="border border-border bg-surface px-2 py-1 text-xs text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="border border-border bg-surface px-2.5 py-1 text-xs disabled:opacity-40"
              aria-label="Previous page"
            >
              ‹ Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="border border-border bg-surface px-2.5 py-1 text-xs disabled:opacity-40"
              aria-label="Next page"
            >
              Next ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
