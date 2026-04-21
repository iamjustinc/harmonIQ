"use client";

import type { IssueStatus, IssueType } from "@/lib/types";
import type { ApprovedChange } from "@/lib/types";
import { DETECTED, generateChanges, ISSUE_DEFINITIONS } from "@/lib/issueDetection";
import Sidebar from "./Sidebar";
import {
  ConfidenceDots,
  DiffCell,
  DownstreamBox,
  IssueQueueItem,
  RationaleBlock,
  ScoreImpactBox,
  SeverityBadge,
  StatusPill,
  StickyDatasetHeader,
  WorkflowLabel,
} from "./harmoniq-ui";

interface ReviewScreenProps {
  fileName: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  readinessScore: number;
  activeIssueType: IssueType;
  onApprove: (issueType: IssueType, changes: ApprovedChange[]) => void;
  onSkip: (issueType: IssueType) => void;
  onUndo: (issueType: IssueType) => void;
  onSelectIssue: (issueType: IssueType) => void;
  onFinish: () => void;
  onNavigate: (screen: "upload" | "profile" | "review" | "results") => void;
}

type FlagRow = {
  id: string;
  scope: string;
  current: string;
  issue: string;
  recommendation: string;
  trustCue: string;
};

type DiffRow = {
  id: string;
  account: string;
  field: string;
  before: string;
  after: string;
  basis: string;
};

function getDefinition(type: IssueType) {
  return ISSUE_DEFINITIONS.find((definition) => definition.type === type)!;
}

function getFlagRows(type: IssueType): FlagRow[] {
  if (type === "missing_owner") {
    return DETECTED.missingOwner.map(({ record, ownerValue }) => ({
      id: record.record_id,
      scope: `${record.record_id} - ${record.account_name.trim()}`,
      current: ownerValue || "(blank)",
      issue: "Owner cannot be used for routing.",
      recommendation: "Set owner to Unassigned - Review.",
      trustCue: "Review-first; no owner is inferred.",
    }));
  }

  if (type === "invalid_email") {
    return DETECTED.invalidEmails.map(({ record, emailValue, reason, suggestedValue }) => ({
      id: record.record_id,
      scope: `${record.record_id} - ${record.contact_name}`,
      current: emailValue || "(blank)",
      issue: reason,
      recommendation: suggestedValue ? `Correct to ${suggestedValue}` : "Flag for manual correction.",
      trustCue: suggestedValue ? "Obvious syntax repair found." : "No safe correction inferred.",
    }));
  }

  if (type === "missing_segment") {
    return DETECTED.missingSegments.map(({ record, segmentValue }) => ({
      id: record.record_id,
      scope: `${record.record_id} - ${record.account_name.trim()}`,
      current: segmentValue || "(blank)",
      issue: "Segment is unavailable for planning and routing rules.",
      recommendation: "Flag segment for business review.",
      trustCue: "Review-first; no segment is inferred.",
    }));
  }

  if (type === "schema_mismatch") {
    return DETECTED.schemaMismatches.map((item) => ({
      id: item.source,
      scope: `${item.scope}: ${item.source}`,
      current: item.source,
      issue: item.reason,
      recommendation: `Map to ${item.expected}.`,
      trustCue: item.impact,
    }));
  }

  return [];
}

