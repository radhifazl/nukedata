"use client";

import { useRef } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CsvUpload, type UploadHandle } from "@/components/csv-upload";
import { useDataset } from "@/context/DatasetContext";

const rows = [
  ["John Doe", "john@email.com", "Indonesia", ""],
  ["Jane Doe", "jane@email.com", "indonesia", "capitalization"],
  ["John Doe", "john@email.com", "Indonesia", "duplicate"],
  ["Alex", "—", "INDONESIA", "missing"],
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fileExt(name: string): string {
  return (name.split(".").pop() ?? "file").toUpperCase();
}

function RecentDatasetsList() {
  const { recentDatasets, dataset } = useDataset();

  if (recentDatasets.length === 0) return null;

  const shown = recentDatasets.slice(0, 5);

  return (
    <section className="mt-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Recent datasets
      </p>
      <div className="space-y-1">
        {shown.map((entry) => {
          const isCurrent = dataset?.name === entry.name;
          const href = isCurrent ? "/datasets/preview?tab=overview" : null;

          const inner = (
            <div className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-elevated">
              <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium text-primary">
                {fileExt(entry.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={entry.name}>
                  {entry.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.rowCount.toLocaleString()} rows · {entry.columnCount} columns · {formatSize(entry.fileSize)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{relativeTime(entry.loadedAt)}</p>
                {!isCurrent && (
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground/60">Re-upload to restore</p>
                )}
              </div>
            </div>
          );

          return href ? (
            <Link key={`${entry.name}-${entry.loadedAt}`} href={href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={`${entry.name}-${entry.loadedAt}`} className="cursor-default opacity-70">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const uploadRef = useRef<UploadHandle>(null);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:px-12 lg:pt-20">
        <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(420px,1fr)] lg:gap-16">
          <div className="max-w-xl">
            <p className="mb-5 text-sm font-medium text-primary">
              A clearer starting point for your data
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
              Clean your data. Understand it better.
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              Upload a CSV or Excel dataset, find hidden data-quality issues,
              clean messy values, and get your data ready for analysis.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                className="button-primary"
                onClick={() => uploadRef.current?.openFilePicker()}
              >
                Upload file <span aria-hidden>→</span>
              </button>
              <a className="button-secondary" href="#how-it-works">
                See how it works
              </a>
            </div>
          </div>
          <div id="upload" className="scroll-mt-8">
            <CsvUpload ref={uploadRef} />
            <RecentDatasetsList />
          </div>
        </section>
        <section
          id="how-it-works"
          className="scroll-mt-8 border-t border-border pt-16 sm:pt-24"
        >
          <div className="max-w-xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              A calmer path from raw data to clarity.
            </h2>
            <p className="mt-4 text-muted-foreground">
              The workspace is being built around the small decisions that make
              datasets dependable.
            </p>
          </div>
          <div className="mt-10 grid gap-7 sm:grid-cols-3 sm:gap-5">
            {[
              [
                "01",
                "Upload",
                "Drop your CSV or Excel dataset into the workspace.",
              ],
              [
                "02",
                "Clean",
                "Review detected data-quality issues and decide what to fix.",
              ],
              [
                "03",
                "Analyze",
                "Explore your cleaned dataset and uncover useful patterns.",
              ],
            ].map(([number, title, description]) => (
              <article key={number} className="border-t border-border pt-4">
                <p className="font-mono text-xs text-primary">{number} —</p>
                <h3 className="mt-4 text-lg font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-20 grid gap-10 border-t border-border pt-16 sm:mt-28 sm:pt-24 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <p className="eyebrow">See the signal</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
              Messy data is rarely obvious at first glance.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              NukeData will make duplicates, missing fields, and inconsistent
              values easy to spot before they travel further into your work.
            </p>
          </div>
          <div className="overflow-hidden border border-border bg-surface shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="h-2 w-2 rounded-full bg-primary" />
                customers.csv
              </div>
              <span className="text-xs text-muted-foreground">4 rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-surface-elevated text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">customer</th>
                    <th className="px-4 py-3">email</th>
                    <th className="px-4 py-3">country</th>
                    <th className="px-4 py-3">status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([customer, email, country, issue], index) => (
                    <tr
                      key={`${customer}-${index}`}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-3 text-foreground">{customer}</td>
                      <td
                        className={`px-4 py-3 ${issue === "missing" ? "font-medium text-danger" : "text-muted-foreground"}`}
                      >
                        {email}
                      </td>
                      <td
                        className={`px-4 py-3 ${issue === "capitalization" ? "font-medium text-warning" : "text-muted-foreground"}`}
                      >
                        {country}
                      </td>
                      <td className="px-4 py-3">
                        {issue === "duplicate" && (
                          <span className="issue-badge issue-danger">
                            Duplicate
                          </span>
                        )}
                        {issue === "missing" && (
                          <span className="issue-badge issue-danger">
                            Missing
                          </span>
                        )}
                        {issue === "capitalization" && (
                          <span className="issue-badge issue-warning">
                            Case
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
