"use client";

import { useCallback, useMemo } from "react";
import type { ApprovedChange, CRMRecord, IssueStatus, IssueType } from "@/lib/types";
import { SAMPLE_DATA } from "@/lib/data";
import { INITIAL_SCORE, ISSUE_DEFINITIONS } from "@/lib/issueDetection";
import Sidebar from "./Sidebar";
import {
  DiffCell,
  SeverityBadge,
  StatusPill,
  StickyDatasetHeader,
  WorkflowLabel,
} from "./harmoniq-ui";

interface ResultsScreenProps {
  fileName: string;
  uploadedAt: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  approvedChanges: ApprovedChange[];
  readinessScore: number;
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

function workflowSummary(issueStatuses: Record<IssueType, IssueStatus>) {
  return [
    {
      label: "Routing readiness",
      status: issueStatuses.missing_owner === "approved" ? "Improved" : "Still blocked",
      detail: issueStatuses.missing_owner === "approved"
        ? "Owner gaps are surfaced as review assignments instead of silently falling out of routing."
        : "Owner gaps remain unresolved and may still block rep assignment.",
    },
    {
      label: "Reporting readiness",
      status: issueStatuses.duplicate_accounts === "approved" ? "Improved" : "Needs review",
      detail: issueStatuses.duplicate_accounts === "approved"
        ? "Duplicate clusters are flagged for canonical record review without auto-merging records."
        : "Duplicate clusters can still inflate account and pipeline reporting.",
    },
    {
      label: "Segmentation readiness",
      status: issueStatuses.inconsistent_state === "approved" && issueStatuses.missing_segment === "approved" ? "Improved" : "Partial",
      detail: issueStatuses.inconsistent_state === "approved"
        ? "State values are standardized; missing segments are handled according to review decisions."
        : "Geographic or segment filters may still miss non-standard records.",
    },
    {
      label: "Outreach readiness",
      status: issueStatuses.invalid_email === "approved" ? "Improved" : "Needs review",
      detail: issueStatuses.invalid_email === "approved"
        ? "Invalid email values are corrected when obvious or flagged before sequence export."
        : "Outreach lists may still contain malformed or placeholder addresses.",
    },
  ];
}

export default function ResultsScreen({
  fileName,
  uploadedAt,
  issueStatuses,
  approvedChanges,
  readinessScore,
  onNavigate,
  onStartNew,
}: ResultsScreenProps) {
  const cleanedData = useMemo(() => applyChanges(SAMPLE_DATA, approvedChanges), [approvedChanges]);
  const changedFields = useMemo(() => buildChangedFields(approvedChanges), [approvedChanges]);
  const totalBefore = ISSUE_DEFINITIONS.reduce((sum, definition) => sum + definition.recordCount, 0);
  const totalRemaining = ISSUE_DEFINITIONS.reduce((sum, definition) => (
    sum + (issueStatuses[definition.type] === "approved" ? 0 : definition.recordCount)
  ), 0);
  const approvedIssueCount = Object.values(issueStatuses).filter((status) => status === "approved").length;
  const skippedIssueCount = Object.values(issueStatuses).filter((status) => status === "skipped").length;
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
    downloadCsv(recordsToCsv(cleanedData), `${baseName}_harmoniq_cleaned.csv`);
  }, [baseName, cleanedData]);

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
        onNavigate={onNavigate}
      />

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
        <StickyDatasetHeader
          title="Results"
          subtitle={`${fileName || "messy_crm_export.csv"} · reviewed ${formatDate(uploadedAt)} · ${approvedChanges.length} logged changes`}
          badge={<StatusPill status={approvedIssueCount > 0 ? "approved" : "pending"} />}
          actions={
            <>
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
                Export Cleaned CSV
              </button>
            </>
          }
        />

        <div className="max-w-6xl space-y-6 px-6 py-6">
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
                Approved changes apply immediately and export with a full audit trail. Skipped issue types remain flagged as unresolved risk.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-black text-slate-950">Workflow Readiness Improvement</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {workflowSummary(issueStatuses).map((item) => {
                const topColor =
                  item.status === "Improved"     ? "bg-emerald-500" :
                  item.status === "Still blocked" ? "bg-red-400"     :
                  item.status === "Partial"       ? "bg-amber-400"   : "bg-amber-400";
                const statusColor =
                  item.status === "Improved"     ? "text-emerald-700" :
                  item.status === "Still blocked" ? "text-red-700"     : "text-amber-700";
                return (
                  <div key={item.label} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className={`h-1 w-full ${topColor}`} />
                    <div className="p-3">
                      <p className="text-xs font-black text-slate-900">{item.label}</p>
                      <p className={`mt-1 text-xs font-bold ${statusColor}`}>{item.status}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
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
                  {ISSUE_DEFINITIONS.map((definition) => {
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
                          const changed = changedFields.get(row.record_id)?.has(column.key);
                          return (
                            <td
                              key={column.key}
                              className={`max-w-[220px] truncate px-3 py-2.5 text-xs ${
                                changed
                                  ? "bg-emerald-50 font-bold text-emerald-800"
                                  : column.key === "record_id"
                                    ? "font-mono text-slate-500"
                                    : "text-slate-700"
                              }`}
                            >
                              {String(row[column.key] ?? "") || "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500">
                Showing {previewRows.length} of {cleanedData.length} rows. Export includes the full cleaned dataset.
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
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        {["Change", "Record", "Field", "Before / After", "Issue", "Decision"].map((heading) => (
                          <th key={heading} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {approvedChanges.slice(0, 30).map((change) => {
                        const definition = ISSUE_DEFINITIONS.find((item) => item.type === change.issueType)!;
                        return (
                          <tr key={change.changeId} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{change.changeId}</td>
                            <td className="px-3 py-2.5 text-xs font-bold text-slate-800">{change.recordId}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-indigo-700">{change.field}</td>
                            <td className="px-3 py-2.5">
                              <DiffCell before={change.before} after={change.after} />
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">{definition.title}</td>
                            <td className="px-3 py-2.5 text-xs font-bold text-slate-700">{change.userDecision}</td>
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
