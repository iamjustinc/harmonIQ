import type {
  CRMRecord,
  IssueType,
  IssueDefinition,
  ResolutionSuggestion,
  MissingOwnerRecord,
  DuplicateCluster,
  InvalidEmailRecord,
  InconsistentStateRecord,
  MissingSegmentRecord,
  NamingFormatRecord,
  SchemaMismatchRecord,
  ApprovedChange,
  ReferenceContext,
  ResolutionType,
} from "./types";
import { SAMPLE_DATA } from "./data";
import { EMPTY_REFERENCE_CONTEXT, contextualizeSuggestion } from "./referenceContext";

// ─── State normalisation table ──────────────────────────────────────────────
const STATE_MAP: Record<string, string> = {
  "california": "CA", "calif.": "CA", "calif": "CA", "cal": "CA",
  "new york": "NY",  "n.y.": "NY",   "n.y": "NY",   "newyork": "NY", "new york ": "NY", "new york\t": "NY",
  "texas": "TX",     "tex.": "TX",   "tex": "TX",
  "florida": "FL",   "fla.": "FL",   "fla": "FL",
  "washington": "WA","wash.": "WA",  "wash": "WA",
  "illinois": "IL",  "ill.": "IL",   "ill": "IL",
  "new jersey": "NJ","n.j.": "NJ",
  "georgia": "GA",
  "ohio": "OH",
  "michigan": "MI",
  "minnesota": "MN",
  "colorado": "CO",
  "virginia": "VA",
  "oregon": "OR",
};

const VALID_2LETTER = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

// ─── Title-case helper ──────────────────────────────────────────────────────
const MINOR_WORDS = new Set(["a","an","the","and","but","or","for","nor","on","at","to","by","in","of"]);
export function toTitleCase(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w, i) =>
      i === 0 || !MINOR_WORDS.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
    )
    .join(" ");
}

// ─── 1. Missing Owner ───────────────────────────────────────────────────────
const INVALID_OWNERS = new Set(["", "tbd", "unknown", "-", "n/a", "none", "unassigned"]);

function standardizeStateValue(state: string): string {
  const value = (state ?? "").trim();
  if (VALID_2LETTER.has(value.toUpperCase())) return value.toUpperCase();
  return STATE_MAP[value.toLowerCase()] ?? "";
}

function suggestOwner(record: CRMRecord): ResolutionSuggestion {
  // No named rep is ever suggested from state/segment heuristics alone.
  // A named owner requires a direct match in an uploaded ownership rules file
  // or a strong match in an uploaded CRM reference export.
  // contextualizeSuggestion() is the only path to a named suggestion.
  const state = standardizeStateValue(record.state);
  const stateLabel = state || record.state?.trim() || "unknown";
  const segmentLabel = record.segment?.trim() || "no segment";
  return {
    field: "owner",
    suggestedValue: "Unassigned - Review",
    confidence: 40,
    rationale: `No exact clean CRM reference row or single-owner routing pattern supports a named owner. State (${stateLabel}) and segment (${segmentLabel}) are present but insufficient to identify a rep without verified owner evidence.`,
    reviewState: "review_required",
  };
}

export function detectMissingOwner(records: CRMRecord[]): MissingOwnerRecord[] {
  return records
    .filter(r => INVALID_OWNERS.has((r.owner ?? "").toLowerCase().trim()))
    .map(r => ({ record: r, ownerValue: r.owner, suggestion: suggestOwner(r) }));
}

// ─── 2. Duplicate Accounts ──────────────────────────────────────────────────
export function detectDuplicates(records: CRMRecord[]): DuplicateCluster[] {
  const domainMap = new Map<string, CRMRecord[]>();
  for (const r of records) {
    const d = (r.domain ?? "").toLowerCase().trim();
    if (!d) continue;
    domainMap.set(d, [...(domainMap.get(d) ?? []), r]);
  }
  const clusters: DuplicateCluster[] = [];
  for (const [domain, recs] of domainMap) {
    if (recs.length < 2) continue;
    // Confidence: higher if same phone or owner
    const samePhone = new Set(recs.map(r => r.phone)).size === 1;
    const confidence = samePhone ? 97 : 88;
    // Pick canonical: prefer record with a valid owner and normal casing
    const canonical = recs.find(r =>
      r.owner && !INVALID_OWNERS.has(r.owner.toLowerCase().trim()) &&
      r.account_name === r.account_name.trim() &&
      r.account_name !== r.account_name.toUpperCase()
    ) ?? recs[0];
    clusters.push({ domain, records: recs, confidence, canonicalRecord: canonical });
  }
  return clusters.sort((a, b) => b.records.length - a.records.length);
}

