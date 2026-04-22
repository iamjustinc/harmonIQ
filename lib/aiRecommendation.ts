/**
 * AI recommendation layer for harmonIQ.
 *
 * The AI does NOT generate values from scratch. It evaluates evidence gathered
 * by deterministic logic and returns a structured analysis. The recommended
 * value MUST come from the bounded candidate set passed in the request — this
 * is enforced both in the prompt and server-side in the API route.
 *
 * When no strong evidence exists, the AI returns manualReviewRequired = true
 * and recommendedValue = null. The fallback (no API key, network error, etc.)
 * is always null so the existing deterministic suggestion remains untouched.
 */

import type { IssueType, WorkflowMode } from "./types";

// ─── Structured output schema ───────────────────────────────────────────────

export type AIBasisType =
  | "direct_rule"       // ownership rules or segment dictionary gave a match
  | "reference_pattern" // CRM reference export matched the domain or account
  | "weak_heuristic"    // only geographic or keyword pattern — low confidence
  | "no_basis";         // no supporting evidence — manual review required

export type AIConfidenceBand =
  | "high"         // direct rule or verified reference match
  | "medium"       // reference pattern with no confirming rule
  | "low"          // heuristic only, proceed with caution
  | "insufficient"; // evidence insufficient, do not auto-fill

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
  /** Marks this object as AI-generated so the UI can label it clearly. */
  aiGenerated: true;
}

// ─── Client-side fetch helper ────────────────────────────────────────────────

/**
 * Calls /api/recommend and returns a structured AI recommendation.
 * Returns null on any error (network failure, missing API key, timeout).
 * The caller must treat null as "fall back to deterministic suggestion".
 */
export async function fetchAIRecommendation(
  request: AIRecommendationRequest
): Promise<AIRecommendationResult | null> {
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
    if (!response.ok) return null;

    const data = await response.json() as { result?: AIRecommendationResult };
    return data.result ?? null;
  } catch {
    // Network error, abort, JSON parse failure — silent fallback
    return null;
  }
}
