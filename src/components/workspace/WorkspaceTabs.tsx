"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Dataset } from "@/types/dataset";
import type { DatasetProfile, DataIssueType } from "@/types/profile";
import { useDataset } from "@/context/DatasetContext";
import { OverviewTab } from "./OverviewTab";
import { ColumnsTab } from "./ColumnsTab";
import { DataTab } from "./DataTab";
import { IssuesTab } from "./IssuesTab";
import { CleanTab } from "./CleanTab";
import { AiTab } from "./AiTab";
import { VizTab } from "./VizTab";
import { ExportTab } from "./ExportTab";

export type TabId = "overview" | "columns" | "data" | "issues" | "clean" | "ai" | "visualize" | "export";

const VALID_TABS = new Set<TabId>(["overview", "columns", "data", "issues", "clean", "ai", "visualize", "export"]);

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "columns", label: "Columns" },
  { id: "data", label: "Data" },
  { id: "issues", label: "Issues" },
  { id: "clean", label: "Clean" },
  { id: "ai", label: "AI" },
  { id: "visualize", label: "Visualize" },
  { id: "export", label: "Export" },
];

interface WorkspaceTabsProps {
  dataset: Dataset;
  profile: DatasetProfile;
}

function WorkspaceTabsInner({ dataset, profile }: WorkspaceTabsProps) {
  // Always use the effective (cleaned) profile when operations have been applied.
  // This is the single fix that ensures every tab sees the current issue state.
  const { cleanedProfile, cleanedDataset } = useDataset();
  const effectiveProfile = cleanedProfile ?? profile;
  const effectiveDataset = cleanedDataset ?? dataset;

  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab") as TabId | null;
  const activeTab: TabId = rawTab && VALID_TABS.has(rawTab) ? rawTab : "overview";

  // Ephemeral cross-tab coordination signals — not URL state
  const [focusedColumn, setFocusedColumn] = useState<string | null>(null);
  const [dataRowFilter, setDataRowFilter] = useState<"all" | DataIssueType>("all");
  const [cleanIssueId, setCleanIssueId] = useState<string | null>(null);

  function navigateToTab(tabId: TabId) {
    router.push(`/datasets/preview?tab=${tabId}`, { scroll: false });
  }

  function focusIssue(issueType: DataIssueType, column?: string) {
    setDataRowFilter(issueType);
    if (column) setFocusedColumn(column);
    navigateToTab("data");
  }

  function openCleanForIssue(issueId: string) {
    setCleanIssueId(issueId);
    navigateToTab("clean");
  }

  function focusColumn(name: string) {
    setFocusedColumn(name);
    navigateToTab("columns");
  }

  const totalMissing = effectiveProfile.columns.reduce((s, c) => s + c.missingCount, 0);

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateToTab(tab.id)}
            className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-foreground after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.label}
            {tab.id === "issues" && effectiveProfile.issues.length > 0 && (
              <span className="ml-1.5 rounded-sm bg-warning/15 px-1 py-0.5 font-mono text-[0.65rem] font-medium text-warning">
                {effectiveProfile.issues.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="mt-6">
        {activeTab === "overview" && (
          <OverviewTab
            profile={effectiveProfile}
            totalMissing={totalMissing}
            onFocusIssue={focusIssue}
            onFocusColumn={focusColumn}
            onOpenClean={openCleanForIssue}
          />
        )}
        {activeTab === "columns" && (
          <ColumnsTab
            profile={effectiveProfile}
            focusedColumn={focusedColumn}
            onFocusColumn={setFocusedColumn}
          />
        )}
        {activeTab === "data" && (
          <DataTab
            dataset={effectiveDataset}
            profile={effectiveProfile}
            focusedColumn={focusedColumn}
            rowFilter={dataRowFilter}
            onRowFilterChange={setDataRowFilter}
            onFocusColumn={setFocusedColumn}
          />
        )}
        {activeTab === "issues" && (
          <IssuesTab
            profile={effectiveProfile}
            onFocusIssue={focusIssue}
            onOpenClean={openCleanForIssue}
          />
        )}
        {activeTab === "clean" && (
          <CleanTab
            profile={effectiveProfile}
            initialIssueId={cleanIssueId}
          />
        )}
        {activeTab === "ai" && (
          <AiTab profile={effectiveProfile} />
        )}
        {activeTab === "visualize" && (
          <VizTab profile={effectiveProfile} />
        )}
        {activeTab === "export" && (
          <ExportTab />
        )}
      </div>
    </div>
  );
}

export function WorkspaceTabs({ dataset, profile }: WorkspaceTabsProps) {
  return (
    <Suspense fallback={null}>
      <WorkspaceTabsInner dataset={dataset} profile={profile} />
    </Suspense>
  );
}
