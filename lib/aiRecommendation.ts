/**
 * AI recommendation layer for harmonIQ.
 *
 * The AI does NOT generate values from scratch. It evaluates evidence gathered
 * by deterministic logic and returns a structured analysis. The recommended
 * value MUST come from the bounded candidate set passed in the request — this
 * is enforced both in the prompt and server-side in the API route.
 *
 * When no strong evidence exists, the AI returns manualReviewRequired = true
 * and recommendedValue = null. Failures return an explicit fallback state so
 * the UI can tell users that deterministic/reference suggestions are active.
 */

import type { IssueType, WorkflowMode } from "./types";

// ─── Structured output schema ───────────────────────────────────────────────

export type AIBasisType =
  | "direct_rule"       // ownership rules or segment dictionary gave a match
  | "reference_pattern" // CRM reference export matched the domain or account
  | "dataset_pattern"   // current uploaded dataset has same-domain evidence
  | "weak_heuristic"    // only geographic or keyword pattern — low confidence
  | "no_basis";         // no supporting evidence — manual review required

export type AIConfidenceBand =
  | "high"         // direct rule or verified reference match
  | "medium"       // reference pattern with no confirming rule
  | "low"          // heuristic only, proceed with caution
  | "insufficient"; // evidence insufficient, do not auto-fill

export interface AIRecommendationCandidate {
  value: string;
  basisType: AIBasisType;
  basisLabel: string;
  basisDetail: string;
  confidenceBand: AIConfidenceBand;
  source: string;
  matchSummary: string;
}

export interface AIRecommendationRequest {
  issueType: Extract<IssueType, "missing_owner" | "missing_segment">;
  workflowMode: WorkflowMode;
  recordContext: {
    accountName: string;
    domain: string;
    state: string;
    segment: string;
  };
  /**
   * Bounded candidate set produced by deterministic logic and uploaded
   * reference context. The AI must return a value from this list or null.
   * If this array is empty the AI must return null + manualReviewRequired = true.
   */
  candidateValues: string[];
  /**
   * Same bounded values with deterministic/reference evidence attached so the
   * model can compare candidates instead of merely decorating one suggestion.
   */
  candidates: AIRecommendationCandidate[];
  existingSuggestion: {
    suggestedValue: string;
    confidence: number;
    basisType: string;
    basisLabel: string;
    basisDetail: string;
    reviewState: string;
  };
  evidenceSummary: {
    hasOwnershipRules: boolean;
    hasSegmentDictionary: boolean;
    hasCrmReference: boolean;
    activeReferenceSources: string[];
    currentDatasetSignals: string[];
    /** Detail string from the matched ownership rule, if any */
    matchedRuleDetail?: string;
    /** Detail string from the matched CRM reference row, if any */
    matchedReferenceDetail?: string;
  };
}

export interface AIRecommendationResult {
  /** Null when evidence is insufficient or no candidate matched. */
  recommendedValue: string | null;
  basisType: AIBasisType;
  confidenceBand: AIConfidenceBand;
  /** One-to-two sentence rationale citing the specific evidence category. */
  rationale: string;
  /** True when evidence is too weak to recommend a specific value. */
  manualReviewRequired: boolean;
  /** Short summary of what evidence was available and how strong it was. */
  evidenceSummary: string;
  /** Caution about this recommendation, or null. */
  cautionNote: string | null;
  /**
   * Per-candidate rejection reasons provided by the model.
   * Each entry is a concise string like "CandidateName: reason why rejected".
   * Empty array when no candidates were evaluated or no rejections occurred.
   */
  rejectedCandidateSummary: string[];
  /** Marks this object as AI-generated so the UI can label it clearly. */
  aiGenerated: true;
}

export type AIRecommendationFetchStatus = "loaded" | "fallback" | "unavailable";

export interface AIRecommendationFetchResult {
  status: AIRecommendationFetchStatus;
  result: AIRecommendationResult | null;
  message: string;
  provider?: "openai";
}

// ─── Client-side fetch helper ────────────────────────────────────────────────

/**
 * Calls /api/recommend and returns a structured AI recommendation plus a
 * diagnostic status for the review panel.
 */
export async function fetchAIRecommendationWithStatus(
  request: AIRecommendationRequest
): Promise<AIRecommendationFetchResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await response.json() as {
      result?: AIRecommendationResult;
      error?: string;
      fallbackReason?: string;
      provider?: "openai";
    };

    if (!response.ok) {
      return {
        status: "unavailable",
        result: null,
        message: data.fallbackReason ?? data.error ?? "AI unavailable; deterministic/reference fallback is active.",
        provider: data.provider,
      };
    }

    if (data.result) {
      return {
        status: "loaded",
        result: data.result,
        message: "AI recommendation loaded.",
        provider: data.provider ?? "openai",
      };
    }

    return {
      status: "fallback",
      result: null,
      message: data.fallbackReason ?? "AI returned no recommendation; deterministic/reference fallback is active.",
      provider: data.provider,
    };
  } catch {
    return {
      status: "unavailable",
      result: null,
      message: "AI unavailable; deterministic/reference fallback is active.",
    };
  }
}

/**
 * Backward-compatible helper for callers that only need the recommendation.
 */
export async function fetchAIRecommendation(
  request: AIRecommendationRequest
): Promise<AIRecommendationResult | null> {
  const response = await fetchAIRecommendationWithStatus(request);
  return response.result;
}
