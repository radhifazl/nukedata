"use client";
import { createContext, useContext, useState, useMemo, useEffect } from "react";
import type { Dataset } from "@/types/dataset";
import type { DatasetProfile } from "@/types/profile";
import type { CleaningOperation } from "@/types/cleaning";
import { cleanDataset } from "@/utils/cleaning/cleanDataset";
import { profileDataset } from "@/utils/csv/profileDataset";
import {
  type RecentDatasetEntry,
  getRecentDatasets,
  pushRecentDataset,
} from "@/utils/recentDatasets";

const SESSION_KEY = "nukedata:workspace";

interface PersistedWorkspace {
  dataset: Dataset;
  operations: CleaningOperation[];
  savedAt: string;
}

interface DatasetContextValue {
  dataset: Dataset | null;
  profile: DatasetProfile | null;
  setDataset: (dataset: Dataset | null, profile: DatasetProfile | null) => void;
  // Cleaning
  operations: CleaningOperation[];
  cleanedDataset: Dataset | null;
  cleanedProfile: DatasetProfile | null;
  addOperation: (op: CleaningOperation) => void;
  undoLastOperation: () => void;
  resetOperations: () => void;
  // Recent datasets (metadata only — no raw rows)
  recentDatasets: RecentDatasetEntry[];
}

const DatasetContext = createContext<DatasetContextValue | null>(null);

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDatasetState] = useState<Dataset | null>(null);
  const [profile, setProfileState] = useState<DatasetProfile | null>(null);
  const [operations, setOperations] = useState<CleaningOperation[]>([]);
  const [recentDatasets, setRecentDatasets] = useState<RecentDatasetEntry[]>([]);

  // Hydrate recent datasets from localStorage after mount
  useEffect(() => {
    setRecentDatasets(getRecentDatasets());
  }, []);

  // Restore workspace from sessionStorage on mount (best-effort)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed: PersistedWorkspace = JSON.parse(raw);
      if (
        parsed &&
        parsed.dataset &&
        typeof parsed.dataset.name === "string" &&
        Array.isArray(parsed.dataset.rows) &&
        Array.isArray(parsed.operations)
      ) {
        const restoredProfile = profileDataset(parsed.dataset);
        setDatasetState(parsed.dataset);
        setProfileState(restoredProfile);
        setOperations(parsed.operations);
      }
    } catch {
      // Corrupt or unavailable sessionStorage — silently ignore
    }
  }, []);

  // Persist workspace to sessionStorage whenever dataset or operations change
  useEffect(() => {
    if (!dataset) return;
    try {
      const workspace: PersistedWorkspace = {
        dataset,
        operations,
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(workspace));
    } catch {
      // Storage quota exceeded or unavailable — silently ignore
    }
  }, [dataset, operations]);

  function setDataset(
    nextDataset: Dataset | null,
    nextProfile: DatasetProfile | null
  ) {
    // Clear old workspace from sessionStorage before loading the new one
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }

    setDatasetState(nextDataset);
    setProfileState(nextProfile);
    setOperations([]);

    // Persist metadata to recent list
    if (nextDataset && nextProfile) {
      const entry: RecentDatasetEntry = {
        name: nextDataset.name,
        fileSize: nextDataset.fileSize,
        rowCount: nextDataset.rowCount,
        columnCount: nextDataset.columns.length,
        loadedAt: new Date().toISOString(),
      };
      pushRecentDataset(entry);
      setRecentDatasets(getRecentDatasets());
    }
  }

  const cleanedDataset = useMemo<Dataset | null>(() => {
    if (!dataset) return null;
    if (operations.length === 0) return null;
    return cleanDataset(dataset, operations);
  }, [dataset, operations]);

  const cleanedProfile = useMemo<DatasetProfile | null>(() => {
    if (!cleanedDataset) return null;
    return profileDataset(cleanedDataset);
  }, [cleanedDataset]);

  function addOperation(op: CleaningOperation) {
    setOperations((prev) => [...prev, op]);
  }

  function undoLastOperation() {
    setOperations((prev) => prev.slice(0, -1));
  }

  function resetOperations() {
    setOperations([]);
  }

  return (
    <DatasetContext.Provider
      value={{
        dataset,
        profile,
        setDataset,
        operations,
        cleanedDataset,
        cleanedProfile,
        addOperation,
        undoLastOperation,
        resetOperations,
        recentDatasets,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext);
  if (!ctx) {
    throw new Error("useDataset must be used inside DatasetProvider");
  }
  return ctx;
}
