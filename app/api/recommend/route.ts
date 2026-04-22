/**
 * POST /api/recommend
 *
 * Accepts evidence gathered by harmonIQ's deterministic logic and calls OpenAI
 * to produce a structured recommendation.
 *
 * Trust model:
 * - The AI NEVER invents values. It evaluates the evidence passed in and
 *   selects from the explicit candidateValues list or returns null.
 * - Server-side validation enforces the candidate constraint even if the
 *   model produces an unexpected output.
 * - When OPENAI_API_KEY is absent the route returns 503 so the client shows
 *   "AI unavailable / fallback active" and keeps deterministic suggestions.
 *
 * Required env var: OPENAI_API_KEY
 * Optional env var: OPENAI_MODEL
 */

import type { NextRequest } from "next/server";
import type {
  AIBasisType,
  AIConfidenceBand,
  AIRecommendationCandidate,
  AIRecommendationRequest,
  AIRecommendationResult,
} from "@/lib/aiRecommendation";

// ─── Schema helpers ──────────────────────────────────────────────────────────

const VALID_BASIS_TYPES: AIBasisType[] = [
  "direct_rule",
  "reference_pattern",
  "dataset_pattern",
  "weak_heuristic",
  "no_basis",
];

const VALID_CONFIDENCE_BANDS: AIConfidenceBand[] = [
  "high",
  "medium",
  "low",
  "insufficient",
];

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAIErrorResponse = {
  error?: {
    message?: string;
    type?: string;
  };
};

function isBasisType(v: unknown): v is AIBasisType {
  return typeof v === "string" && (VALID_BASIS_TYPES as string[]).includes(v);
}