// ─── 3. Invalid Email ───────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLACEHOLDER_PREFIXES = ["none@", "test@", "admin@", "test", "none", "hello@"];

function classifyEmail(email: string): string | null {
  if (!email || email.trim() === "") return "Empty email field";
  const e = email.trim();
  if (!e.includes("@")) return "Missing @ symbol";
  if (e.endsWith("@")) return "Incomplete - missing domain";
  if (e.startsWith("@")) return "Incomplete - missing local part";
  if (e.includes("#")) return "Contains illegal character '#'";
  if (PLACEHOLDER_PREFIXES.some(p => e.toLowerCase() === p || e.toLowerCase().startsWith(p) && !e.includes("."))) return "Placeholder value";
  if (!EMAIL_RE.test(e)) {
    if (!e.split("@")[1]?.includes(".")) return "Domain missing TLD";
    return "Malformed address";
  }
  return null;
}

export function detectInvalidEmails(records: CRMRecord[]): InvalidEmailRecord[] {
  return records.flatMap(r => {
    const reason = classifyEmail(r.email);
    if (!reason) return [];
    const suggestedValue = suggestEmailCorrection(r.email, r.domain);
    return [
      {
        record: r,
        emailValue: r.email,
        reason,
        suggestedValue,
        suggestion: suggestedValue
          ? {
              field: "email" as const,
              suggestedValue,
              confidence: 91,
              rationale: "Correction follows a deterministic syntax repair and matches the account domain.",
              reviewState: "needs_approval" as const,
            }
          : undefined,
      },
    ];
  });
}

function suggestEmailCorrection(email: string, domain: string): string | undefined {
  const value = (email ?? "").trim();
  const cleanDomain = (domain ?? "").trim().toLowerCase();
  if (!value || !cleanDomain) return undefined;

  if (value.includes("#")) {
    const corrected = value.replace("#", "@");
    return EMAIL_RE.test(corrected) ? corrected : undefined;
  }

  if (value.includes("@")) {
    const [local, enteredDomain] = value.split("@");
    const rootDomain = cleanDomain.split(".")[0];
    if (local && enteredDomain && enteredDomain.toLowerCase() === rootDomain) {
      const corrected = `${local}@${cleanDomain}`;
      return EMAIL_RE.test(corrected) ? corrected : undefined;
    }
  }

  return undefined;
}

// ─── 4. Inconsistent State Values ──────────────────────────────────────────
export function detectInconsistentStates(records: CRMRecord[]): InconsistentStateRecord[] {
  return records
    .filter(r => {
      const v = (r.state ?? "").trim();
      if (!v) return false;
      if (VALID_2LETTER.has(v.toUpperCase())) return false; // already correct
      return STATE_MAP[v.toLowerCase()] !== undefined || !VALID_2LETTER.has(v);
    })
    .map(r => {
      const v = (r.state ?? "").trim();
      const std = standardizeStateValue(v);
      return {
        record: r,
        currentValue: v,
        standardValue: std,
        suggestion: {
          field: "state" as const,
          suggestedValue: std,
          confidence: 97,
          rationale: "State value maps directly to a USPS two-letter code using a deterministic normalization table.",
          reviewState: "deterministic" as const,
        },
      };
    })
    .filter(x => x.standardValue !== "");
}

// ─── 5. Missing Segment ─────────────────────────────────────────────────────
const INVALID_SEGMENTS = new Set(["", "unknown", "-", "n/a", "none", "tbd"]);

const ENTERPRISE_KEYWORDS = ["health", "bio", "medical", "labs", "systems", "security", "capital"] as const;
const SMB_KEYWORDS = ["retail", "foods", "travel", "living", "supply", "care"] as const;