function getDiffRows(type: IssueType): DiffRow[] {
  if (type === "inconsistent_state") {
    return DETECTED.inconsistentStates.map(({ record, currentValue, standardValue }) => ({
      id: `${record.record_id}-state`,
      account: record.account_name.trim(),
      field: "state",
      before: currentValue,
      after: standardValue,
      basis: "USPS two-letter state normalization.",
    }));
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

function FlagTable({ issueType }: { issueType: IssueType }) {
  const rows = getFlagRows(issueType);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              {["Scope", "Current value", "Issue", "Recommended handling", "Trust cue"].map((heading) => (
                <th key={heading} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.slice(0, 12).map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 text-xs font-bold text-slate-800">{row.scope}</td>
                <td className="px-3 py-3">
                  <span className="rounded border border-red-200 bg-red-50 px-2 py-1 font-mono text-xs text-red-700">{row.current}</span>
                </td>
                <td className="px-3 py-3 text-xs text-slate-600">{row.issue}</td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-800">{row.recommendation}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{row.trustCue}</td>
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

function DiffTable({ issueType }: { issueType: IssueType }) {
  const rows = getDiffRows(issueType);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 bg-emerald-50 px-3 py-2">
        <p className="text-xs font-bold text-emerald-800">Deterministic transformation pattern - batch approval is reviewable and reversible.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              {["Record", "Field", "Before / After", "Basis"].map((heading) => (
                <th key={heading} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.slice(0, 14).map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 text-xs font-bold text-slate-800">{row.account}</td>
                <td className="px-3 py-3 font-mono text-xs text-indigo-700">{row.field}</td>
                <td className="px-3 py-3">
                  <DiffCell before={row.before} after={row.after} />
                </td>
                <td className="px-3 py-3 text-xs text-slate-600">{row.basis}</td>
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

function RecordPreview({ issueType }: { issueType: IssueType }) {
  if (issueType === "duplicate_accounts") return <ClusterView />;
  if (issueType === "inconsistent_state" || issueType === "naming_format") return <DiffTable issueType={issueType} />;
  return <FlagTable issueType={issueType} />;
}

export default function ReviewScreen({
  fileName,
  issueStatuses,
  readinessScore,
  activeIssueType,
  onApprove,
  onSkip,
  onUndo,
  onSelectIssue,
  onFinish,
  onNavigate,
}: ReviewScreenProps) {
  const definition = getDefinition(activeIssueType);
  const status = issueStatuses[activeIssueType];
  const reviewedCount = Object.values(issueStatuses).filter((item) => item !== "pending").length;
  const allReviewed = reviewedCount === ISSUE_DEFINITIONS.length;

  const approveCurrentIssue = () => {
    onApprove(activeIssueType, generateChanges(activeIssueType));
  };

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar
        screen="review"
        fileName={fileName}
        readinessScore={readinessScore}
        issueStatuses={issueStatuses}
        onNavigate={onNavigate}
      />

      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-sm font-black text-slate-950">Issue Queue</h2>
          <p className="mt-1 text-xs text-slate-500">{reviewedCount} of {ISSUE_DEFINITIONS.length} reviewed</p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${(reviewedCount / ISSUE_DEFINITIONS.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {ISSUE_DEFINITIONS.map((item) => (
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
              className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700"
            >
              View Results
            </button>
          </div>
        ) : null}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50">
        <StickyDatasetHeader
          title={definition.title}
          subtitle={`${definition.recordCount} findings - ${definition.businessImpact}`}
          badge={
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={definition.severity} />
              <WorkflowLabel label={definition.workflowLabel} severity={definition.severity} />
              <StatusPill status={status} />
            </div>
          }
        />

        <div className="space-y-4 px-6 py-5">
          <RationaleBlock title="Why this ranks here">
            <p>{definition.priorityReason}</p>
          </RationaleBlock>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">Record-Level Review Preview</h2>
                <p className="mt-0.5 text-xs text-slate-500">Before/after evidence for the selected issue type.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">
                {definition.reviewMode}
              </span>
            </div>
            <div className="p-4">
              <RecordPreview issueType={activeIssueType} />
            </div>
          </section>
        </div>
      </main>

      <aside className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-sm font-black text-slate-950">AI Recommendation</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Structured reasoning - human approval required</p>
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
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Trust cues</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-700">
              <li>No row-level approval or inline editing in V1.</li>
              <li>Recommendation copy comes from issue definitions.</li>
              <li>Approved changes are logged before export.</li>
            </ul>
          </section>
        </div>

        <div className="space-y-2 border-t border-slate-200 p-4">
          {status === "pending" ? (
            <>
              <button
                type="button"
                onClick={approveCurrentIssue}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Approve Issue Type
              </button>
              <button
                type="button"
                onClick={() => onSkip(activeIssueType)}
                className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Skip For Now
              </button>
            </>
          ) : (
            <>
              <div className="flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <StatusPill status={status} />
              </div>
              <button
                type="button"
                onClick={() => onUndo(activeIssueType)}
                className="flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Undo Decision
              </button>
            </>
          )}

          {allReviewed ? (
            <button
              type="button"
              onClick={onFinish}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700"
            >
              View Results
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
