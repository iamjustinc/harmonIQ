"use client";

import { useCallback, useMemo } from "react";
import type { ApprovedChange, CRMRecord, IssueStatus, IssueType, ResolutionType, WorkflowMode } from "@/lib/types";
import { SAMPLE_DATA } from "@/lib/data";
import { INITIAL_SCORE } from "@/lib/issueDetection";
import { getWorkflowImpactMetrics, getWorkflowIssueDefinitions, WORKFLOW_MODES } from "@/lib/workflows";
import Sidebar from "./Sidebar";
import {
  DiffCell,
  ImpactMetricCard,
  SeverityBadge,
  StatusPill,
  StickyDatasetHeader,
  WorkflowLabel,
  WorkflowModeSelector,
} from "./harmoniq-ui";

interface ResultsScreenProps {
  fileName: string;
  uploadedAt: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  approvedChanges: ApprovedChange[];
  readinessScore: number;
  workflowMode: WorkflowMode;
  onWorkflowModeChange: (mode: WorkflowMode) => void;
  onNavigate: (screen: "upload" | "profile" | "review" | "results") => void;
  onStartNew: () => void;
}

const BASE_HEADERS: (keyof CRMRecord)[] = [
  "record_id",
  "account_name",
  "domain",
  "owner",
  "segment",
  "state",
  "country",
  "contact_name",
  "email",
  "phone",
];

const RESOLUTION_META: Record<ResolutionType, { label: string; shortLabel: string; className: string; previewClass: string; dotClass: string }> = {
  deterministic_fix: {
    label: "Deterministic fix",
    shortLabel: "Deterministic",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    previewClass: "bg-emerald-50 font-bold text-emerald-800",
    dotClass: "bg-emerald-300",
  },
  reference_backed: {
    label: "Reference-backed",
    shortLabel: "Reference",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    previewClass: "bg-indigo-50 font-bold text-indigo-800",
    dotClass: "bg-indigo-300",
  },
  ai_reviewed: {
    label: "AI-reviewed",
    shortLabel: "AI-reviewed",
    className: "border-violet-200 bg-violet-50 text-violet-800",
    previewClass: "bg-violet-50 font-bold text-violet-800",
    dotClass: "bg-violet-300",
  },
  manual_override: {
    label: "Manual override",
    shortLabel: "Manual",
    className: "border-slate-300 bg-slate-100 text-slate-800",
    previewClass: "bg-slate-100 font-bold text-slate-800",
    dotClass: "bg-slate-400",
  },
  unresolved_review_required: {
    label: "Unresolved / review required",
    shortLabel: "Review required",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    previewClass: "bg-amber-50 font-bold text-amber-800",
    dotClass: "bg-amber-300",
  },
};

function inferResolutionType(change: ApprovedChange): ResolutionType {
  if (change.changeId.startsWith("MAN-") && change.userDecision === "Accepted") return "manual_override";
  if (change.userDecision === "Flagged" || isPlaceholderAfterValue(change.after)) return "unresolved_review_required";
  if (change.basisStrength === "deterministic") return "deterministic_fix";
  if (change.basisStrength === "direct" || change.basisStrength === "strong") return "reference_backed";
  return "unresolved_review_required";
}

function getResolutionType(change: ApprovedChange): ResolutionType {
  return change.resolutionType ?? inferResolutionType(change);
}

