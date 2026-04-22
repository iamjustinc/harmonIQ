/**
 * POST /api/recommend
 *
 * Accepts evidence gathered by harmonIQ's deterministic logic and calls
 * Claude (via tool_use) to produce a structured recommendation.
 *
 * Trust model:
 * - The AI NEVER invents values. It evaluates the evidence passed in and
 *   selects from the explicit candidateValues list or returns null.
 * - Server-side validation enforces the candidate constraint even if the
 *   model produces an unexpected output.
 * - When ANTHROPIC_API_KEY is absent the route returns 503 so the client
 *   falls back to the deterministic suggestion silently.
 *
 * Required env var: ANTHROPIC_API_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import type {
  AIBasisType,
  AIConfidenceBand,
  AIRecommendationRequest,
  AIRecommendationResult,
} from "@/lib/aiRecommendation";

// ─── Schema helpers ──────────────────────────────────────────────────────────

const VALID_BASIS_TYPES: AIBasisType[] = [
  "direct_rule",
  "reference_pattern",
  "weak_heuristic",
  "no_basis",
];

const VALID_CONFIDENCE_BANDS: AIConfidenceBand[] = [
  "high",
  "medium",
  "low",
  "insufficient",
];

function isBasisType(v: unknown): v is AIBasisType {
  return typeof v === "string" && (VALID_BASIS_TYPES as string[]).includes(v);
}

function isConfidenceBand(v: unknown): v is AIConfidenceBand {
  return (
    typeof v === "string" && (VALID_CONFIDENCE_BANDS as string[]).includes(v)
  );
}

// ─── Candidate enforcement ───────────────────────────────────────────────────

/**
 * Validates the raw tool_use output and enforces the candidate constraint.
 * If the model returns a value outside the candidate set, it is silently
 * overridden to null here — the trust guarantee does not depend on the model
 * following instructions alone.
 */
function validateAndNormalize(
  raw: Record<string, unknown>,
  candidates: string[]
): AIRecommendationResult {
  // Enforce candidate set: null or exact match only.
  let recommendedValue: string | null = null;
  if (raw.recommendedValue !== null && raw.recommendedValue !== undefined) {
    const candidate = String(raw.recommendedValue).trim();
    if (candidates.includes(candidate)) {
      recommendedValue = candidate;
    }
    // Value outside candidate set → silently override to null. The rationale
    // and cautionNote below will reflect the weak evidence.
  }

  const basisType: AIBasisType = isBasisType(raw.basisType)
    ? raw.basisType
    : "no_basis";

  const confidenceBand: AIConfidenceBand = isConfidenceBand(raw.confidenceBand)
    ? raw.confidenceBand
    : "insufficient";

  // If value was overridden to null, escalate to manual review.
  const manualReviewRequired =
    recommendedValue === null ? true : Boolean(raw.manualReviewRequired);

  const cautionNote =
    raw.cautionNote !== null && raw.cautionNote !== undefined
      ? String(raw.cautionNote)
      : null;

  return {
    recommendedValue,
    basisType,
    confidenceBand,
    rationale: typeof raw.rationale === "string" ? raw.rationale : "Unable to produce rationale.",
    manualReviewRequired,
    evidenceSummary:
      typeof raw.evidenceSummary === "string"
        ? raw.evidenceSummary
        : "Evidence summary not available.",
    cautionNote,
    aiGenerated: true,
  };
}

// ─── Tool definition (enforces structured output) ────────────────────────────