function suggestSegment(record: CRMRecord): ResolutionSuggestion {
  // Keyword signals are weak — they provide a candidate tier worth reviewing,
  // but are never strong enough for needs_approval without a segment dictionary
  // or CRM reference to validate the inference.
  // contextualizeSuggestion() upgrades these when a segment dictionary is loaded.
  const name = record.account_name.toLowerCase();
  const domain = record.domain.toLowerCase();

  const matchedEnterpriseKeyword = ENTERPRISE_KEYWORDS.find((kw) => name.includes(kw));
  const enterpriseDomainTld = /\.(ai|net)$/.exec(domain)?.[0];

  if (matchedEnterpriseKeyword ?? enterpriseDomainTld) {
    const signal = matchedEnterpriseKeyword
      ? `account name contains "${matchedEnterpriseKeyword}"`
      : `domain ends in ${enterpriseDomainTld}`;
    return {
      field: "segment",
      suggestedValue: "Needs Review",
      confidence: 62,
      rationale: `Weak keyword signal only: ${signal}. The real cleaned export keeps missing segment values review-first unless a clean CRM reference row supplies a trusted segment.`,
      reviewState: "review_required",
    };
  }

  const matchedSmbKeyword = SMB_KEYWORDS.find((kw) => name.includes(kw));
  if (matchedSmbKeyword) {
    return {
      field: "segment",
      suggestedValue: "Needs Review",
      confidence: 55,
      rationale: `Weak keyword signal only: account name contains "${matchedSmbKeyword}". The real cleaned export keeps missing segment values review-first unless a clean CRM reference row supplies a trusted segment.`,
      reviewState: "review_required",
    };
  }

  // No keyword or domain signal at all — do not guess a named tier.
  return {
    field: "segment",
    suggestedValue: "Needs Review",
    confidence: 32,
    rationale: "No account-name keyword or domain signal matched any segment pattern, and no segment dictionary is loaded. A segment cannot be inferred without additional context. Upload a segment dictionary or assign manually.",
    reviewState: "review_required",
  };
}

export function detectMissingSegment(records: CRMRecord[]): MissingSegmentRecord[] {
  return records
    .filter(r => INVALID_SEGMENTS.has((r.segment ?? "").toLowerCase().trim()))
    .map(r => ({ record: r, segmentValue: r.segment, suggestion: suggestSegment(r) }));
}

// ─── 6. Naming Format ───────────────────────────────────────────────────────
function hasNamingIssue(name: string): { hasissue: boolean; reason: string; suggested: string } {
  const trimmed = name.trim();
  if (name !== trimmed) return { hasissue: true, reason: "Leading/trailing whitespace", suggested: trimmed };
  if (/\s{2,}/.test(name)) return { hasissue: true, reason: "Multiple consecutive spaces", suggested: name.replace(/\s{2,}/g, " ") };
  if (trimmed.length > 2 && trimmed === trimmed.toUpperCase() && /[A-Z]{2,}/.test(trimmed))
    return { hasissue: true, reason: "All caps - unprofessional, breaks deduplication matching", suggested: toTitleCase(trimmed) };
  if (trimmed.includes("   ") || /[a-z][A-Z]{2,}/.test(trimmed))
    return { hasissue: true, reason: "Inconsistent capitalisation in contact name", suggested: toTitleCase(trimmed) };
  return { hasissue: false, reason: "", suggested: "" };
}

export function detectNamingFormat(records: CRMRecord[]): NamingFormatRecord[] {
  const results: NamingFormatRecord[] = [];
  for (const r of records) {
    const acct = hasNamingIssue(r.account_name);
    if (acct.hasissue) results.push({ record: r, field: "account_name", currentValue: r.account_name, suggestedValue: acct.suggested, reason: acct.reason });
    const contact = hasNamingIssue(r.contact_name);
    if (contact.hasissue) results.push({ record: r, field: "contact_name", currentValue: r.contact_name, suggestedValue: contact.suggested, reason: contact.reason });
  }
  return results;
}

