"use client";

import { useEffect, useState } from "react";
import type { IssueStatus, IssueType, ReferenceContext, ResolutionSuggestion, WorkflowMode } from "@/lib/types";
import type { ApprovedChange } from "@/lib/types";
import {
  fetchAIRecommendationWithStatus,
  type AIBasisType,
  type AIConfidenceBand,
  type AIRecommendationCandidate,
  type AIRecommendationFetchStatus,
  type AIRecommendationRequest,
  type AIRecommendationResult,
} from "@/lib/aiRecommendation";
import { DETECTED, generateChanges } from "@/lib/issueDetection";
import { contextualizeSuggestion, EMPTY_REFERENCE_CONTEXT, suggestionBasisLabel } from "@/lib/referenceContext";
import { getWorkflowImpactMetrics, getWorkflowIssueDefinitions, WORKFLOW_MODES } from "@/lib/workflows";
import Sidebar from "./Sidebar";
import {
  ConfidenceDots,
  DiffCell,
  DownstreamBox,
  ImpactMetricCard,
  IssueQueueItem,
  RationaleBlock,
  ScoreImpactBox,
  SeverityBadge,
  StatusPill,
  StickyDatasetHeader,
  WorkflowLabel,
  WorkflowModeSelector,
} from "./harmoniq-ui";

interface ReviewScreenProps {
  fileName: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  readinessScore: number;
  workflowMode: WorkflowMode;
  referenceContext: ReferenceContext;
  activeIssueType: IssueType;
  lastSavedAt: string;
  onWorkflowModeChange: (mode: WorkflowMode) => void;
  onApprove: (issueType: IssueType, changes: ApprovedChange[]) => void;
  onSkip: (issueType: IssueType) => void;
  onUndo: (issueType: IssueType) => void;
  onSelectIssue: (issueType: IssueType) => void;
  onSaveProgress: () => void;
  onFinish: () => void;
  onNavigate: (screen: "upload" | "profile" | "review" | "results") => void;
}

type FlagRow = {
  id: string;
  scope: string;
  current: string;
  issue: string;
  suggestedValue: string;
  confidence: number;
  rationale: string;
  reviewState: string;
  basis: string;
  basisDetail: string;
};

type DiffRow = {
  id: string;
  account: string;
  field: string;
  before: string;
  after: string;
  basis: string;
};

type ManualFixField = "owner" | "segment" | "email";

type ManualFixRow = {
  id: string;
  recordId: string;
  accountName: string;
  field: ManualFixField;
  fieldLabel: string;
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  rationale: string;
  basis: string;
  basisDetail: string;
  context: string;
};

type ManualDecision = "suggested" | "manual" | "unchanged";

let manualChangeCounter = 1;

/**
 * Returns true when a suggested value is a placeholder (no real evidence produced
 * a named value). These must not be pre-filled in drafts or accepted via
 * "Use suggestion" — the user must supply a value manually.
 */
function isPlaceholderSuggestion(value: string): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.startsWith("needs") ||
    lower.startsWith("awaiting") ||
    lower.startsWith("no strong") ||
    lower === "unassigned - review" ||
    lower === "flag for manual correction"
  );
}

function suggestionStateLabel(suggestion: ResolutionSuggestion): string {
  if (suggestion.reviewState === "deterministic") return "Deterministic";
  if (suggestion.reviewState === "needs_approval") return "Needs approval";
  return "Review required";
}

