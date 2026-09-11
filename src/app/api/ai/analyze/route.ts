import { NextResponse } from "next/server";
import type {
  AiAnalysisPayload,
  AiAnalysisResult,
  AiInsight,
  AiSuggestion,
} from "@/types/ai";
import type { CleaningOperationType } from "@/types/cleaning";

// ---------------------------------------------------------------------------
// This route runs server-side only.
// GEMINI_API_KEY and GEMINI_MODEL are read from process.env — never sent to
// the browser.
// ---------------------------------------------------------------------------
export const dynamic = "force-dynamic";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Model resolution
//
// Priority:
//   1. GEMINI_MODEL env var (if set, use it directly after validating it
//      supports generateContent).
//   2. Auto-discover: list models from the API, pick the best available Flash
//      model that supports generateContent.
//
// The resolved model is cached at module scope so model listing happens at
// most once per server process (not once per request).
// ---------------------------------------------------------------------------

/**
 * Ordered list of Flash model IDs to prefer when auto-discovering.
 * These are matched against the short name returned by the listing API
 * (e.g. "gemini-2.5-flash-preview-04-17" matches "gemini-2.5-flash").
 */
const PREFERRED_FLASH_PREFIXES = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash", // kept as last-resort fallback
];

interface GeminiModel {
  name: string; // e.g. "models/gemini-2.5-flash-preview-04-17"
  supportedGenerationMethods?: string[];
}

interface GeminiListResponse {
  models?: GeminiModel[];
  error?: { message?: string };
}

/** Module-level cache: resolved model short ID (no "models/" prefix). */
let resolvedModel: string | null = null;

/**
 * Returns the full URL for generateContent on a given model ID.
 * Accepts IDs with or without the "models/" prefix.
 */
function generateContentUrl(modelId: string, apiKey: string): string {
  const normalized = modelId.startsWith("models/")
    ? modelId
    : `models/${modelId}`;
  return `${GEMINI_BASE}/${normalized}:generateContent?key=${apiKey}`;
}

/**
 * Lists models available to this API key and returns the best model that
 * supports generateContent, preferring the PREFERRED_FLASH_PREFIXES order.
 *
 * Returns the full model name string (e.g. "models/gemini-2.5-flash-preview-04-17")
 * or null if none are found.
 */