// ─── 7. Schema Mismatch ─────────────────────────────────────────────────────
export function detectSchemaMismatches(): SchemaMismatchRecord[] {
  return [
    {
      scope: "field",
      source: "account_name",
      expected: "account",
      reason: "Source CRM export uses account_name while the review model expects a canonical account field.",
      impact: "Mapped during analysis so account-level rules and duplicate review use one stable reference.",
    },
    {
      scope: "field",
      source: "contact_name",
      expected: "contact",
      reason: "Source CRM export uses contact_name while outreach review expects a canonical contact field.",
      impact: "Mapped during analysis so email and naming checks can be reviewed consistently.",
      suggestion: {
        field: "schema_mapping" as const,
        suggestedValue: "contact",
        confidence: 93,
        rationale: "Column name and downstream checks align with a canonical contact field.",
        reviewState: "deterministic" as const,
      },
    },
    {
      scope: "column",
      source: "(missing) lifecycle_stage",
      expected: "lifecycle_stage",
      reason: "Lifecycle stage is absent from the CRM export, which creates import risk for enrichment and campaign workflows.",
      impact: "Add a review-required lifecycle_stage column before downstream import instead of inferring lifecycle from weak signals.",
      suggestion: {
        field: "lifecycle_stage" as const,
        suggestedValue: "Review Required",
        confidence: 52,
        rationale: "The source file lacks lifecycle evidence; harmonIQ can preserve the missing value as an explicit review task.",
        reviewState: "review_required" as const,
      },
    },
  ];
}

// ─── Detection result shape ──────────────────────────────────────────────────
export type DetectionResult = {
  missingOwner:       ReturnType<typeof detectMissingOwner>;
  duplicates:         ReturnType<typeof detectDuplicates>;
  invalidEmails:      ReturnType<typeof detectInvalidEmails>;
  inconsistentStates: ReturnType<typeof detectInconsistentStates>;
  missingSegments:    ReturnType<typeof detectMissingSegment>;
  namingFormat:       ReturnType<typeof detectNamingFormat>;
  schemaMismatches:   ReturnType<typeof detectSchemaMismatches>;
};

/** Run all detectors against a given record set. */
export function runDetection(records: CRMRecord[]): DetectionResult {
  return {
    missingOwner:       detectMissingOwner(records),
    duplicates:         detectDuplicates(records),
    invalidEmails:      detectInvalidEmails(records),
    inconsistentStates: detectInconsistentStates(records),
    missingSegments:    detectMissingSegment(records),
    namingFormat:       detectNamingFormat(records),
    schemaMismatches:   detectSchemaMismatches(),
  };
}

// ─── Pre-computed detection results (sample data, used as fallback) ──────────
export const DETECTED: DetectionResult = runDetection(SAMPLE_DATA);

// ─── Issue definitions (display metadata + AI recommendation copy) ──────────