function ResolutionBadge({ type, compact = false }: { type: ResolutionType; compact?: boolean }) {
  const meta = RESOLUTION_META[type];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-bold ${compact ? "text-[9px]" : "text-[10px]"} ${meta.className}`}>
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}

function applyChanges(records: CRMRecord[], changes: ApprovedChange[]): CRMRecord[] {
  const changesByRecord = new Map<string, ApprovedChange[]>();
  for (const change of changes) {
    if (change.recordId === "DATASET") continue;
    changesByRecord.set(change.recordId, [...(changesByRecord.get(change.recordId) ?? []), change]);
  }

  return records.map((record) => {
    const rowChanges = changesByRecord.get(record.record_id);
    if (!rowChanges) return record;

    const updated: CRMRecord = { ...record };
    for (const change of rowChanges) {
      if (change.field === "harmoniq_review_status") {
        updated.harmoniq_review_status = [updated.harmoniq_review_status, change.after].filter(Boolean).join(" | ");
        continue;
      }

      if (change.field === "harmoniq_schema_notes") {
        updated.harmoniq_schema_notes = [updated.harmoniq_schema_notes, change.after].filter(Boolean).join(" | ");
        continue;
      }

      if (change.field in updated) {
        (updated as unknown as Record<string, string | undefined>)[change.field] = change.after;
      }
    }
    return updated;
  });
}

function buildChangedFields(changes: ApprovedChange[]) {
  const changedFields = new Map<string, Set<string>>();
  for (const change of changes) {
    if (change.recordId === "DATASET") continue;
    const fields = changedFields.get(change.recordId) ?? new Set<string>();
    fields.add(change.field);
    changedFields.set(change.recordId, fields);
  }
  return changedFields;
}

/** Track the `after` value per cell so placeholder states can be rendered distinctly */
function buildChangeAfterValues(changes: ApprovedChange[]) {
  const result = new Map<string, Map<string, string>>();
  for (const change of changes) {
    if (change.recordId === "DATASET") continue;
    const fields = result.get(change.recordId) ?? new Map<string, string>();
    fields.set(change.field, change.after);
    result.set(change.recordId, fields);
  }
  return result;
}

function buildChangeAudit(changes: ApprovedChange[]) {
  const result = new Map<string, Map<string, ApprovedChange>>();
  for (const change of changes) {
    if (change.recordId === "DATASET") continue;
    const fields = result.get(change.recordId) ?? new Map<string, ApprovedChange>();
    fields.set(change.field, change);
    result.set(change.recordId, fields);
  }
  return result;
}

/**
 * Returns true when a changed field value is a placeholder status string rather than
 * a resolved data value. These display as status labels, not as field content.
 */
function isPlaceholderAfterValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.startsWith("needs") ||
    lower.startsWith("awaiting") ||
    lower.startsWith("no strong") ||
    lower === "unassigned - review" ||
    lower.includes("[flagged")
  );
}

function previewCellClass(
  changed: boolean,
  resolutionType: ResolutionType | undefined,
  isId: boolean,
): string {
  if (!changed) return isId ? "font-mono text-slate-500" : "text-slate-700";
  return RESOLUTION_META[resolutionType ?? "unresolved_review_required"].previewClass;
}

function getCsvHeaders(records: CRMRecord[]) {
  const optionalHeaders: (keyof CRMRecord)[] = [];
  if (records.some((record) => record.harmoniq_review_status)) optionalHeaders.push("harmoniq_review_status");
  if (records.some((record) => record.harmoniq_schema_notes)) optionalHeaders.push("harmoniq_schema_notes");
  return [...BASE_HEADERS, ...optionalHeaders];
}

function recordsToCsv(records: CRMRecord[]) {
  const headers = getCsvHeaders(records);
  const escape = (value: string | undefined) => `"${(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...records.map((record) => headers.map((header) => escape(record[header])).join(",")),
  ].join("\n");
}

