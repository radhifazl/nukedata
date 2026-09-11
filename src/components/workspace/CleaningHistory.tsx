"use client";
import { useState } from "react";
import { useDataset } from "@/context/DatasetContext";

export function CleaningHistory() {
  const { operations, undoLastOperation, resetOperations } = useDataset();
  const [confirmReset, setConfirmReset] = useState(false);

  if (operations.length === 0) {
    return (
      <div className="border border-border bg-surface px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Changes
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          No changes applied yet. Select an issue and apply a fix.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-surface">
      <div className="border-b border-border px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Changes
        </p>
      </div>

      <ol className="divide-y divide-border">
        {operations.map((op, i) => (
          <li
            key={op.id}
            className="flex items-start gap-3 px-5 py-2.5"
          >
            <span className="mt-0.5 font-mono text-xs text-muted-foreground">
              {i + 1}.
            </span>
            <p className="flex-1 text-xs text-foreground">{op.description}</p>
            <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground">
              ×{op.affectedCount.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-2 border-t border-border px-5 py-3">
        <button
          onClick={undoLastOperation}
          className="button-secondary px-3 py-1.5 text-xs min-h-0"
        >
          Undo last
        </button>

        {confirmReset ? (
          <>
            <span className="text-xs text-danger">Reset all changes?</span>
            <button
              onClick={() => {
                resetOperations();
                setConfirmReset(false);
              }}
              className="px-3 py-1.5 text-xs border border-danger text-danger hover:bg-danger/5 transition-colors min-h-0"
            >
              Yes, reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="button-secondary px-3 py-1.5 text-xs min-h-0"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="button-secondary px-3 py-1.5 text-xs min-h-0"
          >
            Reset all
          </button>
        )}
      </div>
    </div>
  );
}