/** Build the full IssueDefinition[] from a DetectionResult.  */
export function buildIssueDefinitions(detected: DetectionResult): IssueDefinition[] {
  return [
  {
    type: "missing_owner",
    title: "Missing Owner Fields",
    severity: "high",
    category: "Routing",
    recordCount: detected.missingOwner.length,
    businessImpact: "Blocks routing readiness",
    workflowLabel: "Blocking Routing",
    confidence: 99,
    priorityReason: "Ranks first because owner gaps stop records from entering routing workflows at all.",
    reviewMode: "Review-first",
    whyItMatters:
      "Records without an assigned owner cannot be routed to territory reps. Routing logic requires a valid owner on every account record. Any record missing this field will be silently skipped, causing missed follow-ups, unattributed revenue, and broken SLA commitments.",
    suggestedAction:
      "Flag every missing owner for assignment. Mark each record as 'Unassigned - Review' so it is visible in the routing queue without being routed incorrectly.",
    riskLevel: "High",
    downstreamImplication:
      "Without resolution, these accounts will not appear in any rep's routing queue, blocking the upcoming routing readiness review.",
    canBatchAccept: false,
    readinessImpact: 18,
  },
  {
    type: "duplicate_accounts",
    title: "Duplicate Account Records",
    severity: "high",
    category: "Records",
    recordCount: detected.duplicates.reduce((sum, c) => sum + c.records.length, 0),
    businessImpact: "Distorts pipeline reporting",
    workflowLabel: "Inflating Pipeline",
    confidence: 94,
    priorityReason: "Ranks second because duplicate clusters distort reporting and account ownership, but still require human merge review.",
    reviewMode: "Cluster review",
    whyItMatters:
      "Duplicate account records inflate pipeline counts, fragment account history, and create double-outreach to the same contacts. Reporting by territory or segment becomes unreliable when the same company appears under multiple records.",
    suggestedAction:
      "Review each likely-duplicate cluster and designate a canonical record. Secondary records should be flagged for merge or removal, not auto-deleted.",
    riskLevel: "High",
    downstreamImplication:
      "Pipeline reports will overcount opportunities until duplicates are resolved. Territory assignments may conflict across duplicate records.",
    canBatchAccept: false,
    readinessImpact: 14,
  },
  {
    type: "invalid_email",
    title: "Invalid Email Formats",
    severity: "medium-high",
    category: "Outreach",
    recordCount: detected.invalidEmails.length,
    businessImpact: "Reduces outreach usability",
    workflowLabel: "Blocking Outreach",
    confidence: 99,
    priorityReason: "Ranks above deterministic cleanup because broken email fields can create outreach failures and sender reputation risk.",
    reviewMode: "Suggest obvious fixes",
    whyItMatters:
      "Records with invalid or placeholder email addresses cannot be contacted through outreach sequences, campaign execution, or customer communication workflows. Any email automation triggered against these records will hard-bounce or fail silently.",
    suggestedAction:
      "Flag invalid email records for manual correction. Where the email is obviously a placeholder (e.g. 'none@', 'test'), mark the field as blank rather than leaving the invalid value in place.",
    riskLevel: "Medium-High",
    downstreamImplication:
      "Outreach campaigns targeting these records will fail. Bounce rates increase, potentially harming sender reputation.",
    canBatchAccept: false,
    readinessImpact: 8,
  },
  {
    type: "missing_segment",
    title: "Missing Segment Values",
    severity: "medium-high",
    category: "Segmentation",
    recordCount: detected.missingSegments.length,
    businessImpact: "Weakens planning & targeting",
    workflowLabel: "Weakens Segmentation",
    confidence: 99,
    priorityReason: "Ranks with outreach risk because segment gaps affect routing, quota planning, and campaign selection.",
    reviewMode: "Review-first",
    whyItMatters:
      "Segment is a critical field for territory planning, campaign targeting, and revenue reporting. Records without a valid segment cannot be included in segmented routing rules, quota calculations, or go-to-market planning exercises.",
    suggestedAction:
      "Flag each record missing a segment for manual review. Do not auto-assign segments because the system cannot infer the correct tier without additional business context.",
    riskLevel: "Medium-High",
    downstreamImplication:
      "Unclassified records will be excluded from segment-level reports and targeting lists, creating blind spots in revenue planning.",
    canBatchAccept: false,
    readinessImpact: 8,
  },
  {
    type: "inconsistent_state",
    title: "Inconsistent State Values",
    severity: "medium",
    category: "Standardization",
    recordCount: detected.inconsistentStates.length,
    businessImpact: "Breaks territory segmentation",
    workflowLabel: "Breaks Segmentation",
    confidence: 97,
    priorityReason: "Ranks below review-first issues because every proposed state correction is deterministic and reversible.",
    reviewMode: "Deterministic correction",
    whyItMatters:
      "State values appear in at least 7 different formats across this dataset (e.g. 'California', 'calif.', 'Cal', 'CA'). Territory logic, geographic filters, and segmentation rules rely on standardized 2-letter state codes. Mixed formats cause records to fall outside territory boundaries silently.",
    suggestedAction:
      "Standardize all state values to USPS 2-letter abbreviations. This is a safe, deterministic transformation; no ambiguity exists for any value in this dataset.",
    riskLevel: "Medium",
    downstreamImplication:
      "Territory-based routing filters will miss records with non-standard state values, causing them to route incorrectly or not at all.",
    canBatchAccept: true,
    readinessImpact: 11,
  },
  {
    type: "schema_mismatch",
    title: "Schema Mismatch",
    severity: "medium",
    category: "Schema",
    recordCount: detected.schemaMismatches.length,
    businessImpact: "Creates field mapping risk",
    workflowLabel: "Schema Mapping",
    confidence: 93,
    priorityReason: "Ranks after record-level workflow blockers because mappings are explainable and do not change individual field values.",
    reviewMode: "Mapping confirmation",
    whyItMatters:
      "CRM exports often use source-specific field names. harmonIQ maps those fields into a stable review model before applying issue rules. Field naming mismatches should be visible so operations teams know which source columns powered the recommendations.",
    suggestedAction:
      "Confirm the detected source-to-canonical mappings and carry mapping notes into the change summary. No row-level edits are required for this issue type.",
    riskLevel: "Medium",
    downstreamImplication:
      "If source field mappings are not documented, downstream teams may mistrust exported changes or re-import the cleaned file into the wrong CRM fields.",
    canBatchAccept: true,
    readinessImpact: 2,
  },
  {
    type: "naming_format",
    title: "Improper Naming Format",
    severity: "low-medium",
    category: "Standardization",
    recordCount: detected.namingFormat.length,
    businessImpact: "Reduces deduplication quality",
    workflowLabel: "Safe Cleanup",
    confidence: 96,
    priorityReason: "Ranks last because formatting cleanup improves trust and matching quality without blocking core workflows.",
    reviewMode: "Deterministic cleanup",
    whyItMatters:
      "Account names in ALL CAPS or with extra whitespace reduce deduplication matching quality, look unprofessional in outreach, and make visual scanning harder. These are low-risk formatting issues that can be normalized without affecting business logic.",
    suggestedAction:
      "Apply title-case normalization to all-caps account names. Trim extra whitespace from names with leading/trailing or double spaces.",
    riskLevel: "Low",
    downstreamImplication:
      "Inconsistent naming makes fuzzy deduplication less effective, increasing the likelihood of future duplicate records being created.",
    canBatchAccept: true,
    readinessImpact: 4,
  },
  ];
}