function isConfidenceBand(v: unknown): v is AIConfidenceBand {
  return (
    typeof v === "string" && (VALID_CONFIDENCE_BANDS as string[]).includes(v)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ─── Candidate enforcement ───────────────────────────────────────────────────

/**
 * Validates model output and enforces the candidate constraint. If the model
 * returns a value outside the candidate set, it is overridden to null here.
 */
function validateAndNormalize(
  raw: Record<string, unknown>,
  candidates: string[],
  candidateEvidence: AIRecommendationCandidate[],
  issueType: AIRecommendationRequest["issueType"]
): AIRecommendationResult {
  let recommendedValue: string | null = null;
  let rejectedOutOfBounds = false;
  let rejectedWeakOwnerEvidence = false;
  if (raw.recommendedValue !== null && raw.recommendedValue !== undefined) {
    const candidate = String(raw.recommendedValue).trim();
    if (candidates.includes(candidate)) {
      recommendedValue = candidate;
    } else {
      rejectedOutOfBounds = true;
    }
  }

  const selectedEvidence = recommendedValue
    ? candidateEvidence.find((candidate) => candidate.value === recommendedValue)
    : undefined;
  if (
    issueType === "missing_owner" &&
    selectedEvidence &&
    (selectedEvidence.basisType === "weak_heuristic" || selectedEvidence.basisType === "no_basis")
  ) {
    recommendedValue = null;
    rejectedWeakOwnerEvidence = true;
  }

  const basisType: AIBasisType = rejectedOutOfBounds || rejectedWeakOwnerEvidence
    ? "no_basis"
    : selectedEvidence?.basisType ?? (isBasisType(raw.basisType) ? raw.basisType : "no_basis");

  const confidenceBand: AIConfidenceBand = rejectedOutOfBounds || rejectedWeakOwnerEvidence
    ? "insufficient"
    : selectedEvidence?.confidenceBand ?? (isConfidenceBand(raw.confidenceBand) ? raw.confidenceBand : "insufficient");

  const manualReviewRequired =
    recommendedValue === null ? true : Boolean(raw.manualReviewRequired);

  const cautionNote =
    rejectedOutOfBounds
      ? "Model returned a value outside the bounded candidate set, so harmonIQ rejected it and kept the record in manual review."
      : rejectedWeakOwnerEvidence
      ? "Model selected an owner candidate without explicit owner evidence. harmonIQ rejected the assignment and kept the record in manual review."
      : raw.cautionNote !== null && raw.cautionNote !== undefined
      ? String(raw.cautionNote)
      : null;

  return {
    recommendedValue,
    basisType,
    confidenceBand,
    rationale: rejectedOutOfBounds
      ? "AI output did not satisfy the bounded candidate rule, so no AI value is eligible for approval."
      : rejectedWeakOwnerEvidence
      ? "AI selected an owner candidate, but the candidate did not have explicit ownership-rule, territory, reference CRM, or strong same-domain evidence."
      : typeof raw.rationale === "string" ? raw.rationale : "Unable to produce rationale.",
    manualReviewRequired,
    evidenceSummary:
      typeof raw.evidenceSummary === "string"
        ? raw.evidenceSummary
        : "Evidence summary not available.",
    cautionNote,
    aiGenerated: true,
  };
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a CRM data quality analyst. Evaluate structured evidence for a missing-value recommendation and return only valid JSON.

Required JSON shape:
{
  "recommendedValue": string | null,
  "basisType": "direct_rule" | "reference_pattern" | "dataset_pattern" | "weak_heuristic" | "no_basis",
  "confidenceBand": "high" | "medium" | "low" | "insufficient",
  "rationale": string,
  "manualReviewRequired": boolean,
  "evidenceSummary": string,
  "cautionNote": string | null
}

STRICT RULES:
1. recommendedValue MUST be null OR one of the exact strings in the candidateValues list.
   If candidateValues is empty, recommendedValue MUST be null and manualReviewRequired MUST be true.
2. A contact's email address does NOT indicate the account owner.
3. Geographic state alone, without a routing rule or reference source, is NOT sufficient evidence for a named owner.
4. Different states in the same region should only share an owner if routing rules explicitly group them.
5. Higher-tier evidence always takes precedence.
6. For missing_owner, choose a named owner only from direct_rule, reference_pattern, or dataset_pattern evidence.
   If the best owner evidence is weak_heuristic or no_basis, return recommendedValue = null and manualReviewRequired = true.
7. When rejecting a candidate, explain which required signal was missing, such as no matching territory, segment, state, domain, or reference row.

Evidence hierarchy:
- direct_rule: ownership_rules file matched region + segment, OR segment dictionary validated the tier -> HIGH confidence
- reference_pattern: clean CRM reference export matched domain or account name -> MEDIUM confidence
- dataset_pattern: same-domain or same-account evidence from the uploaded CRM dataset -> MEDIUM or LOW confidence
- weak_heuristic: only keyword pattern, segment-only owner signal, or geographic guess -> LOW confidence, manual review required for owner
- no_basis: no supporting evidence -> manualReviewRequired = true, recommendedValue = null

Compare the candidate evidence. Prefer direct_rule over reference_pattern, reference_pattern over dataset_pattern, and dataset_pattern over weak_heuristic. Be concise and explicit about which evidence category matched.`;

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return Response.json(
      {
        provider: "openai",
        error: "OPENAI_API_KEY not configured",
        fallbackReason: "AI unavailable; deterministic/reference fallback is active.",
      },
      { status: 503 }
    );
  }

  let body: AIRecommendationRequest;
  try {
    body = await request.json() as AIRecommendationRequest;
  } catch {
    return Response.json({ provider: "openai", error: "Invalid JSON" }, { status: 400 });
  }

  const {
    issueType,
    workflowMode,
    recordContext,
    candidateValues,
    candidates,
    existingSuggestion,
    evidenceSummary,
  } = body;

  const candidateList =
    candidateValues.length > 0
      ? candidateValues.map((v) => `  - "${v}"`).join("\n")
      : "  (none - manual review required)";

  const evidenceLines: string[] = [
    `Ownership rules loaded: ${evidenceSummary.hasOwnershipRules ? "Yes" : "No"}`,
    `Segment dictionary loaded: ${evidenceSummary.hasSegmentDictionary ? "Yes" : "No"}`,
    `CRM reference loaded: ${evidenceSummary.hasCrmReference ? "Yes" : "No"}`,
  ];
  if (evidenceSummary.matchedRuleDetail) {
    evidenceLines.push(`Matched ownership rule: ${evidenceSummary.matchedRuleDetail}`);
  }
  if (evidenceSummary.matchedReferenceDetail) {
    evidenceLines.push(`Matched CRM reference: ${evidenceSummary.matchedReferenceDetail}`);
  }
  if (evidenceSummary.activeReferenceSources.length > 0) {
    evidenceLines.push(`Active reference sources: ${evidenceSummary.activeReferenceSources.join(", ")}`);
  }
  if (evidenceSummary.currentDatasetSignals.length > 0) {
    evidenceLines.push(`Current dataset signals: ${evidenceSummary.currentDatasetSignals.join(" | ")}`);
  }

  const candidateEvidenceList =
    candidates.length > 0
      ? candidates.map((candidate) => [
          `  - value: "${candidate.value}"`,
          `    basisType: ${candidate.basisType}`,
          `    confidenceBand: ${candidate.confidenceBand}`,
          `    source: ${candidate.source}`,
          `    basis: ${candidate.basisLabel}`,
          `    detail: ${candidate.basisDetail || "(none)"}`,
          `    match: ${candidate.matchSummary || "(none)"}`,
        ].join("\n")).join("\n")
      : "  (none - manual review required)";

  const userMessage = `Issue type: ${issueType}
Workflow mode: ${workflowMode}
Account: ${recordContext.accountName}
Domain: ${recordContext.domain}
State: ${recordContext.state || "(not set)"}
Current segment: ${recordContext.segment || "(not set)"}

candidateValues:
${candidateList}

Candidate evidence package:
${candidateEvidenceList}

Evidence:
${evidenceLines.join("\n")}

Deterministic analysis result:
  Suggested value: "${existingSuggestion.suggestedValue}"
  Confidence: ${existingSuggestion.confidence}%
  Basis type: ${existingSuggestion.basisType}
  Basis label: ${existingSuggestion.basisLabel}
  Basis detail: ${existingSuggestion.basisDetail || "(none)"}
  Review state: ${existingSuggestion.reviewState}

Evaluate this evidence. Confirm the deterministic suggestion if evidence is solid, or flag manual review required if it is not.`;

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!openAiResponse.ok) {
      const errorPayload = await openAiResponse.json().catch((): OpenAIErrorResponse => ({})) as OpenAIErrorResponse;
      const errorMessage = errorPayload.error?.message ?? `OpenAI request failed with ${openAiResponse.status}`;
      return Response.json(
        {
          provider: "openai",
          model,
          error: errorMessage,
          fallbackReason: "AI unavailable; deterministic/reference fallback is active.",
        },
        { status: 502 }
      );
    }

    const payload = await openAiResponse.json() as OpenAIChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return Response.json(
        {
          provider: "openai",
          model,
          error: "No structured content from model",
          fallbackReason: "AI unavailable; deterministic/reference fallback is active.",
        },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) {
      return Response.json(
        {
          provider: "openai",
          model,
          error: "Model returned invalid JSON shape",
          fallbackReason: "AI unavailable; deterministic/reference fallback is active.",
        },
        { status: 502 }
      );
    }

    const result = validateAndNormalize(parsed, candidateValues, candidates, issueType);
    return Response.json({ result, provider: "openai", model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/recommend]", message);
    return Response.json(
      {
        provider: "openai",
        model,
        error: message,
        fallbackReason: "AI unavailable; deterministic/reference fallback is active.",
      },
      { status: 502 }
    );
  }
}
