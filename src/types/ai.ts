import type { CleaningOperationType } from "@/types/cleaning";

// ---------------------------------------------------------------------------
// Payload sent to the AI (server-side only; never contains raw rows)
// ---------------------------------------------------------------------------

export interface AiColumnPayload {
  name: string;
  type: string;
  missing: number;
  unique: number;
  uniqueRatio: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  earliest?: string;
  latest?: string;
  inconsistentGroupCount?: number;
}

export interface AiIssuePayload {
  id: string;
  type: string;
  severity: string;
  column?: string;
  count: number;
  description: string;
}

/** The complete payload sent to the AI endpoint — profile only, no raw rows. */
export interface AiAnalysisPayload {
  rowCount: number;
  columnCount: number;
  qualityScore: number;
  duplicateRowCount: number;
  incompleteRowCount: number;
  columns: AiColumnPayload[];
  issues: AiIssuePayload[];
}

// ---------------------------------------------------------------------------
// AI response types
// ---------------------------------------------------------------------------

/** A high-level observation about the dataset. */
export interface AiInsight {
  title: string;
  description: string;
}

/**
 * A cleaning suggestion returned by the AI.
 * `operationType` must map to an existing `CleaningOperationType` or be null
 * (meaning the AI identified an issue but couldn't map it to a supported operation).
 */
export interface AiSuggestion {
  /** Stable id generated client-side from index */
  id: string;
  column?: string;
  issueType?: string;
  title: string;
  reason: string;
  operationType: CleaningOperationType | null;
  /** Strategy hint for the operation (e.g. "lowercase", "mean", "first") */
  strategy?: string;
  confidence: number;
  /** Whether the user has dismissed this suggestion */
  dismissed?: boolean;
}

/** The complete parsed result of an AI analysis. */
export interface AiAnalysisResult {
  insights: AiInsight[];
  suggestions: AiSuggestion[];
}

/**
 * A cached AI analysis result, associated with the dataset fingerprint that
 * was current when the analysis was generated.
 */
export interface CachedAiAnalysis {
  /** Fingerprint of the dataset+operations state when this analysis was run. */
  datasetFingerprint: string;
  /** ISO timestamp — for display only; validity is determined by fingerprint. */
  generatedAt: string;
  result: AiAnalysisResult;
}

// ---------------------------------------------------------------------------
// State types used in AiTab
// ---------------------------------------------------------------------------

export type AiStatus =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success" }
  | { phase: "error"; message: string };