/** Static issue definitions built from sample data (backward-compat export). */
export const ISSUE_DEFINITIONS: IssueDefinition[] = buildIssueDefinitions(DETECTED);

// ─── Readiness score helpers ────────────────────────────────────────────────
export const INITIAL_SCORE = 35;

export function calculateScore(
  issueStatuses: Record<IssueType, string>
): number {
  let score = INITIAL_SCORE;
  for (const def of ISSUE_DEFINITIONS) {
    if (issueStatuses[def.type] === "approved") {
      score += def.readinessImpact;
    }
  }
  return Math.min(score, 100);
}

// ─── Generate ApprovedChanges for an issue type ─────────────────────────────
let changeCounter = 1;

function isPlaceholderChangeValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.startsWith("needs") ||
    lower.startsWith("awaiting") ||
    lower.startsWith("no strong") ||
    lower === "unassigned - review" ||
    lower.includes("[flagged")
  );
}

function resolutionTypeForSuggestion(suggestion: ResolutionSuggestion): ResolutionType {
  // Evidence tier takes priority when present — set by referenceContext.ts
  const tier = suggestion.basis?.evidenceTier;
  if (tier === "exact_reference_match" || tier === "strong_reference_match" || tier === "rule_supported_match") {
    return "reference_backed";
  }
  if (tier === "insufficient_evidence" || tier === "weak_pattern_match") {
    return "unresolved_review_required";
  }
  // Fallback for deterministic fixes and suggestions without a tier (state normalization, schema, etc.)
  if (isPlaceholderChangeValue(suggestion.suggestedValue)) return "unresolved_review_required";
  if (suggestion.basis?.strength === "deterministic") return "deterministic_fix";
  if (suggestion.basis?.strength === "direct" || suggestion.basis?.strength === "strong") return "reference_backed";
  return "unresolved_review_required";
}

function unresolvedValueForIssue(issueType: IssueType): string {
  if (issueType === "missing_owner") return "Unassigned - Review";
  if (issueType === "missing_segment") return "Needs Review";
  return "[Flagged - review required]";
}

function changeValueForSuggestion(issueType: IssueType, suggestion: ResolutionSuggestion): string {
  return resolutionTypeForSuggestion(suggestion) === "unresolved_review_required"
    ? unresolvedValueForIssue(issueType)
    : suggestion.suggestedValue;
}

function decisionForSuggestion(suggestion: ResolutionSuggestion): ApprovedChange["userDecision"] {
  return resolutionTypeForSuggestion(suggestion) === "unresolved_review_required" ? "Flagged" : "Accepted";
}

