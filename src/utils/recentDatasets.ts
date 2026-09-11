/**
 * Lightweight recent-datasets list, persisted in localStorage.
 * Only metadata is stored — no raw rows, no sensitive data.
 */

export interface RecentDatasetEntry {
  /** Original filename */
  name: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  /** ISO timestamp of when the dataset was loaded */
  loadedAt: string;
}

const STORAGE_KEY = "nukedata:recent";
const MAX_ENTRIES = 8;

function read(): RecentDatasetEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: RecentDatasetEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

/**
 * Reads the recent datasets list from localStorage.
 */
export function getRecentDatasets(): RecentDatasetEntry[] {
  return read();
}

/**
 * Adds (or bumps to front) an entry in the recent datasets list.
 * Deduplicates by filename — same name replaces the existing entry.
 */
export function pushRecentDataset(entry: RecentDatasetEntry): void {
  const existing = read().filter((e) => e.name !== entry.name);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  write(next);
}

/**
 * Clears all recent datasets from localStorage.
 */
export function clearRecentDatasets(): void {
  write([]);
}