const RECOMMENDATION_TOOL: Anthropic.Tool = {
  name: "submit_recommendation",
  description:
    "Submit a structured, evidence-grounded recommendation for a missing CRM field value. " +
    "The recommendedValue MUST be null or one of the strings in the candidateValues list provided in the prompt. " +
    "Never invent values outside that list.",
  input_schema: {
    type: "object" as const,
    required: [
      "recommendedValue",
      "basisType",
      "confidenceBand",
      "rationale",
      "manualReviewRequired",
      "evidenceSummary",
    ],
    properties: {
      recommendedValue: {
        type: ["string", "null"],
        description:
          "The recommended fill value. MUST be null OR one of the exact strings in candidateValues. " +
          "Return null when evidence is insufficient.",
      },
      basisType: {
        type: "string",
        enum: VALID_BASIS_TYPES,
        description:
          "direct_rule: routing/dictionary rule matched. " +
          "reference_pattern: CRM reference matched. " +
          "weak_heuristic: keyword or geography only. " +
          "no_basis: no supporting evidence.",
      },
      confidenceBand: {
        type: "string",
        enum: VALID_CONFIDENCE_BANDS,
        description:
          "high: direct rule match. medium: reference pattern. low: heuristic only. insufficient: manual review required.",
      },
      rationale: {
        type: "string",
        description:
          "One to two sentences citing the specific evidence category. " +
          "Do not use vague phrases like 'historical pattern'. Be explicit about what matched and why.",
      },
      manualReviewRequired: {
        type: "boolean",
        description:
          "Must be true when recommendedValue is null or evidence is weak. " +
          "Must be false only when direct_rule or reference_pattern evidence exists.",
      },
      evidenceSummary: {
        type: "string",
        description:
          "Short, plain-English summary of what evidence was available and how strong it was.",
      },
      cautionNote: {
        type: ["string", "null"],
        description:
          "Any important caution about this recommendation (e.g. rule covers a broad territory, reference row is old). " +
          "Null if no significant caution.",
      },
    },
  },
};

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a CRM data quality analyst. Your job is to evaluate structured evidence \
for a missing-value recommendation and produce a precise, calibrated analysis.

STRICT RULES:
1. recommendedValue MUST be null OR one of the exact strings in the candidateValues list.
   If candidateValues is empty, recommendedValue MUST be null and manualReviewRequired MUST be true.
2. A contact's email address (e.g. logan@company.com) does NOT indicate the account owner — these are separate roles.
3. Geographic state alone, without a routing rule or reference source, is NOT sufficient evidence for a named owner.
4. Different states in the same region (e.g. CA vs WA) should only share an owner if the routing rules explicitly group them.
5. Higher-tier evidence always takes precedence.

Evidence hierarchy:
- direct_rule: ownership_rules file matched region + segment, OR segment dictionary validated the tier → HIGH confidence
- reference_pattern: clean CRM reference export matched domain or account name → MEDIUM confidence
- weak_heuristic: only keyword pattern or geographic guess → LOW confidence, manual review recommended
- no_basis: no supporting evidence → manual_review_required = true, recommendedValue = null

Your analysis should synthesize the available evidence honestly. If the deterministic suggestion \
is well-grounded, confirm it with a specific rationale. If the evidence is weak, say so clearly \
and set manualReviewRequired = true.`;

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: AIRecommendationRequest;
  try {
    body = await request.json() as AIRecommendationRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    issueType,
    workflowMode,
    recordContext,
    candidateValues,
    existingSuggestion,
    evidenceSummary,
  } = body;

  // Build the user message from the structured evidence payload.
  const candidateList =
    candidateValues.length > 0
      ? candidateValues.map((v) => `  - "${v}"`).join("\n")
      : "  (none — manual review required)";

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

  const userMessage = `Issue type: ${issueType}
Workflow mode: ${workflowMode}
Account: ${recordContext.accountName}
Domain: ${recordContext.domain}
State: ${recordContext.state || "(not set)"}
Current segment: ${recordContext.segment || "(not set)"}

Allowed candidate values (you MUST choose one or return null):
${candidateList}

Evidence:
${evidenceLines.join("\n")}

Deterministic analysis result:
  Suggested value: "${existingSuggestion.suggestedValue}"
  Confidence: ${existingSuggestion.confidence}%
  Basis: ${existingSuggestion.basisLabel}
  Basis detail: ${existingSuggestion.basisDetail || "(none)"}
  Review state: ${existingSuggestion.reviewState}

Evaluate this evidence. Confirm the deterministic suggestion if the evidence is solid, \
or flag manual review required if it is not. Always cite the specific evidence category.`;

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [RECOMMENDATION_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMessage }],
    });

    const toolBlock = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolBlock) {
      return Response.json({ error: "No structured output from model" }, { status: 502 });
    }

    const raw = toolBlock.input as Record<string, unknown>;
    const result = validateAndNormalize(raw, candidateValues);

    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/recommend]", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
