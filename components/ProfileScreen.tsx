"use client";

import type { IssueStatus, IssueType } from "@/lib/types";
import { DATASET_META } from "@/lib/data";
import { DETECTED, ISSUE_DEFINITIONS, ISSUE_TYPE_ORDER } from "@/lib/issueDetection";
import Sidebar from "./Sidebar";
import {
  ConfidenceDots,
  SeverityBadge,
  StatusPill,
  StickyDatasetHeader,
  WorkflowLabel,
} from "./harmoniq-ui";

interface ProfileScreenProps {
  fileName: string;
  uploadedAt: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  readinessScore: number;
  onBeginReview: () => void;
  onNavigate: (screen: "upload" | "profile" | "review" | "results") => void;
}

const WORKFLOW_FLAGS = [
  {
    label: "Routing blocked",
    detail: "Owner gaps prevent assignment into rep queues.",
    active: DETECTED.missingOwner.length > 0,
  },
  {
    label: "Pipeline inflated",
    detail: "Duplicate clusters can overstate account volume.",
    active: DETECTED.duplicates.length > 0,
  },
  {
    label: "Outreach constrained",
    detail: "Invalid email values create bounce and sequence risk.",
    active: DETECTED.invalidEmails.length > 0,
  },
  {
    label: "Segmentation unreliable",
    detail: "State and segment gaps weaken territory logic.",
    active: DETECTED.inconsistentStates.length + DETECTED.missingSegments.length > 0,
  },
];

function formatDate(iso: string) {
  if (!iso) return "Not analyzed yet";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProfileScreen({
  fileName,
  uploadedAt,
  issueStatuses,
  readinessScore,
  onBeginReview,
  onNavigate,
}: ProfileScreenProps) {
  const totalIssues = ISSUE_DEFINITIONS.reduce((sum, definition) => sum + definition.recordCount, 0);
  const blockingRecords = DETECTED.missingOwner.length + DETECTED.duplicates.reduce((sum, cluster) => sum + cluster.records.length, 0);
  const issueCountsByCategory = ISSUE_DEFINITIONS.reduce<Record<string, number>>((counts, definition) => {
    counts[definition.category] = (counts[definition.category] ?? 0) + definition.recordCount;
    return counts;
  }, {});

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar
        screen="profile"
        fileName={fileName}
        readinessScore={readinessScore}
        issueStatuses={issueStatuses}
        onNavigate={onNavigate}
      />

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
        <StickyDatasetHeader
          title="Profile Overview"
          subtitle={`${fileName || DATASET_META.fileName} · analyzed ${formatDate(uploadedAt)}`}
          badge={<StatusPill status="pending" />}
          actions={
            <button
              type="button"
              onClick={onBeginReview}
              className="flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700"
            >
              Begin Review
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          }
        />

        <div className="max-w-6xl space-y-6 px-6 py-6">
          <section className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Readiness score</p>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-6xl font-black tracking-tight text-slate-950 tabular-nums">{readinessScore}</span>
                <span className="pb-2 text-lg font-bold text-slate-400">/100</span>
              </div>
              <div className="mt-5 h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-red-500 transition-all"
                  style={{ width: `${readinessScore}%` }}
                />
              </div>
              <p className="mt-4 text-sm font-bold text-red-700">Not ready — 7 issue types unresolved</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Weighted by workflow impact, issue ambiguity, and whether a fix can apply without business context. Resolve all 7 to reach 100.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Dataset summary</p>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Rows</dt>
                    <dd className="text-2xl font-black text-slate-950 tabular-nums">{DATASET_META.rowCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Columns</dt>
                    <dd className="text-2xl font-black text-slate-950 tabular-nums">{DATASET_META.columnCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Issue types</dt>
                    <dd className="text-2xl font-black text-slate-950 tabular-nums">{ISSUE_DEFINITIONS.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Findings</dt>
                    <dd className="text-2xl font-black text-red-600 tabular-nums">{totalIssues}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Business impact</p>
                <p className="mt-4 text-2xl font-black text-slate-950 tabular-nums">{blockingRecords}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">records with routing or duplicate risk</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  Resolve routing and duplicate issues first — they block rep assignment and inflate pipeline reporting.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-slate-950">Issue Count By Category</h2>
                <span className="text-xs font-semibold text-slate-500">Record-level findings</span>
              </div>
              <div className="space-y-2">
                {Object.entries(issueCountsByCategory).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5">
                    <span className="text-sm font-bold text-slate-800">{category}</span>
                    <span className="font-mono text-sm font-black text-slate-950">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-black text-slate-950">Blocking Workflow Flags</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {WORKFLOW_FLAGS.map((flag) => (
                  <div
                    key={flag.label}
                    className={`rounded-lg border p-3 ${
                      flag.active ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <p className={`text-sm font-black ${flag.active ? "text-red-800" : "text-emerald-800"}`}>{flag.label}</p>
                    <p className={`mt-1 text-xs leading-relaxed ${flag.active ? "text-red-700" : "text-emerald-700"}`}>{flag.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-950">Top Issues By Business Risk</h2>
                  <p className="mt-1 text-xs text-slate-400">Ranked by workflow impact and fix ambiguity — not record count.</p>
                </div>
                <button
                  type="button"
                  onClick={onBeginReview}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Open Decision Workspace
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {ISSUE_TYPE_ORDER.map((type, index) => {
                const definition = ISSUE_DEFINITIONS.find((item) => item.type === type)!;
                const status = issueStatuses[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={onBeginReview}
                    className="grid w-full gap-4 px-5 py-4 text-left hover:bg-slate-50 md:grid-cols-[48px_1fr_160px_140px]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{definition.title}</p>
                        <SeverityBadge severity={definition.severity} />
                        <WorkflowLabel label={definition.workflowLabel} severity={definition.severity} />
                        <StatusPill status={status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{definition.businessImpact}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{definition.priorityReason}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Confidence</p>
                      <div className="mt-1">
                        <ConfidenceDots pct={definition.confidence} />
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xl font-black text-slate-950 tabular-nums">{definition.recordCount}</p>
                      <p className="text-xs font-medium text-slate-500">findings</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-100 p-5">
            <h2 className="text-sm font-black text-slate-950">Prioritization Logic</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-900">1. Workflow blockers first</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Owner gaps and duplicate clusters rank highest because they block routing or distort reporting.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-900">2. Review-first fields next</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Email and segment issues need human confirmation where the source data is ambiguous.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-900">3. Deterministic cleanup last</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  State, schema, and naming fixes are transparent transformations with lower business risk.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