function evidenceDetailForSuggestion(issueType: IssueType, suggestion: ResolutionSuggestion): string {
  const basisLabel = suggestion.basis?.label ?? "No strong basis";
  const basisDetail = suggestion.basis?.detail ?? suggestion.rationale;
  const source = suggestion.basis?.sourceName ? ` Source: ${suggestion.basis.sourceName}.` : "";
  const strength = suggestion.basis?.strength ?? "fallback";
  const tier = suggestion.basis?.evidenceTier;
  const tierLabel = tier ? ` Evidence tier: ${tier.replace(/_/g, " ")}.` : "";

  if (resolutionTypeForSuggestion(suggestion) === "unresolved_review_required") {
    const refusalReason = suggestion.basis?.refusalReason ?? "";
    if (issueType === "missing_owner") {
      return `No strong owner basis found.${tierLabel} ${refusalReason} harmonIQ did not assign a named owner because contact names, email addresses, and multi-owner territory patterns are not sufficient owner evidence.${source}`;
    }
    if (issueType === "missing_segment") {
      return `No strong segment basis found.${tierLabel} ${refusalReason ? refusalReason + " " : ""}Weak inferred values are kept as review-required until supported by a segment dictionary, CRM reference, or manual override.${source}`;
    }
    return `Manual review required.${tierLabel} ${basisDetail}${source}`;
  }

  // Build provenance string for reference-backed and rule-supported matches
  const provenanceParts: string[] = [];
  if (suggestion.basis?.matchedRecordId) provenanceParts.push(`reference row: ${suggestion.basis.matchedRecordId}`);
  if (suggestion.basis?.matchedDomain) provenanceParts.push(`domain: ${suggestion.basis.matchedDomain}`);
  if (suggestion.basis?.matchedAccount) provenanceParts.push(`account: ${suggestion.basis.matchedAccount}`);
  if (suggestion.basis?.matchedState) provenanceParts.push(`state: ${suggestion.basis.matchedState}`);
  if (suggestion.basis?.matchedSegment) provenanceParts.push(`segment: ${suggestion.basis.matchedSegment}`);
  const provenance = provenanceParts.length > 0 ? ` Match provenance: ${provenanceParts.join(", ")}.` : "";

  return `Selected "${suggestion.suggestedValue}" because ${basisLabel}: ${basisDetail}${provenance}${source}${tierLabel} Evidence strength: ${strength}.`;
}

