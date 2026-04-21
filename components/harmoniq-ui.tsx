import type { ReactNode } from "react";
import type { IssueDefinition, IssueSeverity, IssueStatus, WorkflowImpactMetric, WorkflowMode } from "@/lib/types";
import { WORKFLOW_MODE_ORDER, WORKFLOW_MODES } from "@/lib/workflows";

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
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${severityStyles[severity]}`}>
      {severityLabels[severity]}
    </span>
  );
}

export function StatusPill({ status }: { status: IssueStatus }) {
  const styles: Record<IssueStatus, string> = {
    pending:  "bg-slate-50 text-slate-500 border-slate-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-300",
    skipped:  "bg-slate-100 text-slate-400 border-slate-200",
  };
  const labels: Record<IssueStatus, string> = {
    pending:  "Pending",
    approved: "Approved",
    skipped:  "Skipped",
  };
  const icons: Record<IssueStatus, ReactNode> = {
    pending: <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />,
    approved: (
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
        <path d="M1.5 4.5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    skipped: (
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
        <path d="M2 4.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}

export function ConfidenceDots({ pct }: { pct: number }) {
  const filled = Math.max(1, Math.round(pct / 20));
  return (
    <span className="inline-flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i <= filled ? "bg-slate-700" : "bg-slate-200"}`}
        />
      ))}
      <span className="ml-0.5 text-xs font-bold text-slate-600">{pct}%</span>
    </span>
  );
}

export function WorkflowLabel({ label, severity }: { label: string; severity: IssueSeverity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityStyles[severity]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {label}
    </span>
  );
}

export function RationaleBlock({ title = "Rationale", children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export function DiffCell({ before, after }: { before: string; after: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="max-w-[160px] truncate rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] text-red-700">
        {before || "(blank)"}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-slate-400" aria-hidden="true">
        <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="max-w-[160px] truncate rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
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
  const borderAndBg = isActive
    ? "border-indigo-500 bg-indigo-50/70"
    : status === "approved"
      ? "border-emerald-400 hover:bg-slate-50"
      : status === "skipped"
        ? "border-slate-300 hover:bg-slate-50"
        : "border-transparent hover:bg-slate-50/80";

  return (
    <button
      onClick={onClick}
      className={`w-full border-l-[3px] px-4 py-2.5 text-left transition-colors ${borderAndBg}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate text-[13px] font-bold leading-snug ${isActive ? "text-indigo-950" : "text-slate-800"}`}>
            {definition.title}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {definition.recordCount} findings · {definition.reviewMode}
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <StatusPill status={status} />
        </div>
      </div>
    </button>
  );
}

export function DownstreamBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-600">Downstream implication</p>
      <div className="text-xs leading-relaxed text-orange-900">{children}</div>
    </div>
  );
}

export function ScoreImpactBox({ points }: { points: number }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Score impact</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-emerald-700">+{points}</span>
        <span className="text-xs font-medium text-emerald-600">readiness points</span>
      </div>
    </div>
  );
}

export function WorkflowModeSelector({
  value,
  onChange,
  compact = false,
}: {
  value: WorkflowMode;
  onChange: (mode: WorkflowMode) => void;
  compact?: boolean;
}) {
  const active = WORKFLOW_MODES[value];

  return (
    <label className="flex items-center gap-2">
      {!compact ? (
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Preparing for
        </span>
      ) : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as WorkflowMode)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm outline-none hover:border-indigo-300 focus:border-indigo-500"
        aria-label={`Workflow readiness mode: ${active.label}`}
      >
        {WORKFLOW_MODE_ORDER.map((mode) => (
          <option key={mode} value={mode}>
            {WORKFLOW_MODES[mode].label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ImpactMetricCard({ metric, compact = false }: { metric: WorkflowImpactMetric; compact?: boolean }) {
  const accent: Record<IssueSeverity, string> = {
    blocking: "border-red-200 bg-red-50 text-red-700",
    high: "border-red-200 bg-red-50 text-red-700",
    "medium-high": "border-orange-200 bg-orange-50 text-orange-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    "low-medium": "border-lime-200 bg-lime-50 text-lime-700",
    low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`rounded-lg border ${compact ? "p-3" : "p-3.5"} ${accent[metric.severity]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{metric.label}</p>
      <div className={`${compact ? "mt-1.5" : "mt-2"} flex items-baseline gap-1.5`}>
        <span className={`${compact ? "text-2xl" : "text-3xl"} font-black tabular-nums`}>{metric.value}</span>
        <span className="text-xs font-bold">{metric.unit}</span>
      </div>
      <p className={`${compact ? "mt-1.5 text-[11px]" : "mt-2 text-xs"} leading-relaxed opacity-90`}>{metric.detail}</p>
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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[15px] font-black tracking-tight text-slate-950">{title}</h1>
            {badge}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