function formatSavedAt(iso: string): string {
  if (!iso) return "Not saved yet";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fallbackSuggestion(field: ResolutionSuggestion["field"], suggestedValue: string, rationale: string): ResolutionSuggestion {
  return {
    field,
    suggestedValue,
    confidence: 62,
    rationale,
    reviewState: "review_required",
    basis: {
      type: "record_heuristic",
      label: "Based on record-only heuristic",
      detail: "No active reference source produced a stronger candidate.",
      strength: "fallback",
    },
  };
}

function getFlagRows(type: IssueType, referenceContext: ReferenceContext): FlagRow[] {
  if (type === "missing_owner") {
    return DETECTED.missingOwner.map(({ record, ownerValue, suggestion }) => {
      const contextualSuggestion = contextualizeSuggestion(type, record, suggestion, referenceContext);
      return {
        id: record.record_id,
        scope: `${record.record_id} - ${record.account_name.trim()}`,
        current: ownerValue || "(blank)",
        issue: "Owner cannot be used for routing.",
        suggestedValue: contextualSuggestion.suggestedValue,
        confidence: contextualSuggestion.confidence,
        rationale: contextualSuggestion.rationale,
        reviewState: suggestionStateLabel(contextualSuggestion),
        basis: suggestionBasisLabel(contextualSuggestion),
        basisDetail: contextualSuggestion.basis?.detail ?? "",
      };
    });
  }

  if (type === "invalid_email") {
    return DETECTED.invalidEmails.map(({ record, emailValue, reason, suggestedValue }) => ({
      id: record.record_id,
      scope: `${record.record_id} - ${record.contact_name}`,
      current: emailValue || "(blank)",
      issue: reason,
      suggestedValue: suggestedValue ?? "Flag for manual correction",
      confidence: suggestedValue ? 91 : 48,
      rationale: suggestedValue
        ? "Obvious syntax repair matches the account domain and keeps the correction reviewable."
        : "No safe correction is available from the current fields.",
      reviewState: suggestedValue ? "Needs approval" : "Review required",
      basis: "Based on record-only heuristic",
      basisDetail: "Uses deterministic email syntax checks and account domain only.",
    }));
  }

  if (type === "missing_segment") {
    return DETECTED.missingSegments.map(({ record, segmentValue, suggestion }) => {
      const contextualSuggestion = contextualizeSuggestion(type, record, suggestion, referenceContext);
      return {
        id: record.record_id,
        scope: `${record.record_id} - ${record.account_name.trim()}`,
        current: segmentValue || "(blank)",
        issue: "Segment is unavailable for planning and routing rules.",
        suggestedValue: contextualSuggestion.suggestedValue,
        confidence: contextualSuggestion.confidence,
        rationale: contextualSuggestion.rationale,
        reviewState: suggestionStateLabel(contextualSuggestion),
        basis: suggestionBasisLabel(contextualSuggestion),
        basisDetail: contextualSuggestion.basis?.detail ?? "",
      };
    });
  }

  if (type === "schema_mismatch") {
    return DETECTED.schemaMismatches.map((item) => ({
      id: item.source,
      scope: `${item.scope}: ${item.source}`,
      current: item.source,
      issue: item.reason,
      suggestedValue: item.suggestion?.suggestedValue ?? `Map to ${item.expected}`,
      confidence: item.suggestion?.confidence ?? 93,
      rationale: item.suggestion?.rationale ?? item.impact,
      reviewState: item.suggestion ? suggestionStateLabel(item.suggestion) : "Deterministic",
      basis: "Based on deterministic normalization",
      basisDetail: "Schema mappings are derived from source column names and supported issue checks.",
    }));
  }

  return [];
}

function getDiffRows(type: IssueType, referenceContext: ReferenceContext): DiffRow[] {
  if (type === "inconsistent_state") {
    return DETECTED.inconsistentStates.map(({ record, currentValue, suggestion }) => {
      const contextualSuggestion = contextualizeSuggestion(type, record, suggestion, referenceContext);
      return {
        id: `${record.record_id}-state`,
        account: record.account_name.trim(),
        field: "state",
        before: currentValue,
        after: contextualSuggestion.suggestedValue,
        basis: `${contextualSuggestion.confidence}% confidence - ${suggestionBasisLabel(contextualSuggestion)}. ${contextualSuggestion.rationale}`,
      };
    });
  }

  if (type === "naming_format") {
    return DETECTED.namingFormat.map(({ record, field, currentValue, suggestedValue, reason }) => ({
      id: `${record.record_id}-${field}`,
      account: record.account_name.trim(),
      field: field === "account_name" ? "account_name" : "contact_name",
      before: currentValue,
      after: suggestedValue,
      basis: reason,
    }));
  }

  return [];
}

function getSuggestionPreview(type: IssueType, referenceContext: ReferenceContext): ResolutionSuggestion | null {
  if (type === "missing_owner") {
    const item = DETECTED.missingOwner[0];
    return item ? contextualizeSuggestion(type, item.record, item.suggestion, referenceContext) : null;
  }
  if (type === "missing_segment") {
    const item = DETECTED.missingSegments[0];
    return item ? contextualizeSuggestion(type, item.record, item.suggestion, referenceContext) : null;
  }
  if (type === "inconsistent_state") {
    const item = DETECTED.inconsistentStates[0];
    return item ? contextualizeSuggestion(type, item.record, item.suggestion, referenceContext) : null;
  }
  if (type === "invalid_email") return DETECTED.invalidEmails.find((item) => item.suggestion)?.suggestion
    ?? fallbackSuggestion("email", "Flag for correction", "Some invalid emails cannot be corrected safely from available fields.");
  if (type === "schema_mismatch") return DETECTED.schemaMismatches.find((item) => item.suggestion)?.suggestion
    ?? fallbackSuggestion("schema_mapping", "Confirm mapping", "Source-to-canonical field mapping is visible for review.");
  return null;
}

function supportsManualFix(type: IssueType): boolean {
  return type === "missing_owner" || type === "missing_segment" || type === "invalid_email";
}

function getManualFixRows(type: IssueType, referenceContext: ReferenceContext): ManualFixRow[] {
  if (type === "missing_owner") {
    return DETECTED.missingOwner.map(({ record, ownerValue, suggestion }) => {
      const contextualSuggestion = contextualizeSuggestion(type, record, suggestion, referenceContext);
      return {
        id: record.record_id,
        recordId: record.record_id,
        accountName: record.account_name.trim(),
        field: "owner",
        fieldLabel: "Owner",
        currentValue: ownerValue,
        suggestedValue: contextualSuggestion.suggestedValue,
        confidence: contextualSuggestion.confidence,
        rationale: contextualSuggestion.rationale,
        basis: suggestionBasisLabel(contextualSuggestion),
        basisDetail: contextualSuggestion.basis?.detail ?? "",
        context: `${record.segment || "No segment"} · ${record.state || "No state"}`,
      };
    });
  }

  if (type === "missing_segment") {
    return DETECTED.missingSegments.map(({ record, segmentValue, suggestion }) => {
      const contextualSuggestion = contextualizeSuggestion(type, record, suggestion, referenceContext);
      return {
        id: record.record_id,
        recordId: record.record_id,
        accountName: record.account_name.trim(),
        field: "segment",
        fieldLabel: "Segment",
        currentValue: segmentValue,
        suggestedValue: contextualSuggestion.suggestedValue,
        confidence: contextualSuggestion.confidence,
        rationale: contextualSuggestion.rationale,
        basis: suggestionBasisLabel(contextualSuggestion),
        basisDetail: contextualSuggestion.basis?.detail ?? "",
        context: `${record.owner || "No owner"} · ${record.state || "No state"}`,
      };
    });
  }

  if (type === "invalid_email") {
    return DETECTED.invalidEmails.map(({ record, emailValue, reason, suggestedValue, suggestion }) => ({
      id: record.record_id,
      recordId: record.record_id,
      accountName: record.account_name.trim(),
      field: "email",
      fieldLabel: "Email",
      currentValue: emailValue,
      suggestedValue: suggestedValue ?? "",
      confidence: suggestion?.confidence ?? 48,
      rationale: suggestion?.rationale ?? "No safe correction was inferred from the available CRM fields.",
      basis: "Based on record-only heuristic",
      basisDetail: "Uses email syntax and domain evidence only.",
      context: `${record.contact_name} · ${reason}`,
    }));
  }

  return [];
}

function buildManualChange(
  issueType: IssueType,
  row: ManualFixRow,
  value: string,
  decision: ManualDecision,
  riskLevel: ApprovedChange["riskLevel"]
): ApprovedChange {
  const changeId = `MAN-${String(manualChangeCounter++).padStart(3, "0")}`;
  const timestamp = new Date().toISOString();

  if (decision === "unchanged") {
    return {
      changeId,
      recordId: row.recordId,
      accountName: row.accountName,
      field: "harmoniq_review_status",
      before: "",
      after: `Manual exception reviewed: ${row.fieldLabel} left unchanged`,
      issueType,
      timestamp,
      riskLevel,
      userDecision: "Flagged",
      basisLabel: "Manual exception reviewed",
      basisStrength: "fallback",
      resolutionType: "unresolved_review_required",
      evidenceDetail: "Reviewer inspected the affected record and left the field unchanged for follow-up.",
    };
  }

  return {
    changeId,
    recordId: row.recordId,
    accountName: row.accountName,
    field: row.field,
    before: row.currentValue || "(blank)",
    after: value.trim(),
    issueType,
    timestamp,
    riskLevel,
    userDecision: "Accepted",
    basisLabel: decision === "suggested" ? row.basis : "Manual override",
    basisStrength: decision === "suggested" ? "strong" : "fallback",
    resolutionType: "manual_override",
    evidenceDetail: decision === "suggested"
      ? `${row.basisDetail || row.rationale} Reviewer explicitly selected the suggested value in manual exception handling.`
      : "Reviewer manually entered this value in the constrained exception workflow.",
  };
}

// ─── AI recommendation helpers ───────────────────────────────────────────────

const AI_ISSUE_TYPES = new Set<IssueType>(["missing_owner", "missing_segment"]);

const BASIS_RANK: Record<AIBasisType, number> = {
  direct_rule: 4,
  reference_pattern: 3,
  dataset_pattern: 2,
  weak_heuristic: 1,
  no_basis: 0,
};

function normalizeCompare(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeState(value: string | undefined): string {
  const state = normalizeCompare(value);
  const map: Record<string, string> = {
    california: "CA", calif: "CA", "calif.": "CA", cal: "CA",
    washington: "WA", wash: "WA", "wash.": "WA",
    oregon: "OR",
    texas: "TX", tex: "TX", "tex.": "TX",
    florida: "FL", "fla.": "FL", georgia: "GA",
    "new york": "NY", "n.y.": "NY", "n.y": "NY", "newyork": "NY",
    "new jersey": "NJ", "n.j.": "NJ", virginia: "VA",
    illinois: "IL", ill: "IL", "ill.": "IL",
  };
  if (!state) return "";
  if (/^[a-z]{2}$/.test(state)) return state.toUpperCase();
  return map[state] ?? "";
}

function regionForState(value: string | undefined): string {
  const state = normalizeState(value);
  if (["CA", "WA", "OR"].includes(state)) return "West";
  if (["TX", "FL", "GA"].includes(state)) return "South";
  if (["NY", "NJ", "VA"].includes(state)) return "Northeast";
  if (["IL", "OH", "MI", "MN", "CO"].includes(state)) return "Central";
  return "";
}

function canonicalSegment(value: string | undefined): string {
  const segment = normalizeCompare(value);
  if (segment === "smb" || segment === "small business") return "SMB";
  if (segment === "mid-market" || segment === "mid market" || segment === "growth") return "Mid-Market";
  if (segment === "enterprise" || segment === "strategic") return "Enterprise";
  return (value ?? "").trim();
}

function sourceActive(ctx: ReferenceContext, type: "ownership_rules" | "segment_dictionary" | "crm_reference"): boolean {
  return ctx.sources.some((source) => source.type === type && source.active);
}

function basisStrengthToAIBasisType(strength: string | undefined): AIBasisType {
  if (strength === "direct" || strength === "deterministic") return "direct_rule";
  if (strength === "strong") return "reference_pattern";
  if (strength === "fallback") return "weak_heuristic";
  return "no_basis";
}

function basisToConfidenceBand(basisType: AIBasisType): AIConfidenceBand {
  if (basisType === "direct_rule") return "high";
  if (basisType === "reference_pattern" || basisType === "dataset_pattern") return "medium";
  if (basisType === "weak_heuristic") return "low";
  return "insufficient";
}

function upsertCandidate(candidates: Map<string, AIRecommendationCandidate>, candidate: AIRecommendationCandidate) {
  const current = candidates.get(candidate.value);
  if (!current || BASIS_RANK[candidate.basisType] > BASIS_RANK[current.basisType]) {
    candidates.set(candidate.value, candidate);
  }
}

function addExistingSuggestionCandidate(
  candidates: Map<string, AIRecommendationCandidate>,
  preview: ResolutionSuggestion
) {
  if (isPlaceholderSuggestion(preview.suggestedValue)) return;
  const basisType = basisStrengthToAIBasisType(preview.basis?.strength);
  upsertCandidate(candidates, {
    value: preview.suggestedValue,
    basisType,
    basisLabel: suggestionBasisLabel(preview),
    basisDetail: preview.basis?.detail ?? "Candidate produced by deterministic harmonIQ issue logic.",
    confidenceBand: basisToConfidenceBand(basisType),
    source: preview.basis?.sourceName ?? "Deterministic issue logic",
    matchSummary: `${preview.confidence}% deterministic confidence; ${preview.reviewState.replace(/_/g, " ")}.`,
  });
}

function buildDatasetOwnerSignals(recordDomain: string) {
  return DETECTED.duplicates
    .filter((cluster) => normalizeCompare(cluster.domain) === normalizeCompare(recordDomain))
    .flatMap((cluster) => cluster.records)
    .filter((record) => record.owner && !isPlaceholderSuggestion(record.owner))
    .map((record) => ({
      value: record.owner,
      detail: `${record.record_id} shares domain ${record.domain}`,
    }));
}

function buildDatasetSegmentSignals(recordDomain: string) {
  return DETECTED.duplicates
    .filter((cluster) => normalizeCompare(cluster.domain) === normalizeCompare(recordDomain))
    .flatMap((cluster) => cluster.records)
    .filter((record) => record.segment && !isPlaceholderSuggestion(record.segment))
    .map((record) => ({
      value: canonicalSegment(record.segment),
      detail: `${record.record_id} shares domain ${record.domain}`,
    }));
}

function buildAIRecommendationEvidencePackage(
  issueType: IssueType,
  record: { account_name: string; domain: string; state: string; segment: string },
  preview: ResolutionSuggestion,
  ctx: ReferenceContext
): { candidateValues: string[]; candidates: AIRecommendationCandidate[]; currentDatasetSignals: string[] } {
  const candidates = new Map<string, AIRecommendationCandidate>();
  const currentDatasetSignals: string[] = [];
  const recordRegion = regionForState(record.state);
  const recordSegment = canonicalSegment(record.segment || preview.suggestedValue);

  addExistingSuggestionCandidate(candidates, preview);

  if (issueType === "missing_owner") {
    if (sourceActive(ctx, "ownership_rules")) {
      for (const rule of ctx.ownershipRules) {
        if (!rule.owner || isPlaceholderSuggestion(rule.owner)) continue;
        const ruleRegion = normalizeCompare(rule.region || rule.territory);
        const regionMatches = recordRegion && (ruleRegion === normalizeCompare(recordRegion) || normalizeCompare(rule.territory).includes(normalizeCompare(recordRegion)));
        const segmentMatches = rule.segment && normalizeCompare(rule.segment) === normalizeCompare(recordSegment);
        if (!regionMatches && !segmentMatches) continue;
        const basisType: AIBasisType = regionMatches && segmentMatches ? "direct_rule" : "weak_heuristic";
        upsertCandidate(candidates, {
          value: rule.owner,
          basisType,
          basisLabel: regionMatches && segmentMatches ? "Ownership rule match" : "Partial ownership rule match",
          basisDetail: `${rule.territory || rule.region || "Routing rule"}${rule.segment ? ` / ${rule.segment}` : ""}${rule.queue ? ` / ${rule.queue}` : ""}`,
          confidenceBand: basisToConfidenceBand(basisType),
          source: rule.sourceName,
          matchSummary: regionMatches && segmentMatches
            ? "Rule matches both account region and segment."
            : "Rule matches only part of the account context; review carefully.",
        });
      }
    }

    if (sourceActive(ctx, "crm_reference")) {
      for (const row of ctx.crmReferenceRows) {
        if (!row.owner || isPlaceholderSuggestion(row.owner)) continue;
        const domainMatches = normalizeCompare(row.domain) && normalizeCompare(row.domain) === normalizeCompare(record.domain);
        const accountMatches = normalizeCompare(row.account) && normalizeCompare(record.account_name).includes(normalizeCompare(row.account));
        if (!domainMatches && !accountMatches) continue;
        upsertCandidate(candidates, {
          value: row.owner,
          basisType: "reference_pattern",
          basisLabel: "Clean CRM reference match",
          basisDetail: `${row.account || "Reference account"} / ${row.domain || "no domain"} / ${row.territory || "no territory"}`,
          confidenceBand: "medium",
          source: row.sourceName,
          matchSummary: domainMatches ? "Reference row matches account domain." : "Reference row matches account name.",
        });
      }
    }

    for (const signal of buildDatasetOwnerSignals(record.domain)) {
      currentDatasetSignals.push(`${signal.value}: ${signal.detail}`);
      upsertCandidate(candidates, {
        value: signal.value,
        basisType: "dataset_pattern",
        basisLabel: "Current dataset duplicate pattern",
        basisDetail: signal.detail,
        confidenceBand: "medium",
        source: "Uploaded CRM dataset",
        matchSummary: "Same-domain record in the uploaded dataset has this owner populated.",
      });
    }
  }

  if (issueType === "missing_segment") {
    if (sourceActive(ctx, "segment_dictionary")) {
      for (const entry of ctx.segmentDictionary) {
        const values = [entry.segment, ...entry.allowedValues].filter(Boolean).map(canonicalSegment);
        for (const value of values) {
          upsertCandidate(candidates, {
            value,
            basisType: normalizeCompare(value) === normalizeCompare(preview.suggestedValue) ? "direct_rule" : "weak_heuristic",
            basisLabel: "Approved segment taxonomy",
            basisDetail: `${entry.definition || "Allowed segment"}${entry.lifecycleStage ? ` / ${entry.lifecycleStage}` : ""}`,
            confidenceBand: normalizeCompare(value) === normalizeCompare(preview.suggestedValue) ? "high" : "low",
            source: entry.sourceName,
            matchSummary: normalizeCompare(value) === normalizeCompare(preview.suggestedValue)
              ? "Deterministic candidate is present in the approved dictionary."
              : "Allowed taxonomy option, but not directly matched to this row.",
          });
        }
      }
    } else {
      for (const value of ["Enterprise", "Mid-Market", "SMB"]) {
        upsertCandidate(candidates, {
          value,
          basisType: normalizeCompare(value) === normalizeCompare(preview.suggestedValue) ? "weak_heuristic" : "no_basis",
          basisLabel: "Default segment taxonomy",
          basisDetail: "Built-in harmonIQ segment set used when no dictionary is attached.",
          confidenceBand: normalizeCompare(value) === normalizeCompare(preview.suggestedValue) ? "low" : "insufficient",
          source: "Default CRM taxonomy",
          matchSummary: normalizeCompare(value) === normalizeCompare(preview.suggestedValue)
            ? "Matches deterministic heuristic."
            : "Available bounded value with no row-specific evidence.",
        });
      }
    }

    if (sourceActive(ctx, "crm_reference")) {
      for (const row of ctx.crmReferenceRows) {
        if (!row.segment || isPlaceholderSuggestion(row.segment)) continue;
        const domainMatches = normalizeCompare(row.domain) && normalizeCompare(row.domain) === normalizeCompare(record.domain);
        const accountMatches = normalizeCompare(row.account) && normalizeCompare(record.account_name).includes(normalizeCompare(row.account));
        if (!domainMatches && !accountMatches) continue;
        upsertCandidate(candidates, {
          value: canonicalSegment(row.segment),
          basisType: "reference_pattern",
          basisLabel: "Clean CRM reference match",
          basisDetail: `${row.account || "Reference account"} / ${row.domain || "no domain"} / ${row.territory || "no territory"}`,
          confidenceBand: "medium",
          source: row.sourceName,
          matchSummary: domainMatches ? "Reference row matches account domain." : "Reference row matches account name.",
        });
      }
    }

    for (const signal of buildDatasetSegmentSignals(record.domain)) {
      currentDatasetSignals.push(`${signal.value}: ${signal.detail}`);
      upsertCandidate(candidates, {
        value: signal.value,
        basisType: "dataset_pattern",
        basisLabel: "Current dataset duplicate pattern",
        basisDetail: signal.detail,
        confidenceBand: "medium",
        source: "Uploaded CRM dataset",
        matchSummary: "Same-domain record in the uploaded dataset has this segment populated.",
      });
    }
  }

  const sortedCandidates = [...candidates.values()].sort((a, b) => BASIS_RANK[b.basisType] - BASIS_RANK[a.basisType]);
  return {
    candidates: sortedCandidates,
    candidateValues: sortedCandidates.map((candidate) => candidate.value),
    currentDatasetSignals,
  };
}

function aiAuditedRecordId(issueType: IssueType): string | undefined {
  if (issueType === "missing_owner") return DETECTED.missingOwner[0]?.record.record_id;
  if (issueType === "missing_segment") return DETECTED.missingSegments[0]?.record.record_id;
  return undefined;
}

function aiAuditedField(issueType: IssueType): string | undefined {
  if (issueType === "missing_owner") return "owner";
  if (issueType === "missing_segment") return "segment";
  return undefined;
}

function candidateDecisionLabel(
  candidate: AIRecommendationCandidate,
  recommendation: AIRecommendationResult
): "Selected" | "Rejected" | "Review" {
  if (recommendation.recommendedValue === candidate.value) return "Selected";
  if (recommendation.manualReviewRequired && !recommendation.recommendedValue) return "Review";
  return "Rejected";
}

function candidateReason(
  candidate: AIRecommendationCandidate,
  recommendation: AIRecommendationResult
): string {
  if (recommendation.recommendedValue === candidate.value) {
    return candidate.matchSummary || "Best supported candidate in the bounded set.";
  }

  if (candidate.basisType === "direct_rule") {
    return "A stronger or more specific rule/reference candidate was selected.";
  }

  if (candidate.basisType === "reference_pattern") {
    return "Not selected because a stronger direct rule or better matching reference candidate was available.";
  }

  if (candidate.basisType === "dataset_pattern") {
    return "Not selected because current-dataset evidence is weaker than rule or trusted reference evidence.";
  }

  if (candidate.basisType === "weak_heuristic") {
    return "Rejected because it lacked a complete territory, segment, state, domain, or reference match.";
  }

  return "Rejected because no supporting business evidence matched this record.";
}

function candidateComparisonSummary(
  recommendation: AIRecommendationResult | null,
  candidates: AIRecommendationCandidate[]
): string | undefined {
  if (!recommendation || candidates.length === 0) return undefined;
  const selected = recommendation.recommendedValue ?? "none";
  const rejected = candidates
    .filter((candidate) => candidate.value !== recommendation.recommendedValue)
    .slice(0, 4)
    .map((candidate) => `${candidate.value}: ${candidateReason(candidate, recommendation)}`);
  return `Selected: ${selected}. Rejected: ${rejected.length > 0 ? rejected.join(" | ") : "none"}.`;
}

function unresolvedValueForIssue(issueType: IssueType): string {
  if (issueType === "missing_owner") return "Needs manual assignment";
  if (issueType === "missing_segment") return "Needs segment review";
  return "[Flagged - review required]";
}

function annotateChangesWithAIReview(
  changes: ApprovedChange[],
  issueType: IssueType,
  recommendation: AIRecommendationResult | null,
  candidates: AIRecommendationCandidate[]
): ApprovedChange[] {
  if (!recommendation || !AI_ISSUE_TYPES.has(issueType)) return changes;

  const primaryRecordId = aiAuditedRecordId(issueType);
  const field = aiAuditedField(issueType);
  if (!primaryRecordId || !field) return changes;
  const candidateComparison = candidateComparisonSummary(recommendation, candidates);

  return changes.map((change) => {
    // Only process changes for the same issue type and field.
    if (change.issueType !== issueType || change.field !== field) return change;

    // ── Primary record: the one whose context was actually sent to AI ──
    if (change.recordId === primaryRecordId) {
      if (recommendation.recommendedValue) {
        return {
          ...change,
          after: recommendation.recommendedValue,
          userDecision: "Accepted",
          resolutionType: "ai_reviewed",
          basisLabel: "AI-reviewed recommendation",
          evidenceDetail: `AI reviewed ${candidates.length} bounded candidates and selected "${recommendation.recommendedValue}" from ${recommendation.basisType.replace(/_/g, " ")} evidence. ${recommendation.evidenceSummary}`,
          aiCandidateCount: candidates.length,
          candidateComparison,
        };
      }

      if (recommendation.manualReviewRequired) {
        return {
          ...change,
          after: unresolvedValueForIssue(issueType),
          userDecision: "Flagged",
          resolutionType: "unresolved_review_required",
          evidenceDetail: `AI reviewed ${candidates.length} bounded candidates and declined to select a trusted value. ${recommendation.cautionNote ?? recommendation.evidenceSummary}`,
          aiCandidateCount: candidates.length,
          candidateComparison,
        };
      }

      return change;
    }

    // ── Other records in the same issue type ──
    // Their own deterministic / reference resolution type and `after` value are
    // correct for their specific record context. We add aiCandidateCount so that
    // every row in the transformation log shows that AI reviewed this issue, and
    // we append a brief note to evidenceDetail for full audit transparency.
    return {
      ...change,
      aiCandidateCount: candidates.length,
      evidenceDetail: [
        change.evidenceDetail ?? "",
        `AI reviewed ${candidates.length} bounded candidates for this issue type (representative context: ${primaryRecordId}); this record's value is from its individual deterministic/reference evidence.`,
      ].filter(Boolean).join(" "),
    };
  });
}

// ─── AI Recommendation Panel ─────────────────────────────────────────────────

const CONFIDENCE_BAND_COLORS: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-indigo-100 text-indigo-800 border-indigo-200",
  low: "bg-amber-100 text-amber-800 border-amber-200",
  insufficient: "bg-slate-100 text-slate-600 border-slate-200",
};

function AIRecommendationPanel({
  recommendation,
  provider,
  candidates,
  deterministicValue,
}: {
  recommendation: AIRecommendationResult;
  provider?: "openai";
  candidates: AIRecommendationCandidate[];
  deterministicValue: string;
}) {
  const bandColor = CONFIDENCE_BAND_COLORS[recommendation.confidenceBand] ?? CONFIDENCE_BAND_COLORS.insufficient;
  const selectedCandidate = candidates.find((candidate) => candidate.value === recommendation.recommendedValue);
  const shownCandidates = candidates.slice(0, 5);

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">AI recommendation loaded</p>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1 7 4.5 10.5 5.5 7 6.5 6 10 5 6.5 1.5 5.5 5 4.5Z" fill="currentColor" className="text-violet-400" />
          </svg>
        </div>
        {provider ? (
          <span className="rounded-full border border-violet-200 bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
            OpenAI
          </span>
        ) : null}
      </div>

      {recommendation.recommendedValue ? (
        <div className="mt-2 rounded-md border border-violet-200 bg-white/70 px-2 py-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Selected candidate</p>
          <p className="mt-0.5 text-sm font-black text-violet-950">{recommendation.recommendedValue}</p>
          {selectedCandidate ? (
            <p className="mt-1 text-[11px] leading-relaxed text-violet-700">{selectedCandidate.matchSummary}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs font-bold italic text-amber-700">Manual review required — insufficient evidence</p>
      )}

      <div className="mt-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${bandColor}`}>
          {recommendation.confidenceBand} confidence
        </span>
        <span className="ml-1.5 rounded-full border border-violet-200 bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
          Basis: {recommendation.basisType.replace(/_/g, " ")}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-violet-900">{recommendation.rationale}</p>
      {recommendation.manualReviewRequired ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800">
          Manual review required before this value can be trusted for export.
        </p>
      ) : null}

      <div className="mt-2 rounded-md border border-violet-100 bg-white/60 p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-500">Bounded candidates reviewed</p>
          <span className="text-[10px] font-bold text-violet-600">AI compared {candidates.length}</span>
        </div>
        <div className="mt-1.5 space-y-1">
          {shownCandidates.map((candidate) => {
            const decision = candidateDecisionLabel(candidate, recommendation);
            const isSelected = decision === "Selected";
            const isReview = decision === "Review";
            return (
              <div
                key={`${candidate.value}-${candidate.source}`}
                className={`rounded border px-2 py-1.5 ${
                  isSelected
                    ? "border-violet-200 bg-violet-50"
                    : isReview
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-100 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`truncate text-[11px] font-bold ${isSelected ? "text-violet-800" : "text-slate-700"}`}>
                      {candidate.value}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">{candidate.basisLabel} · {candidate.source}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      isSelected
                        ? "border-violet-200 bg-white text-violet-700"
                        : isReview
                        ? "border-amber-200 bg-white text-amber-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                    >
                      {decision}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                      {candidate.confidenceBand}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
                  {/* Prefer the model's own rejection reason when available */}
                  {recommendation.rejectedCandidateSummary.find((entry) =>
                    entry.toLowerCase().startsWith(candidate.value.toLowerCase() + ":")
                  )?.replace(/^[^:]+:\s*/, "") ?? candidateReason(candidate, recommendation)}
                </p>
                {candidate.basisDetail ? (
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">Signal: {candidate.basisDetail}</p>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-violet-700">
          Deterministic preview: {deterministicValue || "No deterministic value"}. AI output is not applied until the issue type is approved.
        </p>
      </div>

      {recommendation.evidenceSummary ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-violet-700">{recommendation.evidenceSummary}</p>
      ) : null}

      {recommendation.cautionNote ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800">
          ⚠ {recommendation.cautionNote}
        </p>
      ) : null}

      {recommendation.manualReviewRequired && !recommendation.recommendedValue ? (
        <p className="mt-2 text-[11px] font-bold text-amber-700">Assign this field manually before export.</p>
      ) : null}
    </section>
  );
}

function AIFallbackPanel({
  status,
  message,
}: {
  status: Exclude<AIRecommendationFetchStatus, "loaded">;
  message: string;
}) {
  const title = status === "unavailable" ? "AI unavailable" : "AI fallback active";

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{message}</p>
      <p className="mt-2 text-[11px] font-bold text-slate-500">
        Deterministic and reference-derived recommendations remain visible for approval.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function FlagTable({ issueType, referenceContext }: { issueType: IssueType; referenceContext: ReferenceContext }) {
  const rows = getFlagRows(issueType, referenceContext);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50/90">
            <tr className="border-b border-slate-200">
              {["Scope", "Current value", "Candidate fill", "Confidence", "Rationale", "Review state"].map((heading) => (
                <th key={heading} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.slice(0, 12).map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs font-bold text-slate-800">{row.scope}</td>
                <td className="px-4 py-3">
                  <span className="rounded border border-red-200 bg-red-50 px-2 py-1 font-mono text-xs text-red-700">{row.current}</span>
                </td>
                <td className="px-4 py-3 text-xs font-semibold">
                  {isPlaceholderSuggestion(row.suggestedValue)
                    ? <span className="italic text-amber-700">{row.suggestedValue}</span>
                    : <span className="text-slate-800">{row.suggestedValue}</span>}
                </td>
                <td className="px-4 py-3">
                  <ConfidenceDots pct={row.confidence} />
                </td>
                <td className="px-4 py-3 text-xs leading-relaxed text-slate-600">
                  <p>{row.rationale}</p>
                  <p className="mt-1 font-bold text-indigo-700">{row.basis}</p>
                  {row.basisDetail ? <p className="mt-0.5 text-[11px] text-slate-400">{row.basisDetail}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${
                    isPlaceholderSuggestion(row.suggestedValue)
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    {row.reviewState}
                  </span>
                  <p className="mt-1 text-[11px] text-slate-400">{row.issue}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 12 ? (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
          Showing 12 of {rows.length} findings. Full detail is included in the exported change summary.
        </div>
      ) : null}
    </div>
  );
}

function DiffTable({ issueType, referenceContext }: { issueType: IssueType; referenceContext: ReferenceContext }) {
  const rows = getDiffRows(issueType, referenceContext);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-emerald-100 bg-emerald-50 px-3 py-2">
        <p className="text-xs font-semibold text-emerald-800">Deterministic correction · reversible before export</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50/90">
            <tr className="border-b border-slate-200">
              {["Record", "Field", "Before / After", "Basis"].map((heading) => (
                <th key={heading} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.slice(0, 14).map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs font-bold text-slate-800">{row.account}</td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-700">{row.field}</td>
                <td className="px-4 py-3">
                  <DiffCell before={row.before} after={row.after} />
                </td>
                <td className="px-4 py-3 text-xs leading-relaxed text-slate-600">{row.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 14 ? (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
          Showing 14 of {rows.length} deterministic changes. Full detail is included in the exported change summary.
        </div>
      ) : null}
    </div>
  );
}

function ClusterView() {
  return (
    <div className="space-y-3">
      {DETECTED.duplicates.map((cluster, index) => (
        <section key={cluster.domain} className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cluster {index + 1}</p>
              <p className="text-sm font-black text-slate-900">{cluster.domain}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-700">
                {cluster.confidence}% match confidence
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
                No auto-merge
              </span>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3">
            {cluster.records.map((record) => {
              const isCanonical = record.record_id === cluster.canonicalRecord?.record_id;
              return (
                <div
                  key={record.record_id}
                  className={`rounded-lg border p-3 ${
                    isCanonical ? "border-emerald-300 bg-emerald-50" : "border-orange-200 bg-orange-50/60"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500">{record.record_id}</span>
                    {isCanonical ? (
                      <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                        Suggested canonical
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-black text-slate-900">{record.account_name.trim()}</p>
                  <dl className="mt-3 space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Owner</dt>
                      <dd className="font-semibold">{record.owner || "(blank)"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Phone</dt>
                      <dd className="font-mono">{record.phone}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">State</dt>
                      <dd className="font-mono">{record.state}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RecordPreview({ issueType, referenceContext }: { issueType: IssueType; referenceContext: ReferenceContext }) {
  if (issueType === "duplicate_accounts") return <ClusterView />;
  if (issueType === "inconsistent_state" || issueType === "naming_format") return <DiffTable issueType={issueType} referenceContext={referenceContext} />;
  return <FlagTable issueType={issueType} referenceContext={referenceContext} />;
}

function ManualFixDrawer({
  issueType,
  title,
  riskLevel,
  rows,
  onClose,
  onSave,
}: {
  issueType: IssueType;
  title: string;
  riskLevel: ApprovedChange["riskLevel"];
  rows: ManualFixRow[];
  onClose: () => void;
  onSave: (changes: ApprovedChange[]) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, { value: string; decision: ManualDecision }>>(() => (
    Object.fromEntries(rows.map((row) => [
      row.id,
      {
        // Placeholder suggestions must not be pre-filled — start as unchanged
        // so the user is not accidentally accepting a non-evidenced value.
        value: (row.suggestedValue && !isPlaceholderSuggestion(row.suggestedValue))
          ? row.suggestedValue
          : row.currentValue,
        decision: (row.suggestedValue && !isPlaceholderSuggestion(row.suggestedValue))
          ? "suggested"
          : "unchanged",
      },
    ]))
  ));

  const updateDraft = (row: ManualFixRow, value: string, decision: ManualDecision) => {
    setDrafts((current) => ({
      ...current,
      [row.id]: { value, decision },
    }));
  };

  const useAllSuggestions = () => {
    setDrafts(Object.fromEntries(rows.map((row) => [
      row.id,
      {
        value: (row.suggestedValue && !isPlaceholderSuggestion(row.suggestedValue))
          ? row.suggestedValue
          : row.currentValue,
        decision: (row.suggestedValue && !isPlaceholderSuggestion(row.suggestedValue))
          ? "suggested"
          : "unchanged",
      },
    ])));
  };

  const changedCount = rows.filter((row) => {
    const draft = drafts[row.id];
    return draft && draft.decision !== "unchanged" && draft.value.trim() !== (row.currentValue || "").trim();
  }).length;

  const exceptionCount = rows.length - changedCount;

  const hasInvalidManualValue = rows.some((row) => {
    const draft = drafts[row.id];
    return draft?.decision !== "unchanged" && !draft?.value.trim();
  });

  const save = () => {
    const changes = rows.map((row) => {
      const draft = drafts[row.id] ?? { value: row.currentValue, decision: "unchanged" as ManualDecision };
      return buildManualChange(issueType, row, draft.value, draft.decision, riskLevel);
    });
    onSave(changes);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[1px]">
      <button type="button" className="min-w-0 flex-1 cursor-default" aria-label="Close manual fix drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-5xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Manual exception handling</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                Edit only the affected field for identified records. Suggestions stay reviewable; saving creates an auditable override log.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Close manual fix drawer"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">
              {rows.length} affected records
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
              {changedCount} field edits
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
              {exceptionCount} reviewed exceptions
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Affected records only</p>
            <button
              type="button"
              onClick={useAllSuggestions}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
            >
              Use all suggestions
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((row) => {
              const draft = drafts[row.id] ?? { value: row.currentValue, decision: "unchanged" as ManualDecision };
              const isUnchanged = draft.decision === "unchanged";

              return (
                <section key={row.id} className="rounded-lg border border-slate-200 bg-white p-3.5">
                  <div className="grid gap-3.5 xl:grid-cols-[0.95fr_1.05fr]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-500">{row.recordId}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {row.fieldLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-black text-slate-950">{row.accountName}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.context}</p>
                      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="font-bold uppercase tracking-wide text-slate-400">Current value</dt>
                          <dd className="mt-1 rounded border border-red-200 bg-red-50 px-2 py-1 font-mono text-red-700">
                            {row.currentValue || "(blank)"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wide text-slate-400">Suggested value</dt>
                          {isPlaceholderSuggestion(row.suggestedValue) ? (
                            <dd className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold italic text-amber-800">
                              {row.suggestedValue || "No evidence-based suggestion"}
                            </dd>
                          ) : (
                            <dd className="mt-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-semibold text-indigo-800">
                              {row.suggestedValue}
                            </dd>
                          )}
                        </div>
                      </dl>
                      {isPlaceholderSuggestion(row.suggestedValue) ? (
                        <p className="mt-2 text-[11px] font-bold text-amber-700">
                          No strong evidence found — enter a value manually or leave unchanged for the audit log.
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500" htmlFor={`manual-${row.id}`}>
                          Manual value
                        </label>
                        <input
                          id={`manual-${row.id}`}
                          value={draft.value}
                          onChange={(event) => updateDraft(row, event.target.value, "manual")}
                          placeholder={`Enter ${row.fieldLabel.toLowerCase()}`}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <button
                          type="button"
                          disabled={!row.suggestedValue || isPlaceholderSuggestion(row.suggestedValue)}
                          onClick={() => updateDraft(row, row.suggestedValue, "suggested")}
                          className="rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Use suggestion
                        </button>
                        <button
                          type="button"
                          onClick={() => updateDraft(row, row.currentValue, "unchanged")}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Leave unchanged
                        </button>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggestion rationale</p>
                          <ConfidenceDots pct={row.confidence} />
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">{row.rationale}</p>
                        <p className="mt-2 text-[11px] font-bold text-indigo-700">{row.basis}</p>
                        {row.basisDetail ? <p className="mt-0.5 text-[11px] text-slate-500">{row.basisDetail}</p> : null}
                        <p className="mt-2 text-[11px] font-bold text-slate-500">
                          Decision: {isUnchanged ? "Reviewed exception - left unchanged" : draft.decision === "suggested" ? "Using suggested value" : "Manual override"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white/95 px-5 py-3.5 shadow-[0_-8px_20px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs leading-relaxed text-slate-500">
              Saving resolves this issue type as a reviewed decision. Field edits update the cleaned CSV; unchanged exceptions are logged in review status.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={hasInvalidManualValue}
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Save overrides
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function ReviewScreen({
  fileName,
  issueStatuses,
  readinessScore,
  workflowMode,
  referenceContext,
  activeIssueType,
  lastSavedAt,
  onWorkflowModeChange,
  onApprove,
  onSkip,
  onUndo,
  onSelectIssue,
  onSaveProgress,
  onFinish,
  onNavigate,
}: ReviewScreenProps) {
  const workflow = WORKFLOW_MODES[workflowMode];
  const definitions = getWorkflowIssueDefinitions(workflowMode);
  const definition = definitions.find((item) => item.type === activeIssueType) ?? definitions[0];
  const activeReferenceContext = referenceContext ?? EMPTY_REFERENCE_CONTEXT;
  const suggestionPreview = getSuggestionPreview(activeIssueType, activeReferenceContext);
  const impactMetrics = getWorkflowImpactMetrics(workflowMode, issueStatuses);
  const manualFixRows = getManualFixRows(activeIssueType, activeReferenceContext);
  const canManualFix = supportsManualFix(activeIssueType) && manualFixRows.length > 0;
  const [manualFixOpen, setManualFixOpen] = useState(false);
  const [recommendationCollapsed, setRecommendationCollapsed] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendationResult | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | AIRecommendationFetchStatus>("idle");
  const [aiStatusMessage, setAiStatusMessage] = useState("");
  const [aiProvider, setAiProvider] = useState<"openai" | undefined>(undefined);
  const [aiCandidates, setAiCandidates] = useState<AIRecommendationCandidate[]>([]);

  useEffect(() => {
    if (!AI_ISSUE_TYPES.has(activeIssueType)) {
      setAiRecommendation(null);
      setAiStatus("idle");
      setAiStatusMessage("");
      setAiProvider(undefined);
      setAiCandidates([]);
      return;
    }

    const preview = getSuggestionPreview(activeIssueType, activeReferenceContext);
    const firstRecord =
      activeIssueType === "missing_owner"
        ? DETECTED.missingOwner[0]?.record
        : DETECTED.missingSegments[0]?.record;

    if (!preview || !firstRecord) {
      setAiRecommendation(null);
      setAiStatus("fallback");
      setAiStatusMessage("AI fallback active; no reviewable missing-value record is available for this issue type.");
      setAiProvider(undefined);
      setAiCandidates([]);
      return;
    }

    const evidencePackage = buildAIRecommendationEvidencePackage(activeIssueType, firstRecord, preview, activeReferenceContext);
    const { candidateValues, candidates, currentDatasetSignals } = evidencePackage;
    setAiCandidates(candidates);

    // With no candidates, the AI would be forced to return null — skip the call.
    if (candidateValues.length === 0) {
      setAiRecommendation(null);
      setAiStatus("fallback");
      setAiStatusMessage("AI fallback active; no bounded candidate set is available.");
      setAiProvider(undefined);
      return;
    }

    let cancelled = false;
    setAiStatus("loading");
    setAiStatusMessage("OpenAI request in progress.");
    setAiProvider("openai");
    setAiRecommendation(null);

    const ctx = activeReferenceContext;
    const basisStrength = preview.basis?.strength;

    const request: AIRecommendationRequest = {
      issueType: activeIssueType as "missing_owner" | "missing_segment",
      workflowMode,
      recordContext: {
        accountName: firstRecord.account_name ?? "",
        domain: firstRecord.domain ?? "",
        state: firstRecord.state ?? "",
        segment: firstRecord.segment ?? "",
      },
      candidateValues,
      candidates,
      existingSuggestion: {
        suggestedValue: preview.suggestedValue,
        confidence: preview.confidence,
        basisType: basisStrengthToAIBasisType(basisStrength),
        basisLabel: suggestionBasisLabel(preview),
        basisDetail: preview.basis?.detail ?? "",
        reviewState: preview.reviewState,
      },
      evidenceSummary: {
        hasOwnershipRules: sourceActive(ctx, "ownership_rules"),
        hasSegmentDictionary: sourceActive(ctx, "segment_dictionary"),
        hasCrmReference: sourceActive(ctx, "crm_reference"),
        activeReferenceSources: ctx.sources
          .filter((source) => source.active)
          .map((source) => `${source.fileName} (${source.rowCount} rows)`),
        currentDatasetSignals,
        matchedRuleDetail:
          candidates.find((candidate) => candidate.basisType === "direct_rule")?.basisDetail
            ?? ((basisStrength === "direct" || basisStrength === "deterministic") && preview.basis?.detail
              ? preview.basis.detail
              : undefined),
        matchedReferenceDetail:
          candidates.find((candidate) => candidate.basisType === "reference_pattern")?.basisDetail
            ?? (basisStrength === "strong" && preview.basis?.detail ? preview.basis.detail : undefined),
      },
    };

    fetchAIRecommendationWithStatus(request).then((response) => {
      if (!cancelled) {
        setAiRecommendation(response.result);
        setAiStatus(response.status);
        setAiStatusMessage(response.message);
        setAiProvider(response.provider);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeIssueType, workflowMode, activeReferenceContext]);

  const status = issueStatuses[activeIssueType];
  const reviewedCount = Object.values(issueStatuses).filter((item) => item !== "pending").length;
  const approvedIssueCount = Object.values(issueStatuses).filter((item) => item === "approved").length;
  const skippedIssueCount = Object.values(issueStatuses).filter((item) => item === "skipped").length;
  const unresolvedDefinitions = definitions.filter((item) => issueStatuses[item.type] !== "approved");
  const unresolvedBlockers = unresolvedDefinitions.filter((item) => (
    item.severity === "blocking" || item.severity === "high" || item.severity === "medium-high"
  ));
  const allReviewed = reviewedCount === definitions.length;

  const approveCurrentIssue = () => {
    const changes = generateChanges(activeIssueType, activeReferenceContext);
    onApprove(activeIssueType, annotateChangesWithAIReview(changes, activeIssueType, aiRecommendation, aiCandidates));
  };

  const saveManualFixes = (changes: ApprovedChange[]) => {
    setManualFixOpen(false);
    onApprove(activeIssueType, changes);
  };

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar
        screen="review"
        fileName={fileName}
        readinessScore={readinessScore}
        issueStatuses={issueStatuses}
        workflowMode={workflowMode}
        onNavigate={onNavigate}
      />

      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-sm font-black text-slate-950">Issue Queue</h2>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{reviewedCount} of {definitions.length} reviewed</p>
            {reviewedCount > 0 && (
              <span className="text-[11px] font-bold text-slate-400">
                {Math.round((reviewedCount / definitions.length) * 100)}%
              </span>
            )}
          </div>
          <div className="mt-2.5 h-1 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${(reviewedCount / definitions.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {definitions.map((item) => (
            <IssueQueueItem
              key={item.type}
              definition={item}
              status={issueStatuses[item.type]}
              isActive={item.type === activeIssueType}
              onClick={() => onSelectIssue(item.type)}
            />
          ))}
        </div>
        {allReviewed ? (
          <div className="border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={onFinish}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700"
            >
              View Results
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M2.5 6.5h8M7.5 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
        <StickyDatasetHeader
          title={definition.title}
          subtitle={`${definition.recordCount} findings · ${workflow.label} · ${definition.businessImpact}`}
          badge={
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={definition.severity} />
              <WorkflowLabel label={definition.workflowLabel} severity={definition.severity} />
              <StatusPill status={status} />
            </div>
          }
          actions={
            <>
              <WorkflowModeSelector value={workflowMode} onChange={onWorkflowModeChange} compact />
              <button
                type="button"
                onClick={onSaveProgress}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Save progress
              </button>
              <button
                type="button"
                onClick={onFinish}
                className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Export current state
              </button>
            </>
          }
        />

        <div className="space-y-5 px-6 py-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Review progress</p>
                <p className="mt-1 text-2xl font-black text-slate-950 tabular-nums">{reviewedCount}/{definitions.length}</p>
                <p className="text-xs text-slate-500">issue types reviewed</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Applied decisions</p>
                <p className="mt-1 text-2xl font-black text-emerald-600 tabular-nums">{approvedIssueCount}</p>
                <p className="text-xs text-slate-500">{skippedIssueCount} skipped or deferred</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Current readiness</p>
                <p className="mt-1 text-2xl font-black text-slate-950 tabular-nums">{readinessScore}</p>
                <p className="text-xs text-slate-500">{workflow.shortLabel} mode</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Unresolved risk</p>
                <p className={`mt-1 text-2xl font-black tabular-nums ${unresolvedDefinitions.length > 0 ? "text-orange-600" : "text-emerald-600"}`}>
                  {unresolvedDefinitions.length}
                </p>
                <p className="text-xs text-slate-500">{unresolvedBlockers.length} blockers or high-risk items</p>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs leading-relaxed text-slate-600">
                {unresolvedDefinitions.length > 0
                  ? `Current export will include approved changes only. ${unresolvedBlockers[0]?.title ?? unresolvedDefinitions[0]?.title} remains unsafe for ${workflow.shortLabel.toLowerCase()} until reviewed.`
                  : `All issue types have a reviewed decision for ${workflow.shortLabel.toLowerCase()}.`}
              </p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">Last saved: {formatSavedAt(lastSavedAt)}</p>
            </div>
          </section>

          <RationaleBlock title={`Why this ranks for ${workflow.shortLabel}`}>
            <p>{definition.priorityReason}</p>
          </RationaleBlock>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">Downstream Impact Simulator</h2>
                <p className="mt-1 text-xs text-slate-500">{workflow.primaryRisk}</p>
              </div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                {workflow.label}
              </span>
            </div>
            <div className="grid gap-3 p-3.5 lg:grid-cols-3">
              {impactMetrics.map((metric) => (
                <ImpactMetricCard key={metric.label} metric={metric} compact />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">Record Evidence</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">
                {definition.reviewMode}
              </span>
            </div>
            <div className="p-3.5">
              <RecordPreview issueType={activeIssueType} referenceContext={activeReferenceContext} />
            </div>
          </section>
        </div>
      </main>

      <aside
        className={`flex h-full shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white transition-[width] duration-200 ease-out ${
          recommendationCollapsed ? "w-[4.25rem]" : "w-80"
        }`}
      >
        <div className={recommendationCollapsed ? "flex h-full flex-col items-center bg-slate-50/95 shadow-[inset_1px_0_0_rgba(226,232,240,0.75)]" : "hidden"}>
          <button
            type="button"
            onClick={() => setRecommendationCollapsed(false)}
            className="mt-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            aria-label="Expand analysis panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3.5 5.5 7 9 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="mt-5 h-px w-8 bg-slate-200" aria-hidden="true" />
          <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-white text-indigo-700">
            <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="mt-5 flex flex-1 items-center justify-center">
            <p
              className="rotate-180 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
              style={{ writingMode: "vertical-rl" }}
            >
              Analysis
            </p>
          </div>
          <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
          </div>
        </div>

        <div className={recommendationCollapsed ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h2 className="truncate text-sm font-black text-slate-950">Analysis &amp; Recommendation</h2>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{workflow.label} mode · human approval required</p>
              </div>
              <button
                type="button"
                onClick={() => setRecommendationCollapsed(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                aria-label="Collapse analysis panel"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M5 3.5 8.5 7 5 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <section>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Issue type</p>
              <p className="text-sm font-black text-slate-900">{definition.title}</p>
            </section>

            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Detection confidence</p>
              <ConfidenceDots pct={definition.confidence} />
            </section>

            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Risk level</p>
              <SeverityBadge severity={definition.severity} />
            </section>

            {suggestionPreview ? (
              <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Missing-value suggestion</p>
                <p className="mt-2 text-sm font-black text-indigo-950">{suggestionPreview.suggestedValue}</p>
                <div className="mt-2">
                  <ConfidenceDots pct={suggestionPreview.confidence} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-indigo-900">{suggestionPreview.rationale}</p>
                <p className="mt-2 rounded-md border border-indigo-200 bg-white/70 px-2 py-1 text-[11px] font-bold text-indigo-800">
                  {suggestionBasisLabel(suggestionPreview)}
                </p>
                {suggestionPreview.basis?.detail ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-indigo-800">{suggestionPreview.basis.detail}</p>
                ) : null}
                <p className="mt-2 text-[11px] font-bold text-indigo-700">{suggestionStateLabel(suggestionPreview)}</p>
              </section>
            ) : null}

            {aiStatus === "loading" ? (
              <section className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">AI recommendation loading</p>
                <p className="mt-1 text-[11px] font-medium text-violet-700">{aiStatusMessage}</p>
                <div className="mt-2 h-3 w-3/4 rounded bg-violet-100" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-violet-100" />
                <div className="mt-1.5 h-3 w-2/3 rounded bg-violet-100" />
              </section>
            ) : aiRecommendation ? (
              <AIRecommendationPanel
                recommendation={aiRecommendation}
                provider={aiProvider}
                candidates={aiCandidates}
                deterministicValue={suggestionPreview?.suggestedValue ?? ""}
              />
            ) : aiStatus === "fallback" || aiStatus === "unavailable" ? (
              <AIFallbackPanel status={aiStatus} message={aiStatusMessage} />
            ) : null}

            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Rationale</p>
              <p className="text-xs leading-relaxed text-slate-700">{definition.whyItMatters}</p>
            </section>

            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Suggested action</p>
              <p className="text-xs leading-relaxed text-slate-700">{definition.suggestedAction}</p>
            </section>

            <section>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Business implication</p>
              <p className="text-xs leading-relaxed text-slate-700">{definition.businessImpact}</p>
            </section>

            <DownstreamBox>{definition.downstreamImplication}</DownstreamBox>
            <ScoreImpactBox points={definition.readinessImpact} />

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trust cues</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
                <li>Changes apply at the issue type level — no row-level editing.</li>
                <li>Every approved change is logged with issue linkage and timestamp.</li>
                <li>All decisions are reversible until export.</li>
              </ul>
            </section>
          </div>

          <div className="space-y-2 border-t border-slate-200 p-4">
            {status === "pending" ? (
              <>
                <button
                  type="button"
                  onClick={approveCurrentIssue}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 active:bg-emerald-800"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2 7l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Approve Issue Type
                </button>
                {canManualFix ? (
                  <button
                    type="button"
                    onClick={() => setManualFixOpen(true)}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <path d="M7.5 2.5 10.5 5.5 4.5 11.5H1.5v-3L7.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.5 3.5 9.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Resolve exceptions
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSkip(activeIssueType)}
                  className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                >
                  Skip for now
                </button>
              </>
            ) : (
              <>
                <div className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80">
                  <StatusPill status={status} />
                </div>
                <button
                  type="button"
                  onClick={() => onUndo(activeIssueType)}
                  className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                >
                  Undo decision
                </button>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSaveProgress}
                className="flex h-9 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              >
                Save progress
              </button>
              <button
                type="button"
                onClick={onFinish}
                className="flex h-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                Export current
              </button>
            </div>

            {allReviewed ? (
              <button
                type="button"
                onClick={onFinish}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700"
              >
                View Results
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M2.5 6.5h8M7.5 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      {manualFixOpen ? (
        <ManualFixDrawer
          issueType={activeIssueType}
          title={definition.title}
          riskLevel={definition.riskLevel}
          rows={manualFixRows}
          onClose={() => setManualFixOpen(false)}
          onSave={saveManualFixes}
        />
      ) : null}
    </div>
  );
}