function changesToCsv(changes: ApprovedChange[]) {
  const headers = [
    "change_id",
    "record_id",
    "account_name",
    "field",
    "before",
    "after",
    "issue_type",
    "risk_level",
    "resolution_type",
    "basis",
    "evidence_detail",
    "ai_candidate_count",
    "user_decision",
    "timestamp",
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...changes.map((change) => [
      change.changeId,
      change.recordId,
      change.accountName,
      change.field,
      change.before,
      change.after,
      change.issueType,
      change.riskLevel,
      getResolutionType(change),
      change.basisLabel ?? "",
      change.evidenceDetail ?? "",
      change.aiCandidateCount ?? "",
      change.userDecision,
      change.timestamp,
    ].map((value) => escape(String(value))).join(",")),
  ].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string) {
  if (!iso) return "Not reviewed yet";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ResultsScreen({
  fileName,
  uploadedAt,
  issueStatuses,
  approvedChanges,
  readinessScore,
  workflowMode,
  onWorkflowModeChange,
  onNavigate,
  onStartNew,
}: ResultsScreenProps) {
  const workflow = WORKFLOW_MODES[workflowMode];
  const definitions = getWorkflowIssueDefinitions(workflowMode);
  const impactMetrics = getWorkflowImpactMetrics(workflowMode, issueStatuses);
  const cleanedData = useMemo(() => applyChanges(SAMPLE_DATA, approvedChanges), [approvedChanges]);
  const changedFields = useMemo(() => buildChangedFields(approvedChanges), [approvedChanges]);
  const changeAfterValues = useMemo(() => buildChangeAfterValues(approvedChanges), [approvedChanges]);
  const changeAudit = useMemo(() => buildChangeAudit(approvedChanges), [approvedChanges]);
  const resolutionCounts = useMemo(() => {
    const counts: Record<ResolutionType, number> = {
      deterministic_fix: 0,
      reference_backed: 0,
      ai_reviewed: 0,
      manual_override: 0,
      unresolved_review_required: 0,
    };
    for (const change of approvedChanges) {
      counts[getResolutionType(change)] += 1;
    }
    return counts;
  }, [approvedChanges]);
  const aiCandidateReviewCount = approvedChanges.reduce((sum, change) => sum + (change.aiCandidateCount ?? 0), 0);
  const totalBefore = definitions.reduce((sum, definition) => sum + definition.recordCount, 0);
  const totalRemaining = definitions.reduce((sum, definition) => (
    sum + (issueStatuses[definition.type] === "approved" ? 0 : definition.recordCount)
  ), 0);
  const approvedIssueCount = Object.values(issueStatuses).filter((status) => status === "approved").length;
  const skippedIssueCount = Object.values(issueStatuses).filter((status) => status === "skipped").length;
  const reviewedIssueCount = Object.values(issueStatuses).filter((status) => status !== "pending").length;
  const pendingIssueCount = Object.values(issueStatuses).filter((status) => status === "pending").length;
  const unresolvedDefinitions = definitions.filter((definition) => issueStatuses[definition.type] !== "approved");
  const unresolvedBlockers = unresolvedDefinitions.filter((definition) => (
    definition.severity === "blocking" || definition.severity === "high" || definition.severity === "medium-high"
  ));
  const hasUnresolvedRisk = unresolvedDefinitions.length > 0;
  const scoreGain = readinessScore - INITIAL_SCORE;
  const baseName = (fileName || "messy_crm_export").replace(/\.csv$/i, "");

  const previewColumns = useMemo(() => {
    const columns: { key: keyof CRMRecord; label: string }[] = [
      { key: "record_id", label: "ID" },
      { key: "account_name", label: "Account" },
      { key: "owner", label: "Owner" },
      { key: "segment", label: "Segment" },
      { key: "state", label: "State" },
      { key: "email", label: "Email" },
    ];
    if (cleanedData.some((record) => record.harmoniq_review_status)) {
      columns.push({ key: "harmoniq_review_status", label: "Review Status" });
    }
    return columns;
  }, [cleanedData]);

  const previewRows = useMemo(() => {
    const changedRows = cleanedData.filter((record) => changedFields.has(record.record_id));
    return (changedRows.length ? changedRows : cleanedData).slice(0, 8);
  }, [changedFields, cleanedData]);

  const exportCleanedCsv = useCallback(() => {
    const suffix = hasUnresolvedRisk ? "current_reviewed" : "cleaned";
    downloadCsv(recordsToCsv(cleanedData), `${baseName}_harmoniq_${suffix}.csv`);
  }, [baseName, cleanedData, hasUnresolvedRisk]);

  const exportChangeSummary = useCallback(() => {
    downloadCsv(changesToCsv(approvedChanges), `${baseName}_harmoniq_change_summary.csv`);
  }, [approvedChanges, baseName]);

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar
        screen="results"
        fileName={fileName}
        readinessScore={readinessScore}
        issueStatuses={issueStatuses}
        workflowMode={workflowMode}
        onNavigate={onNavigate}
      />

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
        <StickyDatasetHeader
          title="Results"
          subtitle={`${fileName || "messy_crm_export.csv"} · ${workflow.label} · ${reviewedIssueCount}/${definitions.length} issue types reviewed · ${approvedChanges.length} logged changes`}
          badge={<StatusPill status={hasUnresolvedRisk ? "pending" : approvedIssueCount > 0 ? "approved" : "pending"} />}
          actions={
            <>
              <WorkflowModeSelector value={workflowMode} onChange={onWorkflowModeChange} compact />
              <button
                type="button"
                onClick={onStartNew}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                New Dataset
              </button>
              <button
                type="button"
                onClick={exportChangeSummary}
                disabled={approvedChanges.length === 0}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export Change Summary
              </button>
              <button
                type="button"
                onClick={exportCleanedCsv}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v7M3 5.5l3 3 3-3M1.5 10.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {hasUnresolvedRisk ? "Export Current CSV" : "Export Cleaned CSV"}
              </button>
            </>
          }
        />

        <div className="max-w-6xl space-y-6 px-6 py-6">
          {hasUnresolvedRisk ? (
            <section className="rounded-lg border border-orange-200 bg-orange-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Partial review export</p>
                  <h2 className="mt-1 text-base font-black text-orange-950">Reviewed value is exportable, but unresolved risk remains.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-orange-900">
                    {reviewedIssueCount} of {definitions.length} issue types have a decision. The current CSV reflects only approved changes so far; pending and skipped issue types stay unresolved for {workflow.shortLabel.toLowerCase()}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("review")}
                  className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100"
                >
                  Continue Review
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-orange-200 bg-white/70 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Current readiness</p>
                  <p className="mt-1 text-2xl font-black text-orange-950 tabular-nums">{readinessScore}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-white/70 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Pending review</p>
                  <p className="mt-1 text-2xl font-black text-orange-950 tabular-nums">{pendingIssueCount}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-white/70 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Deferred risk</p>
                  <p className="mt-1 text-2xl font-black text-orange-950 tabular-nums">{skippedIssueCount}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-white/70 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">High-risk unresolved</p>
                  <p className="mt-1 text-2xl font-black text-orange-950 tabular-nums">{unresolvedBlockers.length}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-orange-900">
                Still unsafe or incomplete: {unresolvedDefinitions.slice(0, 3).map((definition) => definition.title).join(", ")}
                {unresolvedDefinitions.length > 3 ? `, plus ${unresolvedDefinitions.length - 3} more` : ""}.
              </p>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Readiness comparison</p>
              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Before</p>
                  <p className="mt-1 text-5xl font-black text-slate-950 tabular-nums">{INITIAL_SCORE}</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${INITIAL_SCORE}%` }} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Change</p>
                  <p className={`text-2xl font-black tabular-nums ${scoreGain > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {scoreGain > 0 ? "+" : ""}{scoreGain}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">After</p>
                  <p className="mt-1 text-5xl font-black text-slate-950 tabular-nums">{readinessScore}</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${readinessScore}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Issue reduction summary</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-3xl font-black text-slate-950 tabular-nums">{totalBefore}</p>
                  <p className="text-xs font-medium text-slate-500">Findings before</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-600 tabular-nums">{totalBefore - totalRemaining}</p>
                  <p className="text-xs font-medium text-slate-500">Addressed</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-950 tabular-nums">{approvedIssueCount}</p>
                  <p className="text-xs font-medium text-slate-500">Approved issue types</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-400 tabular-nums">{skippedIssueCount}</p>
                  <p className="text-xs font-medium text-slate-500">Skipped issue types</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Approved changes apply immediately and export with a full audit trail. Pending and skipped issue types remain flagged as unresolved risk in this staged review.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">Workflow Readiness Improvement</h2>
                <p className="mt-1 text-xs text-slate-500">{workflow.primaryRisk}</p>
              </div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                {workflow.label}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {impactMetrics.map((metric) => (
                <ImpactMetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">Review Proof Summary</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Every exported change is labeled by resolution type so final values can be traced back to deterministic logic, reference evidence, AI review, or manual exception handling.
                </p>
              </div>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">
                {aiCandidateReviewCount > 0
                  ? `AI reviewed ${aiCandidateReviewCount} bounded candidates`
                  : "AI audit appears after approved AI review"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(RESOLUTION_META) as ResolutionType[]).map((type) => (
                <div key={type} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`h-2.5 w-2.5 rounded-sm ${RESOLUTION_META[type].dotClass}`} />
                    <p className="font-mono text-lg font-black tabular-nums text-slate-950">{resolutionCounts[type]}</p>
                  </div>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{RESOLUTION_META[type].label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-black text-slate-950">Issue Resolution Detail</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {["Issue", "Risk", "Workflow", "Before", "After", "Decision"].map((heading) => (
                      <th key={heading} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {definitions.map((definition) => {
                    const status = issueStatuses[definition.type];
                    const afterCount = status === "approved" ? 0 : definition.recordCount;
                    return (
                      <tr key={definition.type} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs font-black text-slate-900">{definition.title}</td>
                        <td className="px-4 py-3"><SeverityBadge severity={definition.severity} /></td>
                        <td className="px-4 py-3"><WorkflowLabel label={definition.workflowLabel} severity={definition.severity} /></td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{definition.recordCount}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{afterCount}</td>
                        <td className="px-4 py-3"><StatusPill status={status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-black text-slate-950">Cleaned Dataset Preview</h2>
              <p className="text-xs font-medium text-slate-500">Changed records first; changed fields highlighted.</p>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      {previewColumns.map((column) => (
                        <th key={column.key} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row) => (
                      <tr key={row.record_id} className="hover:bg-slate-50">
                        {previewColumns.map((column) => {
                          const change = changeAudit.get(row.record_id)?.get(column.key);
                          const changed = !!change;
                          const resolutionType = change ? getResolutionType(change) : undefined;
                          const afterValue = changeAfterValues.get(row.record_id)?.get(column.key);
                          const isPlaceholder = changed && !!afterValue && isPlaceholderAfterValue(afterValue);
                          const cellValue = String(row[column.key] ?? "") || "-";
                          return (
                            <td
                              key={column.key}
                              className={`max-w-[240px] px-3 py-2.5 text-xs ${previewCellClass(changed, resolutionType, column.key === "record_id")}`}
                            >
                              {changed && resolutionType ? (
                                <div className="min-w-0 space-y-1">
                                  <p className={`truncate ${isPlaceholder ? "italic" : ""}`}>{cellValue}</p>
                                  <ResolutionBadge type={resolutionType} compact />
                                  {change?.aiCandidateCount ? (
                                    <p className="truncate text-[10px] font-bold text-violet-700">
                                      AI reviewed {change.aiCandidateCount} candidates
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="truncate">{cellValue}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2">
                <p className="text-[11px] font-medium text-slate-500">
                  Showing {previewRows.length} of {cleanedData.length} rows. Export includes the full current dataset with approved changes only.
                </p>
                <div className="flex items-center gap-3">
                  {(Object.keys(RESOLUTION_META) as ResolutionType[]).map((type) => (
                    <span key={type} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <span className={`h-2.5 w-2.5 rounded-sm ${RESOLUTION_META[type].dotClass}`} />
                      {RESOLUTION_META[type].shortLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-slate-950">Transformation Log</h2>
              <button
                type="button"
                onClick={exportChangeSummary}
                disabled={approvedChanges.length === 0}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export Change Summary
              </button>
            </div>

            {approvedChanges.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        {["Change", "Record", "Field", "Before / After", "Issue", "Resolution", "Evidence", "Approval"].map((heading) => (
                          <th key={heading} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {approvedChanges.slice(0, 30).map((change) => {
                        const definition = definitions.find((item) => item.type === change.issueType);
                        const resolutionType = getResolutionType(change);
                        return (
                          <tr key={change.changeId} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{change.changeId}</td>
                            <td className="px-3 py-2.5 text-xs font-bold text-slate-800">{change.recordId}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-indigo-700">{change.field}</td>
                            <td className="px-3 py-2.5">
                              <DiffCell before={change.before} after={change.after} />
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">
                              {definition?.title ?? change.issueType.replace(/_/g, " ")}
                            </td>
                            <td className="px-3 py-2.5">
                              <ResolutionBadge type={resolutionType} />
                            </td>
                            <td className="max-w-[320px] px-3 py-2.5">
                              <p className="text-[11px] font-bold text-slate-700">{change.basisLabel ?? RESOLUTION_META[resolutionType].label}</p>
                              {change.evidenceDetail ? (
                                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{change.evidenceDetail}</p>
                              ) : null}
                              {change.aiCandidateCount ? (
                                <p className="mt-1 text-[11px] font-bold text-violet-700">
                                  {resolutionType === "ai_reviewed"
                                    ? `AI reviewed ${change.aiCandidateCount} bounded candidates; recommendation approved.`
                                    : `AI reviewed ${change.aiCandidateCount} bounded candidates; manual review remains required.`}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="text-xs font-bold text-slate-700">{change.userDecision}</p>
                              <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(change.timestamp)}</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {approvedChanges.length > 30 ? (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500">
                    Showing 30 of {approvedChanges.length} changes. Export the change summary for the full log.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-6 text-center">
                <p className="text-sm font-black text-slate-700">No approved changes yet</p>
                <p className="mt-1 text-xs text-slate-500">Return to the Decision Workspace to approve issue types before export.</p>
                <button
                  type="button"
                  onClick={() => onNavigate("review")}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Open Decision Workspace
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
