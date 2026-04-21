import Link from "next/link";

// ─── Product mock rendered inside the hero ────────────────────────────────────
// Represents the Decision Workspace at reduced scale.
// Built at 900×520px, displayed at 0.62× → ~558×322px.
function ProductMock() {
  type QueueItem = {
    title: string;
    count: number;
    mode: string;
    status: "approved" | "skipped" | "pending";
    active: boolean;
  };

  const queueItems: QueueItem[] = [
    { title: "Missing Owner Fields",      count: 14, mode: "Review-first",             status: "approved", active: false },
    { title: "Duplicate Account Records", count: 18, mode: "Cluster review",            status: "skipped",  active: false },
    { title: "Invalid Email Formats",     count: 8,  mode: "Suggest obvious fixes",     status: "pending",  active: true  },
    { title: "Missing Segment Values",    count: 10, mode: "Review-first",             status: "pending",  active: false },
    { title: "Inconsistent State Values", count: 51, mode: "Deterministic correction", status: "pending",  active: false },
    { title: "Schema Mismatch",           count: 2,  mode: "Mapping confirmation",     status: "pending",  active: false },
    { title: "Improper Naming Format",    count: 12, mode: "Deterministic cleanup",    status: "pending",  active: false },
  ];

  const tableRows = [
    { scope: "REC-003 · Altura Systems",   current: "none@",                 issue: "Incomplete address",  rec: "Flag for correction"         },
    { scope: "REC-007 · SableWorks",       current: "sam@",                  issue: "Missing domain",      rec: "Flag for correction"         },
    { scope: "REC-012 · Meridian Corp",    current: "info#meridian.co",      issue: "Invalid character",   rec: "Correct to info@meridian.co" },
    { scope: "REC-019 · BluePeak Retail",  current: "jamie@bluepeakretail",  issue: "Missing TLD",         rec: "Correct to .com"             },
  ];

  return (
    // Outer: clips the scaled content to the visual size
    <div
      className="relative overflow-hidden rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/5"
      style={{ height: "322px" }}
      aria-hidden="true"
    >
      {/* Scale wrapper: 900px wide inner mock scaled to 62% = 558px */}
      <div style={{ transform: "scale(0.62)", transformOrigin: "top left", width: "900px" }}>

        {/* ── Browser chrome ── */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100/80 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-red-400/60" />
          <span className="h-3 w-3 rounded-full bg-amber-400/60" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/60" />
          <div className="ml-3 flex flex-1 justify-center">
            <div className="flex w-56 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-slate-400 shrink-0">
                <rect x="1" y="1" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3.5 5.5h4M5.5 3.5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="font-mono text-[11px] text-slate-400">harmoniq.app/demo</span>
            </div>
          </div>
        </div>

        {/* ── App shell ── */}
        <div className="flex" style={{ height: "480px" }}>

          {/* Sidebar */}
          <div className="flex w-40 shrink-0 flex-col bg-[#0f172a] p-3.5">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-600">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 3.5h11M1.5 7h7M1.5 10.5h9" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-[13px] font-bold tracking-tight text-white">harmonIQ</span>
            </div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Workflow</p>
            {(["Upload", "Profile Overview", "Decision Workspace", "Results"] as const).map((label, i) => {
              const done   = i < 2;
              const active = i === 2;
              return (
                <div key={label} className={`mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${active ? "bg-slate-700/70 text-white" : done ? "text-slate-400" : "text-slate-600"}`}>
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold ${active ? "bg-indigo-500 text-white" : done ? "bg-slate-600 text-slate-300" : "border border-slate-700 text-slate-600"}`}>
                    {done ? (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l1.8 1.8 3.2-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className="truncate">{label}</span>
                </div>
              );
            })}
            {/* Score widget */}
            <div className="mt-auto rounded-lg border border-slate-700/50 bg-slate-800/60 p-2.5">
              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Readiness Score</p>
              <div className="mt-1.5 flex items-end gap-1">
                <span className="text-xl font-black text-white">53</span>
                <span className="pb-0.5 text-[10px] text-slate-400">/100</span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">Needs work</p>
            </div>
          </div>

          {/* Issue queue */}
          <div className="flex w-48 shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3.5 py-3">
              <p className="text-[13px] font-black text-slate-950">Issue Queue</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">2 of 7 reviewed</span>
                <span className="text-[10px] font-bold text-slate-400">29%</span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-slate-100">
                <div className="h-full w-[29%] rounded-full bg-indigo-500 transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-hidden py-1">
              {queueItems.map((item) => (
                <div
                  key={item.title}
                  className={`border-l-[3px] px-3.5 py-2 ${
                    item.active
                      ? "border-indigo-500 bg-indigo-50/70"
                      : item.status === "approved" ? "border-emerald-400"
                      : item.status === "skipped"  ? "border-slate-300"
                      : "border-transparent"
                  }`}
                >
                  <p className={`truncate text-[11px] font-bold leading-snug ${item.active ? "text-indigo-950" : "text-slate-800"}`}>
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <span className="truncate text-[9px] text-slate-400">{item.count} · {item.mode}</span>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold ${
                      item.status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : item.status === "skipped" ? "border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}>
                      {item.status === "approved" ? "✓ Approved" : item.status === "skipped" ? "— Skipped" : "· Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main record evidence panel */}
          <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-black text-slate-950">Invalid Email Formats</span>
                <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">Medium-high</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                  <span className="h-1 w-1 rounded-full bg-current" />Blocking Outreach
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  <span className="h-1 w-1 rounded-full bg-current opacity-50" />Pending
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">8 findings · Reduces outreach usability</p>
            </div>
            {/* Content */}
            <div className="space-y-3 overflow-hidden p-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Why this ranks here</p>
                <p className="text-[11px] leading-relaxed text-slate-700">Ranks above deterministic cleanup because broken email fields can create outreach failures and sender reputation risk.</p>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <p className="text-[11px] font-black text-slate-950">Record Evidence</p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-600">Suggest obvious fixes</span>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      {["Scope", "Current value", "Issue", "Recommended handling"].map((h) => (
                        <th key={h} className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map((row) => (
                      <tr key={row.scope}>
                        <td className="px-2.5 py-2 text-[10px] font-bold text-slate-800">{row.scope}</td>
                        <td className="px-2.5 py-2">
                          <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-[9px] text-red-700">{row.current}</span>
                        </td>
                        <td className="px-2.5 py-2 text-[10px] text-slate-500">{row.issue}</td>
                        <td className="px-2.5 py-2 text-[10px] font-semibold text-slate-700">{row.rec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recommendation panel */}
          <div className="flex w-52 shrink-0 flex-col border-l border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                  <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[11px] font-black text-slate-950">Analysis &amp; Recommendation</p>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">Deterministic analysis · human approval required</p>
            </div>
            <div className="flex-1 space-y-2.5 overflow-hidden p-3">
              <div>
                <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">Detection confidence</p>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => <span key={i} className="h-2 w-2 rounded-full bg-slate-700" />)}
                  <span className="ml-0.5 text-[10px] font-bold text-slate-600">99%</span>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">Risk level</p>
                <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">Medium-high</span>
              </div>
              <div>
                <p className="mb-1 text-[8px] font-bold uppercase tracking-wider text-slate-400">Rationale</p>
                <p className="text-[10px] leading-relaxed text-slate-600">Broken email values cause outreach bounce and sequence failure. Obvious fixes apply; ambiguous ones are flagged for manual review.</p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-2">
                <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-orange-600">Downstream implication</p>
                <p className="text-[10px] text-orange-900">Sequences will fail silently on these contacts, damaging sender reputation.</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-emerald-600">Score impact</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-700">+8</span>
                  <span className="text-[9px] text-emerald-600">readiness points</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 border-t border-slate-200 p-3">
              <button className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-[11px] font-bold text-white">
                <svg width="11" height="11" viewBox="0 0 9 9" fill="none">
                  <path d="M1.5 4.5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Approve Issue Type
              </button>
              <button className="flex h-7 w-full items-center justify-center rounded border border-slate-200 text-[10px] font-medium text-slate-400">
                Skip for now
              </button>
            </div>
          </div>

        </div>{/* end app shell */}
      </div>{/* end scale wrapper */}
    </div>
  );
}

// ─── Reusable section pieces ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
      {children}
    </p>
  );
}

function ProblemCard({
  severity,
  title,
  body,
}: {
  severity: "critical" | "high" | "medium";
  title: string;
  body: string;
}) {
  const dot = severity === "critical" ? "bg-red-500" : severity === "high" ? "bg-orange-400" : "bg-amber-400";
  const border = severity === "critical" ? "border-red-100" : severity === "high" ? "border-orange-100" : "border-amber-100";
  return (
    <div className={`rounded-lg border ${border} bg-white p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
        </div>
      </div>
    </div>
  );
}

function TrustItem({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
      </div>
    </div>
  );
}

// ─── Main landing page ────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-slate-900 hover:text-slate-700">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1.5 3.5h11M1.5 7h7M1.5 10.5h9" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-tight">harmonIQ</span>
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            <a href="#workflow" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
              How it works
            </a>
            <a href="#trust" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
              Trust
            </a>
          </nav>

          <Link
            href="/demo"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
          >
            Open demo
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2.5 6.5h8M7.5 3.5l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </header>

      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span className="text-[12px] font-semibold text-indigo-700">AI-assisted CRM data readiness</span>
              </div>
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-slate-950 lg:text-[3rem]">
                Turn messy CRM exports into review-ready, trustworthy data
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                harmonIQ helps operations teams find high-impact CRM issues before they break routing, reporting, segmentation, and planning.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/demo"
                  className="flex h-11 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-[15px] font-bold text-white transition-colors hover:bg-indigo-700"
                >
                  Open demo
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <a
                  href="#workflow"
                  className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  See workflow
                </a>
              </div>
              <Link
                href="/demo?sample=crm"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-100"
              >
                Start with sample dataset
                <span className="text-xs font-medium text-indigo-500">opens the readiness profile</span>
              </Link>
              <p className="mt-4 text-xs text-slate-400">Pre-loaded messy CRM dataset. No account or external upload required.</p>
            </div>

            <div className="relative hidden lg:block">
              <ProductMock />
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="border-b border-slate-100 bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 max-w-2xl">
            <SectionLabel>Why it matters</SectionLabel>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">Bad CRM data becomes operational risk</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              harmonIQ frames cleanup around the workflows that depend on the data, so teams know what to fix first.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <ProblemCard
              severity="critical"
              title="Routing breaks silently"
              body="Missing owners and segments keep records out of rep queues."
            />
            <ProblemCard
              severity="critical"
              title="Reporting gets distorted"
              body="Duplicate accounts inflate pipeline and account counts."
            />
            <ProblemCard
              severity="high"
              title="Outreach fails"
              body="Invalid email values create bounces and sequence gaps."
            />
            <ProblemCard
              severity="high"
              title="Planning loses trust"
              body="Inconsistent fields weaken segmentation and territory logic."
            />
          </div>
        </div>
      </section>

      <section id="workflow" className="border-b border-slate-100 bg-white py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 max-w-2xl">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">A simple review path from export to cleaner data</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload or start sample",
                body: "Parse a messy CRM CSV and confirm key fields like account, owner, email, state, and segment.",
              },
              {
                step: "02",
                title: "Review ranked issues",
                body: "See issues prioritized by routing, reporting, segmentation, and planning impact.",
              },
              {
                step: "03",
                title: "Approve and export",
                body: "Apply approved changes, recalculate readiness, and export a cleaned CSV plus change summary.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="font-mono text-xs font-black text-indigo-600">{item.step}</p>
                <p className="mt-3 text-base font-black text-slate-950">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="border-b border-slate-100 bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 max-w-2xl">
            <SectionLabel>Trust and reviewability</SectionLabel>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">AI assistance without a black box</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Recommendations are structured for business review: visible rationale, confidence, preview, and approval before export.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <TrustItem
              title="AI-assisted, not AI-decided"
              body="The system explains recommendations in plain English and keeps the user in control."
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 2v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              }
            />
            <TrustItem
              title="Review before export"
              body="Issue types are approved, skipped, or undone before a cleaned dataset is generated."
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 12l4-4 3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            />
            <TrustItem
              title="Rationale, confidence, preview"
              body="Each recommendation shows why it matters, how confident it is, and what will change."
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
            />
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-indigo-400">
            Interactive demo
          </p>
          <h2 className="text-3xl font-black tracking-tight text-white">Walk through the readiness review</h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Use the sample CRM dataset to see the full flow: analyze, prioritize, review recommendations, and export.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/demo?sample=crm"
              className="flex h-11 items-center gap-2 rounded-lg bg-indigo-600 px-6 text-[15px] font-bold text-white transition-colors hover:bg-indigo-500"
            >
              Start with sample dataset
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M3 7.5h9M8.5 4l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link
              href="/demo"
              className="flex h-11 items-center rounded-lg border border-slate-700 px-6 text-[15px] font-bold text-slate-200 transition-colors hover:bg-slate-900"
            >
              Open upload flow
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Built for Revenue Operations · Sales Operations · Business Operations
          </p>
        </div>
      </section>
      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1.5 3.5h11M1.5 7h7M1.5 10.5h9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-[13px] font-bold text-slate-300">harmonIQ</span>
          </div>
          <p className="text-[11px] text-slate-600">
            AI-assisted CRM data readiness · V1 demo
          </p>
        </div>
      </footer>

    </div>
  );
}
