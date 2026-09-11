"use client";
import { useState, useRef, useCallback, useMemo } from "react";
import type { DatasetProfile } from "@/types/profile";
import type {
  AiAnalysisResult,
  AiStatus,
  AiSuggestion,
  CachedAiAnalysis,
} from "@/types/ai";
import { buildAiPayload } from "@/utils/ai/buildPayload";
import { mapSuggestionToOperation } from "@/utils/ai/mapSuggestion";
import { computeFingerprint } from "@/utils/ai/fingerprint";
import { useDataset } from "@/context/DatasetContext";

interface AiTabProps {
  /** The effective profile — should be cleanedProfile ?? profile from context. */
  profile: DatasetProfile;
}

export function AiTab({ profile }: AiTabProps) {
  const { dataset, operations, addOperation, cleanedProfile } = useDataset();

  // ── Opt-in state ──────────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  // ── Cached analysis: only updated on successful request ──────────────────
  const [cached, setCached] = useState<CachedAiAnalysis | null>(null);

  // ── Per-suggestion dismiss state (local to this analysis) ─────────────────
  // Keys are suggestion ids; value = true means dismissed.
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  // ── Request status ────────────────────────────────────────────────────────
  const [status, setStatus] = useState<AiStatus>({ phase: "idle" });

  // ── In-flight guard: holds the fingerprint of the in-progress request ─────
  const inFlightFingerprintRef = useRef<string | null>(null);

  // ── Current dataset fingerprint ───────────────────────────────────────────
  const currentFingerprint = useMemo(
    () => (dataset ? computeFingerprint(dataset, operations) : ""),
    [dataset, operations]
  );

  // ── Effective profile for mapping suggestions ─────────────────────────────
  // Use the cleaned profile if operations exist, otherwise the original.
  const effectiveProfile = cleanedProfile ?? profile;

  // ── Is the cached analysis still valid for the current dataset state? ─────
  const isStale =
    cached !== null && cached.datasetFingerprint !== currentFingerprint;

  // ── Suggestions from cache, with dismiss overlay applied ──────────────────
  const allSuggestions: AiSuggestion[] = useMemo(() => {
    if (!cached) return [];
    return cached.result.suggestions.map((s) => ({
      ...s,
      dismissed: dismissed[s.id] ?? false,
    }));
  }, [cached, dismissed]);

  const activeSuggestions = allSuggestions.filter((s) => !s.dismissed);
  const dismissedCount = allSuggestions.filter((s) => s.dismissed).length;
  const insights = cached?.result.insights ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleToggle() {
    if (enabled) {
      setEnabled(false);
      // Do NOT clear cached analysis or affect dataset/operations.
      // Just hide the AI panel. The cache remains for when they re-enable.
    } else {
      setShowPrivacyNotice(true);
    }
  }

  function confirmEnable() {
    setEnabled(true);
    setShowPrivacyNotice(false);
  }

  const runAnalysis = useCallback(async () => {
    if (!enabled || !dataset) return;
    // Guard: do not start another request while one is in flight
    if (status.phase === "loading") return;

    const fingerprintAtStart = currentFingerprint;

    // Guard: if the cache is already valid for this fingerprint, skip
    if (cached && cached.datasetFingerprint === fingerprintAtStart) return;

    inFlightFingerprintRef.current = fingerprintAtStart;
    setStatus({ phase: "loading" });

    try {
      const payload = buildAiPayload(effectiveProfile);
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // ── Race condition guard ──────────────────────────────────────────────
      // If the fingerprint changed while the request was in-flight, discard
      // the result — it belongs to an old dataset state.
      if (inFlightFingerprintRef.current !== fingerprintAtStart) {
        // Dataset changed mid-flight; do not update state
        inFlightFingerprintRef.current = null;
        setStatus({ phase: "idle" });
        return;
      }
      inFlightFingerprintRef.current = null;

      if (!res.ok) {
        const msg: string =
          data?.error ?? `Unexpected error (${res.status}). Please try again.`;
        setStatus({ phase: "error", message: msg });
        return;
      }

      const result = data as AiAnalysisResult;

      // Store in cache with the fingerprint that was current at request time
      setCached({
        datasetFingerprint: fingerprintAtStart,
        generatedAt: new Date().toISOString(),
        result,
      });
      // Reset dismiss state for the new analysis
      setDismissed({});
      setStatus({ phase: "success" });
    } catch {
      inFlightFingerprintRef.current = null;
      setStatus({
        phase: "error",
        message:
          "Could not reach the AI service. Check your connection and try again.",
      });
    }
  }, [enabled, dataset, status.phase, currentFingerprint, cached, effectiveProfile]);

  function dismissSuggestion(id: string) {
    // Local dismiss only — no API call, no dataset change
    setDismissed((prev) => ({ ...prev, [id]: true }));
  }

  function applySuggestion(suggestion: AiSuggestion) {
    // Guard: stale suggestions must not be applied
    if (isStale) return;
    if (!cached || cached.datasetFingerprint !== currentFingerprint) return;

    // Map the AI suggestion to a CleaningOperation using the effective profile
    const op = mapSuggestionToOperation(suggestion, effectiveProfile);
    if (!op) return;

    // Apply via the existing cleaning engine (addOperation → useMemo recomputes
    // cleanedDataset → profileDataset recomputes cleanedProfile automatically).
    addOperation(op);

    // Dismiss the suggestion locally now that it has been applied.
    // The analysis will become stale (fingerprint will change) after this call
    // because operations array changed.
    dismissSuggestion(suggestion.id);
  }

  // ── Privacy notice ────────────────────────────────────────────────────────
  if (showPrivacyNotice) {
    return (
      <div className="border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-foreground">
            Enable AI Analysis?
          </p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-foreground">
            AI analysis sends your <strong>dataset profile</strong> — column
            names, statistics, and detected issues — to{" "}
            <strong>Google Gemini</strong> for analysis.
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              ✓ Raw dataset rows are{" "}
              <strong className="text-foreground">not</strong> sent
            </li>
            <li>
              ✓ Individual cell values are{" "}
              <strong className="text-foreground">not</strong> sent
            </li>
            <li>✓ Only statistical summaries and issue metadata are sent</li>
            <li>⚠ Column names and aggregate statistics will leave your device</li>
            <li>⚠ Google Gemini's privacy policy applies to submitted data</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            If your dataset contains sensitive or confidential information,
            review what is included in the payload before enabling this feature.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowPrivacyNotice(false)}
              className="button-secondary"
            >
              Cancel
            </button>
            <button onClick={confirmEnable} className="button-primary">
              Enable AI Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Disabled state ────────────────────────────────────────────────────────
  if (!enabled) {
    return (
      <div className="border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">AI Analysis</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Powered by Google Gemini · Disabled by default
            </p>
          </div>
          <ToggleButton enabled={false} onToggle={handleToggle} />
        </div>
        <div className="space-y-2 px-5 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            AI analysis is{" "}
            <strong className="text-foreground">disabled</strong>. Your dataset
            will not be sent to any external service.
          </p>
          <p className="text-xs text-muted-foreground">
            All profiling, issue detection, and cleaning features work entirely
            without AI.
          </p>
          <div className="pt-3">
            <button onClick={handleToggle} className="button-secondary text-sm">
              Enable AI Analysis →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Enabled state ─────────────────────────────────────────────────────────
  const hasAnalysis = cached !== null;
  const isLoading = status.phase === "loading";
  const isIdle = status.phase === "idle";
  const isError = status.phase === "error";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">AI Analysis</p>
          <p className="mt-0.5 text-xs text-warning">
            ⚠ Dataset profile information may be sent to Google Gemini
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLoading ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary"
                aria-hidden
              />
              Analyzing…
            </span>
          ) : !hasAnalysis || isIdle || isError ? (
            <button
              onClick={runAnalysis}
              disabled={isLoading}
              className="button-primary"
            >
              Analyze Dataset
            </button>
          ) : (
            <button
              onClick={() => {
                // Force re-analysis: clear the cache so runAnalysis won't skip
                setCached(null);
                setDismissed({});
                setStatus({ phase: "idle" });
              }}
              className="button-secondary text-xs"
            >
              Re-analyze
            </button>
          )}
          <ToggleButton enabled={true} onToggle={handleToggle} />
        </div>
      </div>

      {/* Error state */}
      {isError && status.phase === "error" && (
        <div className="border border-danger/30 bg-danger/5 px-5 py-4">
          <p className="text-sm font-medium text-danger">Analysis failed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {status.message}
          </p>
          <button
            onClick={runAnalysis}
            className="mt-3 border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-elevated"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="border border-border bg-surface px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Analyzing your dataset with Google Gemini…
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This may take up to 30 seconds.
          </p>
        </div>
      )}

      {/* No analysis yet */}
      {!isLoading && !hasAnalysis && !isError && (
        <div className="border border-border bg-surface px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            AI analysis hasn&apos;t been run yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click <strong>Analyze Dataset</strong> to generate insights and
            cleaning suggestions.
          </p>
        </div>
      )}

      {/* Stale banner */}
      {hasAnalysis && isStale && (
        <div className="flex items-center justify-between border border-warning/40 bg-warning/5 px-5 py-3">
          <p className="text-xs text-warning">
            Dataset changed since this analysis was generated.
            Suggestions from this analysis cannot be applied.
          </p>
          <button
            onClick={() => {
              setCached(null);
              setDismissed({});
              setStatus({ phase: "idle" });
            }}
            className="ml-4 shrink-0 border border-warning/40 px-3 py-1 text-xs text-warning hover:bg-warning/10"
          >
            Re-analyze
          </button>
        </div>
      )}

      {/* Results */}
      {hasAnalysis && !isLoading && (
        <>
          {/* Insights */}
          {insights.length > 0 && (
            <section>
              <h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
                AI Insights
              </h3>
              <div className="divide-y divide-border border border-border bg-surface">
                {insights.map((insight, i) => (
                  <div key={i} className="px-5 py-4">
                    <p className="text-sm font-medium text-foreground">
                      {insight.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Suggestions */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
                Suggested improvements
                {activeSuggestions.length > 0 && (
                  <span className="ml-2 rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[0.65rem] text-primary">
                    {activeSuggestions.length}
                  </span>
                )}
              </h3>
              {dismissedCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {dismissedCount} dismissed
                </span>
              )}
            </div>

            {activeSuggestions.length === 0 ? (
              <div className="border border-border bg-surface px-5 py-6 text-center text-sm text-muted-foreground">
                {dismissedCount > 0
                  ? "All suggestions have been dismissed or applied."
                  : "No applicable cleaning suggestions were generated."}
              </div>
            ) : (
              <div className="divide-y divide-border border border-border bg-surface">
                {activeSuggestions.map((suggestion) => (
                  <SuggestionRow
                    key={suggestion.id}
                    suggestion={suggestion}
                    profile={effectiveProfile}
                    isStale={isStale}
                    onApply={applySuggestion}
                    onDismiss={dismissSuggestion}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Footer */}
          <p className="text-xs text-muted-foreground">
            AI suggestions are generated automatically and may not always be
            appropriate for your data. Review each suggestion before applying.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToggleButton({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border transition-colors ${
        enabled
          ? "border-primary bg-primary"
          : "border-border bg-surface-elevated"
      }`}
      aria-label={enabled ? "Disable AI analysis" : "Enable AI analysis"}
    >
      <span
        className={`inline-block h-4 w-4 transform bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SuggestionRow({
  suggestion,
  profile,
  isStale,
  onApply,
  onDismiss,
}: {
  suggestion: AiSuggestion;
  profile: DatasetProfile;
  isStale: boolean;
  onApply: (s: AiSuggestion) => void;
  onDismiss: (id: string) => void;
}) {
  // Validate the suggestion against the effective profile before showing Apply
  const op = useMemo(
    () => mapSuggestionToOperation(suggestion, profile),
    [suggestion, profile]
  );

  const canApply = op !== null && !isStale;

  const applyBlockReason = isStale
    ? "Dataset changed — re-analyze before applying"
    : op === null
    ? "Cannot be automatically applied"
    : null;

  const confidencePct = Math.round(suggestion.confidence * 100);
  const confidenceColour =
    suggestion.confidence >= 0.85
      ? "text-success"
      : suggestion.confidence >= 0.6
      ? "text-warning"
      : "text-muted-foreground";

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {suggestion.title}
            </p>
            {suggestion.column && (
              <code className="border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                {suggestion.column}
              </code>
            )}
            <span className={`font-mono text-xs ${confidenceColour}`}>
              {confidencePct}% confidence
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {suggestion.reason}
          </p>
          {op && (
            <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
              Operation:{" "}
              <span className="text-foreground">{op.type}</span>
              {suggestion.strategy && (
                <>
                  {" · "}strategy:{" "}
                  <span className="text-foreground">{suggestion.strategy}</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex gap-2">
            {canApply ? (
              <button
                onClick={() => onApply(suggestion)}
                className="border border-primary bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
              >
                Apply
              </button>
            ) : (
              <span
                className="self-center px-1 text-xs text-muted-foreground"
                title={applyBlockReason ?? undefined}
              >
                {isStale ? "Stale" : "Manual fix needed"}
              </span>
            )}
            <button
              onClick={() => onDismiss(suggestion.id)}
              className="border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated"
            >
              Dismiss
            </button>
          </div>
          {applyBlockReason && !isStale && (
            <p className="text-[0.65rem] text-muted-foreground">
              {applyBlockReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
