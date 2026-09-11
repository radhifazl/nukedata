"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDataset } from "@/context/DatasetContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// NewDatasetModal
// ---------------------------------------------------------------------------

interface NewDatasetModalProps {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  operationCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

function NewDatasetModal({
  datasetName,
  rowCount,
  columnCount,
  operationCount,
  onCancel,
  onConfirm,
}: NewDatasetModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Trap focus and close on Escape
  useEffect(() => {
    cancelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ndm-title"
    >
      <div className="mx-4 w-full max-w-sm border border-border bg-surface p-6 shadow-lg">
        <h2 id="ndm-title" className="text-base font-semibold text-foreground">
          Start a new dataset?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have an active workspace:
        </p>
        <div className="mt-3 rounded-sm border border-border bg-surface-elevated px-3 py-2.5 text-sm">
          <p className="truncate font-medium text-foreground" title={datasetName}>
            {datasetName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rowCount.toLocaleString()} rows · {columnCount} columns
            {operationCount > 0 && (
              <> · {operationCount} cleaning operation{operationCount !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Navigating away will replace your current workspace.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="button-secondary"
          >
            Cancel
          </button>
          <button onClick={onConfirm} className="button-primary">
            Start New Dataset
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppShellInner (needs useSearchParams)
// ---------------------------------------------------------------------------

const workspaceFeatures: { label: string; href: string; tabId: string; icon: string }[] = [
  { label: "Overview",  href: "/datasets/preview?tab=overview",  tabId: "overview",  icon: "◈" },
  { label: "Columns",   href: "/datasets/preview?tab=columns",   tabId: "columns",   icon: "⊟" },
  { label: "Data",      href: "/datasets/preview?tab=data",      tabId: "data",      icon: "⊞" },
  { label: "Issues",    href: "/datasets/preview?tab=issues",    tabId: "issues",    icon: "◇" },
  { label: "Clean",     href: "/datasets/preview?tab=clean",     tabId: "clean",     icon: "✦" },
  { label: "AI",        href: "/datasets/preview?tab=ai",        tabId: "ai",        icon: "✳" },
  { label: "Visualize", href: "/datasets/preview?tab=visualize", tabId: "visualize", icon: "∿" },
  { label: "Export",    href: "/datasets/preview?tab=export",    tabId: "export",    icon: "↓" },
];

function AppShellInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [showNewDatasetModal, setShowNewDatasetModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dataset, operations, cleanedDataset, recentDatasets } = useDataset();

  // Sync dark mode preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("nukedata:theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("nukedata:theme", next ? "dark" : "light");
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  // Called when user clicks any link that navigates to "/"
  function handleNavigateHome(e: React.MouseEvent) {
    // Only intercept when a dataset is loaded and we're NOT already on the home page
    if (dataset !== null && pathname !== "/") {
      e.preventDefault();
      setShowNewDatasetModal(true);
    }
    // Otherwise let the Link navigate normally
  }

  function confirmNewDataset() {
    setShowNewDatasetModal(false);
    closeSidebar();
    router.push("/");
  }

  const isOnPreview = pathname === "/datasets/preview";
  const currentTabId = searchParams.get("tab") ?? "overview";
  const hasDataset = dataset !== null;
  const effectiveRowCount = (cleanedDataset ?? dataset)?.rowCount;
  const hasOperations = operations.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ── New Dataset Modal ──────────────────────────────────────── */}
      {showNewDatasetModal && dataset && (
        <NewDatasetModal
          datasetName={dataset.name}
          rowCount={(cleanedDataset ?? dataset).rowCount}
          columnCount={dataset.columns.length}
          operationCount={operations.length}
          onCancel={() => setShowNewDatasetModal(false)}
          onConfirm={confirmNewDataset}
        />
      )}

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
        {/* Mobile sidebar toggle */}
        <button
          className="grid h-8 w-8 shrink-0 place-items-center border border-border text-muted-foreground hover:bg-surface-elevated hover:text-foreground lg:hidden"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle navigation"
          aria-expanded={sidebarOpen}
        >
          <span className="text-sm" aria-hidden>☰</span>
        </button>

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-[-0.025em] text-foreground hover:opacity-80"
          onClick={(e) => { handleNavigateHome(e); if (!e.defaultPrevented) closeSidebar(); }}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center bg-primary text-[0.7rem] font-bold text-primary-foreground">
            N
          </span>
          NukeData
        </Link>

        {/* Active dataset pill — shown in header on mobile */}
        {hasDataset && (
          <Link
            href="/datasets/preview?tab=overview"
            className="ml-1 hidden max-w-[180px] truncate rounded-sm border border-border bg-surface px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground sm:block lg:hidden"
            title={dataset!.name}
          >
            {dataset!.name}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Upload shortcut */}
          <Link
            href="/"
            className="hidden items-center gap-1.5 border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground sm:flex"
            onClick={(e) => { handleNavigateHome(e); if (!e.defaultPrevented) closeSidebar(); }}
          >
            ↑ Upload file
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="grid h-8 w-8 place-items-center border border-border text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span aria-hidden>{dark ? "☀" : "◐"}</span>
          </button>
        </div>
      </header>

      {/* ── Layout ────────────────────────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className={`
            ${sidebarOpen ? "block" : "hidden"}
            fixed inset-x-0 bottom-0 top-14 z-20 overflow-y-auto
            border-r border-border bg-surface
            lg:static lg:block lg:min-h-[calc(100vh-3.5rem)]
          `}
        >
          <nav className="flex flex-col gap-6 px-3 py-5" aria-label="Workspace navigation">

            {/* ── Upload ──────────────────────────────────────────────── */}
            <div>
              <SidebarSection label="Get started" />
              <SidebarLink
                href="/"
                active={pathname === "/"}
                icon="↑"
                onClick={(e) => { handleNavigateHome(e); if (!e.defaultPrevented) closeSidebar(); }}
              >
                Upload a file
              </SidebarLink>
            </div>

            {/* ── Active workspace ────────────────────────────────────── */}
            <div>
              <SidebarSection label="Workspace" />
              {hasDataset ? (
                <>
                  {/* Dataset card */}
                  <div className="mb-2 rounded-sm border border-border bg-surface-elevated px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-px shrink-0 rounded-sm bg-primary/10 px-1 py-0.5 font-mono text-[0.6rem] font-medium text-primary">
                        {fileExt(dataset!.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground" title={dataset!.name}>
                          {dataset!.name}
                        </p>
                        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                          {effectiveRowCount?.toLocaleString()} rows
                          {" · "}
                          {dataset!.columns.length} cols
                          {hasOperations && (
                            <span className="ml-1 text-success">· cleaned</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feature links */}
                  {workspaceFeatures.map((f) => {
                    const isActive =
                      isOnPreview &&
                      (currentTabId === f.tabId ||
                        // treat absent/invalid tab as "overview"
                        (f.tabId === "overview" && !["columns","data","issues","clean","ai","visualize","export"].includes(currentTabId)));
                    return (
                      <SidebarLink
                        key={f.label}
                        href={f.href}
                        active={isActive}
                        icon={f.icon}
                        onClick={closeSidebar}
                        indent
                      >
                        {f.label}
                      </SidebarLink>
                    );
                  })}
                </>
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No dataset loaded.{" "}
                  <Link href="/" className="text-primary hover:underline" onClick={closeSidebar}>
                    Upload a file
                  </Link>{" "}
                  to get started.
                </p>
              )}
            </div>

            {/* ── Recent datasets ─────────────────────────────────────── */}
            {recentDatasets.length > 0 && (
              <div>
                <SidebarSection label="Recent" />
                <div className="space-y-px">
                  {recentDatasets.map((entry) => {
                    // If this entry is the currently loaded dataset, link to preview.
                    // Otherwise link to home (user needs to re-upload).
                    const isCurrent = dataset?.name === entry.name;
                    const href = isCurrent ? "/datasets/preview?tab=overview" : "/";
                    const title = isCurrent
                      ? entry.name
                      : `${entry.name} — re-upload to reload`;

                    return (
                      <Link
                        key={`${entry.name}-${entry.loadedAt}`}
                        href={href}
                        title={title}
                        onClick={closeSidebar}
                        className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${
                          isCurrent
                            ? "bg-primary/5 text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className="shrink-0 rounded-sm bg-border px-1 py-0.5 font-mono text-[0.6rem] uppercase text-muted-foreground">
                          {fileExt(entry.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                        <span className="shrink-0 text-[0.6rem] text-muted-foreground/70">
                          {relativeTime(entry.loadedAt)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── About / links ───────────────────────────────────────── */}
            <div className="mt-auto border-t border-border pt-4">
              <div className="flex items-center justify-between px-3">
                <span className="text-[0.65rem] text-muted-foreground">NukeData</span>
                <a
                  href="#how-it-works"
                  className="text-[0.65rem] text-muted-foreground hover:text-foreground"
                  onClick={closeSidebar}
                >
                  How it works
                </a>
              </div>
            </div>

          </nav>
        </aside>

        {/* ── Overlay (mobile) ────────────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-10 bg-background/60 backdrop-blur-sm lg:hidden"
            onClick={closeSidebar}
            aria-hidden
          />
        )}

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="min-w-0">
          {children}
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppShell — wraps inner with Suspense for useSearchParams
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SidebarSection({ label }: { label: string }) {
  return (
    <p className="mb-1 px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </p>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  indent,
  onClick,
  children,
}: {
  href: string;
  active: boolean;
  icon?: string;
  indent?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-sm px-3 py-1.5 text-sm transition-colors ${
        indent ? "pl-4" : ""
      } ${
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon && (
        <span className="shrink-0 w-4 text-center font-mono text-xs text-muted-foreground" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}
