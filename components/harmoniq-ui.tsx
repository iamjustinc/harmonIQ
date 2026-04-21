import type { ReactNode } from "react";
import type { IssueDefinition, IssueSeverity, IssueStatus } from "@/lib/types";

const severityStyles: Record<IssueSeverity, string> = {
  blocking: "bg-red-100 text-red-800 border-red-200",
  high: "bg-red-50 text-red-700 border-red-200",
  "medium-high": "bg-orange-50 text-orange-700 border-orange-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  "low-medium": "bg-lime-50 text-lime-700 border-lime-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const severityLabels: Record<IssueSeverity, string> = {
  blocking: "Blocking",
  high: "High",
  "medium-high": "Medium-high",
  medium: "Medium",
  "low-medium": "Low-medium",
  low: "Low",
};

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${severityStyles[severity]}`}>
      {severityLabels[severity]}
    </span>
  );
}

export function StatusPill({ status }: { status: IssueStatus }) {
  const styles: Record<IssueStatus, string> = {
    pending: "bg-slate-50 text-slate-600 border-slate-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    skipped: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const labels: Record<IssueStatus, string> = {
    pending: "Pending",
    approved: "Approved",
    skipped: "Skipped",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labels[status]}
    </span>
  );
}

export function ConfidenceDots({ pct }: { pct: number }) {
  const filled = Math.max(1, Math.round(pct / 20));
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i <= filled ? "bg-slate-700" : "bg-slate-200"}`} />
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-600">{pct}%</span>
    </span>
  );
}

export function WorkflowLabel({ label, severity }: { label: string; severity: IssueSeverity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityStyles[severity]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

export function RationaleBlock({ title = "Rationale", children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export function DiffCell({ before, after }: { before: string; after: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="max-w-[180px] truncate rounded border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-xs text-amber-800">
        {before || "(blank)"}
      </span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400" aria-hidden="true">
        <path d="M2.5 7h8M7.5 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="max-w-[180px] truncate rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-xs font-semibold text-emerald-800">
        {after || "(blank)"}
      </span>
    </div>
  );
}

export function IssueQueueItem({
  definition,
  status,
  isActive,
  onClick,
}: {
  definition: IssueDefinition;
  status: IssueStatus;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${
        isActive ? "border-indigo-600 bg-indigo-50" : "border-transparent hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate text-[13px] font-bold ${isActive ? "text-indigo-950" : "text-slate-800"}`}>
            {definition.title}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {definition.recordCount} findings - {definition.reviewMode}
          </p>
        </div>
        <StatusPill status={status} />
      </div>
    </button>
  );
}

export function DownstreamBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-orange-700">Downstream implication</p>
      <div className="text-xs leading-relaxed text-orange-900">{children}</div>
    </div>
  );
}

export function ScoreImpactBox({ points }: { points: number }) {
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">Score impact</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-indigo-700">+{points}</span>
        <span className="text-xs font-medium text-indigo-600">readiness points</span>
      </div>
    </div>
  );
}

export function StickyDatasetHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-black tracking-tight text-slate-950">{title}</h1>
            {badge}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
