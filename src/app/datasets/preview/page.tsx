"use client";
import Link from "next/link";
import { useDataset } from "@/context/DatasetContext";
import { WorkspaceTabs } from "@/components/workspace/WorkspaceTabs";
import { AppShell } from "@/components/app-shell";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024)
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scoreStatus(score: number): { text: string; colour: string } {
  if (score >= 90) return { text: "Good quality", colour: "text-success" };
  if (score >= 70) return { text: "Acceptable quality", colour: "text-warning" };
  return { text: "Needs attention", colour: "text-danger" };
}

export default function DatasetPreviewPage() {
  const { dataset, profile, operations, cleanedProfile } = useDataset();

  if (!dataset || !profile) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:px-12 lg:pt-20">
          <div className="border border-border bg-surface px-8 py-16 text-center">
            <p className="text-base font-medium text-foreground">
              No dataset loaded
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a CSV file to get started.
            </p>
            <Link href="/" className="button-primary mt-6 inline-flex">
              ← Upload a file
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const colCount = dataset.columns.length;
  const { text: statusText, colour: statusColour } = scoreStatus(
    profile.qualityScore
  );

  const hasCleanedScore = operations.length > 0 && cleanedProfile !== null;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 lg:px-12">
        {/* ── Compact header ───────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              ← Upload another file
            </Link>
            <h1 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              {dataset.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {dataset.rowCount.toLocaleString()} row
              {dataset.rowCount !== 1 ? "s" : ""}{" "}
              <span aria-hidden>·</span>{" "}
              {colCount} column{colCount !== 1 ? "s" : ""}{" "}
              <span aria-hidden>·</span> {formatSize(dataset.fileSize)}
            </p>
          </div>

          <div className="text-right">
            {hasCleanedScore ? (
              <div className="flex items-center gap-3">
                <div>
                  <p className={`font-mono text-base tabular-nums text-muted-foreground line-through`}>
                    {profile.qualityScore}
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">Original</p>
                </div>
                <span className="text-muted-foreground" aria-hidden>→</span>
                <div>
                  <p className={`font-mono text-xl font-semibold tabular-nums text-success`}>
                    {cleanedProfile!.qualityScore}
                    <span className="text-sm font-normal text-muted-foreground"> / 100</span>
                  </p>
                  <p className="text-xs font-medium text-success">Cleaned</p>
                </div>
              </div>
            ) : (
              <>
                <p className={`font-mono text-xl font-semibold tabular-nums ${statusColour}`}>
                  {profile.qualityScore}
                  <span className="text-sm font-normal text-muted-foreground"> / 100</span>
                </p>
                <p className={`text-xs font-medium ${statusColour}`}>{statusText}</p>
              </>
            )}
          </div>
        </div>

        {/* ── Workspace tabs ───────────────────────────────────────── */}
        <WorkspaceTabs dataset={dataset} profile={profile} />
      </main>
    </AppShell>
  );
}