export function generateChanges(
  issueType: IssueType,
  referenceContext: ReferenceContext = EMPTY_REFERENCE_CONTEXT,
  detected: DetectionResult = DETECTED
): ApprovedChange[] {
  const ts = new Date().toISOString();
  const changes: ApprovedChange[] = [];

  if (issueType === "missing_owner") {
    for (const item of detected.missingOwner) {
      const suggestion = contextualizeSuggestion(issueType, item.record, item.suggestion, referenceContext);
      changes.push({
        changeId: `CHG-${String(changeCounter++).padStart(3, "0")}`,
        recordId: item.record.record_id,
        accountName: item.record.account_name.trim(),
        field: "owner",
        before: item.ownerValue || "(blank)",
        after: changeValueForSuggestion(issueType, suggestion),
        issueType,
        timestamp: ts,
        riskLevel: "High",
        userDecision: decisionForSuggestion(suggestion),
        basisLabel: suggestion.basis?.label ?? "Based on record-only heuristic",
        basisStrength: suggestion.basis?.strength ?? "fallback",
        resolutionType: resolutionTypeForSuggestion(suggestion),
        evidenceDetail: evidenceDetailForSuggestion(issueType, suggestion),
      });
    }
  }

  if (issueType === "duplicate_accounts") {
    for (const cluster of detected.duplicates) {
      const nonCanonical = cluster.records.filter(r => r.record_id !== cluster.canonicalRecord?.record_id);
      for (const r of nonCanonical) {
        changes.push({
          changeId: `CHG-${String(changeCounter++).padStart(3, "0")}`,
          recordId: r.record_id,
          accountName: r.account_name.trim(),
          field: "harmoniq_review_status",
          before: "",
          after: `Duplicate review required; suggested canonical ${cluster.canonicalRecord?.record_id}`,
          issueType,
          timestamp: ts,
          riskLevel: "High",
          userDecision: "Flagged",
          basisLabel: "Based on domain clustering analysis",
          basisStrength: "direct",
          resolutionType: "unresolved_review_required",
          evidenceDetail: "Potential duplicate cluster identified from shared domain evidence. harmonIQ suggests a canonical record but does not auto-merge.",
        });
      }
    }
  }

  if (issueType === "invalid_email") {
    for (const item of detected.invalidEmails) {
      changes.push({
        changeId: `CHG-${String(changeCounter++).padStart(3, "0")}`,
        recordId: item.record.record_id,
        accountName: item.record.account_name.trim(),
        field: "email",
        before: item.emailValue || "(blank)",
        after: item.suggestedValue ?? "[Flagged - needs correction]",
        issueType,
        timestamp: ts,
        riskLevel: "Medium-High",
        userDecision: item.suggestedValue ? "Accepted" : "Flagged",
        basisLabel: item.suggestedValue ? "Based on email syntax repair" : "Flagged for manual correction",
        basisStrength: "deterministic",
        resolutionType: item.suggestedValue ? "deterministic_fix" : "unresolved_review_required",
        evidenceDetail: item.suggestedValue
          ? "Deterministic syntax repair produced a safe candidate from the account domain."
          : "No safe deterministic correction was available, so the record remains flagged for manual review.",
      });
    }
  }

  if (issueType === "missing_segment") {
    for (const item of detected.missingSegments) {
      const suggestion = contextualizeSuggestion(issueType, item.record, item.suggestion, referenceContext);
      changes.push({
        changeId: `CHG-${String(changeCounter++).padStart(3, "0")}`,
        recordId: item.record.record_id,
        accountName: item.record.account_name.trim(),
        field: "segment",
        before: item.segmentValue || "(blank)",
        after: changeValueForSuggestion(issueType, suggestion),
        issueType,
        timestamp: ts,
        riskLevel: "Medium-High",
        userDecision: decisionForSuggestion(suggestion),
        basisLabel: suggestion.basis?.label ?? "Based on record-only heuristic",
        basisStrength: suggestion.basis?.strength ?? "fallback",
        resolutionType: resolutionTypeForSuggestion(suggestion),
        evidenceDetail: evidenceDetailForSuggestion(issueType, suggestion),
      });
    }
  }

  if (issueType === "inconsistent_state") {
    for (const item of detected.inconsistentStates) {
      const suggestion = contextualizeSuggestion(issueType, item.record, item.suggestion, referenceContext);
      changes.push({
        changeId: `CHG-${String(changeCounter++).padStart(3, "0")}`,
        recordId: item.record.record_id,
        accountName: item.record.account_name.trim(),
        field: "state",
        before: item.currentValue,
        after: suggestion.suggestedValue,
        issueType,
        timestamp: ts,
        riskLevel: "Medium",
        userDecision: "Accepted",
        basisLabel: suggestion.basis?.label ?? "Based on deterministic normalization",
        basisStrength: suggestion.basis?.strength ?? "deterministic",
        resolutionType: resolutionTypeForSuggestion(suggestion),
        evidenceDetail: evidenceDetailForSuggestion(issueType, suggestion),
      });
    }
  }

  if (issueType === "naming_format") {
    for (const item of detected.namingFormat) {
      changes.push({
        changeId: `CHG-${String(changeCounter++).padStart(3, "0")}`,
        recordId: item.record.record_id,
        accountName: item.record.account_name.trim(),
        field: item.field,
        before: item.currentValue,
        after: item.suggestedValue,
        issueType,
        timestamp: ts,
        riskLevel: "Low",
        userDecision: "Accepted",
        basisLabel: "Based on deterministic normalization",
        basisStrength: "deterministic",
        resolutionType: "deterministic_fix",
        evidenceDetail: "Deterministic formatting cleanup normalized whitespace and casing without inferred business context.",
      });
    }
  }

  if (issueType === "schema_mismatch") {
    for (const item of detected.schemaMismatches) {
      changes.push({
        changeId: `CHG-${String(changeCounter++).padStart(3, "0")}`,
        recordId: "DATASET",
        accountName: "Dataset schema",
        field: "schema_mapping",
        before: item.source,
        after: item.expected,
        issueType,
        timestamp: ts,
        riskLevel: "Medium",
        userDecision: "Accepted",
        basisLabel: "Based on deterministic normalization",
        basisStrength: "deterministic",
        resolutionType: "deterministic_fix",
        evidenceDetail: "Deterministic schema mapping normalized supported field names for export.",
      });
    }
  }

  return changes;
}

export const ISSUE_TYPE_ORDER: IssueType[] = [
  "missing_owner",
  "duplicate_accounts",
  "invalid_email",
  "missing_segment",
  "inconsistent_state",
  "schema_mismatch",
  "naming_format",
];