async function discoverBestModel(apiKey: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE}/models?key=${apiKey}`, {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let body: GeminiListResponse;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const models: GeminiModel[] = body.models ?? [];

  // Filter to models that support generateContent
  const capable = models.filter(
    (m) => m.supportedGenerationMethods?.includes("generateContent") ?? false,
  );

  if (capable.length === 0) return null;

  // Try preferred prefixes in order
  for (const prefix of PREFERRED_FLASH_PREFIXES) {
    const match = capable.find((m) => {
      // m.name is like "models/gemini-2.5-flash-preview-04-17"
      const short = m.name.replace(/^models\//, "");
      return short.startsWith(prefix);
    });
    if (match) return match.name;
  }

  // Fall back to the first capable model
  return capable[0].name;
}

/**
 * Resolves which model to use.
 * Uses the module-level cache after the first successful resolution.
 */
async function resolveModel(
  apiKey: string,
): Promise<
  { ok: true; model: string } | { ok: false; error: string; code: string }
> {
  // Return cached result immediately
  if (resolvedModel) return { ok: true, model: resolvedModel };

  const configured = (process.env.GEMINI_MODEL ?? "").trim();

  if (configured) {
    // Configured model: validate it supports generateContent
    const normalized = configured.startsWith("models/")
      ? configured
      : `models/${configured}`;

    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/${normalized}?key=${apiKey}`);
    } catch {
      // Network error — just try to use the model anyway; the generateContent
      // call will give the real error.
      resolvedModel = configured;
      return { ok: true, model: configured };
    }

    if (res.ok) {
      let modelInfo: GeminiModel;
      try {
        modelInfo = await res.json();
      } catch {
        modelInfo = { name: normalized };
      }
      if (
        modelInfo.supportedGenerationMethods &&
        !modelInfo.supportedGenerationMethods.includes("generateContent")
      ) {
        return {
          ok: false,
          error: `The model "${configured}" does not support generateContent. Update GEMINI_MODEL in your .env.local file.`,
          code: "MODEL_UNSUPPORTED",
        };
      }
      resolvedModel = configured;
      return { ok: true, model: configured };
    }

    if (res.status === 404) {
      return {
        ok: false,
        error: `The configured model "${configured}" is not available for this API key. Check the available models or update GEMINI_MODEL in your .env.local file.`,
        code: "MODEL_NOT_FOUND",
      };
    }

    // Other HTTP error — fall through to discovery
  }

  // Auto-discover the best available model
  const discovered = await discoverBestModel(apiKey);
  if (!discovered) {
    return {
      ok: false,
      error:
        "No Gemini model supporting generateContent was found for this API key. " +
        "Set GEMINI_MODEL in your .env.local file to a model available in your project.",
      code: "NO_MODEL_FOUND",
    };
  }

  resolvedModel = discovered;
  return { ok: true, model: discovered };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(payload: AiAnalysisPayload): string {
  return `You are a data quality analyst. Analyze the following dataset profile.

Dataset profile:
${JSON.stringify(payload, null, 2)}

Return a JSON object with exactly these two keys:

"insights": an array of 2 to 5 objects, each with:
  - "title": string (max 60 chars)
  - "description": string (1-2 sentences)

"suggestions": an array of objects, each with:
  - "column": the exact column name from the profile, or null for row-level operations
  - "issueType": one of missing_values, duplicate_rows, inconsistent_values, potential_outliers, or null
  - "title": string (max 60 chars)
  - "reason": string (max 150 chars) explaining why this helps
  - "operationType": one of remove_duplicates, fill_missing, normalize_text, convert_type, or null
  - "strategy": for fill_missing use mean/median/zero/unknown; for normalize_text use trim_lowercase/lowercase/uppercase/titlecase; for remove_duplicates use first/last; for convert_type use number/date/boolean; otherwise null
  - "confidence": number between 0 and 1

Rules:
- column must exactly match a name from the profile columns, or be null.
- Do not invent column names.
- Do not suggest remove_outlier_rows.
- If no applicable operationType exists, set operationType to null.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; code?: number };
}

function extractJson(text: string): string {
  // 1. Try the text as-is (works when responseMimeType is honoured)
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // fall through
  }

  // 2. Strip a single outer code fence (```json ... ``` or ``` ... ```)
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try {
      JSON.parse(inner);
      return inner;
    } catch {
      // fall through
    }
  }

  // 3. Extract the outermost {...} block — handles preamble/postamble text
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // fall through
    }
  }

  throw new Error(
    "AI returned a response that could not be parsed as JSON. Please try again."
  );
}

function parseGeminiResult(text: string): AiAnalysisResult {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(extractJson(text));
  } catch (err) {
    throw err instanceof Error ? err : new Error("AI returned malformed JSON. Please try again.");
  }

  const insights: AiInsight[] = [];
  if (Array.isArray(raw.insights)) {
    for (const item of raw.insights) {
      if (
        typeof item?.title === "string" &&
        typeof item?.description === "string"
      ) {
        insights.push({ title: item.title, description: item.description });
      }
    }
  }

  const VALID_OP_TYPES = new Set<CleaningOperationType>([
    "remove_duplicates",
    "fill_missing",
    "normalize_text",
    "convert_type",
    "remove_outlier_rows",
  ]);

  const suggestions: AiSuggestion[] = [];
  if (Array.isArray(raw.suggestions)) {
    for (let i = 0; i < raw.suggestions.length; i++) {
      const item = raw.suggestions[i];
      if (typeof item?.title !== "string" || typeof item?.reason !== "string")
        continue;

      const opType =
        typeof item.operationType === "string" &&
        VALID_OP_TYPES.has(item.operationType as CleaningOperationType)
          ? (item.operationType as CleaningOperationType)
          : null;

      suggestions.push({
        id: `ai_${i}`,
        column: typeof item.column === "string" ? item.column : undefined,
        issueType:
          typeof item.issueType === "string" ? item.issueType : undefined,
        title: String(item.title).slice(0, 80),
        reason: String(item.reason).slice(0, 200),
        operationType: opType,
        strategy: typeof item.strategy === "string" ? item.strategy : undefined,
        confidence:
          typeof item.confidence === "number"
            ? Math.max(0, Math.min(1, item.confidence))
            : 0.8,
        dismissed: false,
      });
    }
  }

  if (insights.length === 0 && suggestions.length === 0) {
    throw new Error("AI returned an empty analysis. Please try again.");
  }

  return { insights, suggestions };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Check API key server-side — never expose to client
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not configured. Add it to your .env.local file to enable AI analysis.",
        code: "MISSING_API_KEY",
      },
      { status: 503 },
    );
  }

  // 2. Parse request body
  let payload: AiAnalysisPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  // 3. Basic validation
  if (!payload.rowCount || !payload.columnCount) {
    return NextResponse.json(
      { error: "Dataset is empty or invalid.", code: "EMPTY_DATASET" },
      { status: 400 },
    );
  }

  // 4. Resolve model (validates env var or auto-discovers)
  const modelResult = await resolveModel(apiKey);
  if (!modelResult.ok) {
    return NextResponse.json(
      { error: modelResult.error, code: modelResult.code },
      { status: 503 },
    );
  }
  const model = modelResult.model;

  // 5. Build prompt
  const prompt = buildPrompt(payload);

  // 6. Call Gemini generateContent with timeout
  let geminiResponse: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    geminiResponse = await fetch(generateContentUrl(model, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "AI analysis timed out. Please try again."
          : "Could not reach the AI service. Check your connection.",
        code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // 7. Handle HTTP errors from Gemini
  if (!geminiResponse.ok) {
    let detail = "";
    try {
      const errBody = (await geminiResponse.json()) as GeminiGenerateResponse;
      detail = errBody.error?.message ?? "";
    } catch {
      // ignore parse error on error body
    }

    const status = geminiResponse.status;

    if (status === 429) {
      return NextResponse.json(
        {
          error: "AI rate limit reached. Please wait a moment and try again.",
          code: "RATE_LIMITED",
        },
        { status: 429 },
      );
    }

    if (status === 404) {
      // Model was resolved but generateContent returned 404 — clear cache so
      // next request re-discovers in case the model listing changed.
      resolvedModel = null;
      return NextResponse.json(
        {
          error:
            "The configured Gemini model is unavailable for this API key/project. " +
            "Check the available models or update GEMINI_MODEL in your .env.local file.",
          code: "MODEL_NOT_FOUND",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: `AI service returned an error (${status})${detail ? `: ${detail}` : ""}.`,
        code: "GEMINI_ERROR",
      },
      { status: 502 },
    );
  }

  // 8. Parse Gemini response body
  let body: GeminiGenerateResponse;
  try {
    body = await geminiResponse.json();
  } catch {
    return NextResponse.json(
      { error: "AI returned an unreadable response.", code: "PARSE_ERROR" },
      { status: 502 },
    );
  }

  const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) {
    return NextResponse.json(
      {
        error: "AI returned an empty response. Please try again.",
        code: "EMPTY_RESPONSE",
      },
      { status: 502 },
    );
  }

  // 9. Parse structured result from AI text
  let result: AiAnalysisResult;
  try {
    result = parseGeminiResult(rawText);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not parse AI response.",
        code: "PARSE_ERROR",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
