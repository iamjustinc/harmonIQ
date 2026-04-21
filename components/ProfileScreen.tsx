"use client";

import type { IssueStatus, IssueType, WorkflowMode } from "@/lib/types";
import { DATASET_META } from "@/lib/data";
import { getWorkflowImpactMetrics, getWorkflowIssueDefinitions, WORKFLOW_MODES } from "@/lib/workflows";
import Sidebar from "./Sidebar";
import {
  ConfidenceDots,
  ImpactMetricCard,
  SeverityBadge,
  StatusPill,
  StickyDatasetHeader,
  WorkflowLabel,
  WorkflowModeSelector,
} from "./harmoniq-ui";

interface ProfileScreenProps {
  fileName: string;
  uploadedAt: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  readinessScore: number;
  workflowMode: WorkflowMode;
  onWorkflowModeChange: (mode: WorkflowMode) => void;
  onBeginReview: () => void;
  onNavigate: (screen: "upload" | "profile" | "review" | "results") => void;
}

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
  workflowMode,
  onWorkflowModeChange,
  onBeginReview,
  onNavigate,
}: ProfileScreenProps) {
  const workflow = WORKFLOW_MODES[workflowMode];
  const definitions = getWorkflowIssueDefinitions(workflowMode);
  const impactMetrics = getWorkflowImpactMetrics(workflowMode, issueStatuses);
  const pendingIssueCount = definitions.filter((definition) => issueStatuses[definition.type] === "pending").length;
  const totalIssues = definitions.reduce((sum, definition) => sum + definition.recordCount, 0);
  const openImpactCount = impactMetrics.reduce((sum, metric) => sum + metric.value, 0);
  const issueCountsByCategory = definitions.reduce<Record<string, number>>((counts, definition) => {
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
        workflowMode={workflowMode}
        onNavigate={onNavigate}
      />

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
        <StickyDatasetHeader
          title="Profile Overview"
          subtitle={`${fileName || DATASET_META.fileName} · ${workflow.label} · analyzed ${formatDate(uploadedAt)}`}
          badge={<StatusPill status="pending" />}
          actions={
            <>
              <WorkflowModeSelector value={workflowMode} onChange={onWorkflowModeChange} compact />
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
            </>
          }
        />

        <div className="max-w-6xl space-y-6 px-6 py-6">
          <section className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{workflow.readinessNoun}</p>
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
              <p className={`mt-4 text-sm font-bold ${pendingIssueCount === 0 ? "text-emerald-700" : "text-red-700"}`}>
                {pendingIssueCount === 0
                  ? `Ready for ${workflow.shortLabel.toLowerCase()} review`
                  : `Not ready for ${workflow.shortLabel.toLowerCase()} - ${pendingIssueCount} issue types unresolved`}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {workflow.description} Weighted by active workflow impact, ambiguity, and whether a fix can apply without business context.
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
                    <dd className="text-2xl font-black text-slate-950 tabular-nums">{definitions.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Findings</dt>
                    <dd className="text-2xl font-black text-red-600 tabular-nums">{totalIssues}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active workflow mode</p>
                <p className="mt-4 text-2xl font-black text-slate-950">{workflow.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{openImpactCount} unresolved impact signals</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  {workflow.primaryRisk}
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
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-slate-950">Downstream Impact Simulator</h2>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                  {workflow.shortLabel}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {impactMetrics.map((metric) => (
                  <ImpactMetricCard key={metric.label} metric={metric} />
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
              {definitions.map((definition, index) => {
                const status = issueStatuses[definition.type];
                return (
                  <button
                    key={definition.type}
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
                <p className="text-xs font-black text-slate-900">1. {workflow.shortLabel} blockers first</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Issue order changes based on the selected workflow mode, so the highest business risk appears first.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-900">2. Review-first suggestions remain visible</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Missing owner, segment, state, and lifecycle recommendations show confidence and rationale before approval.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-900">3. Deterministic cleanup is still traceable</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Lower-risk changes stay transparent, reversible, and logged with the same approval trail.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
