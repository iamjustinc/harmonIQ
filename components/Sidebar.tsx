"use client";

import type { AppScreen, IssueType, IssueStatus, WorkflowMode } from "@/lib/types";
import { ISSUE_DEFINITIONS } from "@/lib/issueDetection";
import { WORKFLOW_MODES } from "@/lib/workflows";

type NavigableScreen = "upload" | "profile" | "review" | "results";

interface SidebarProps {
  screen: AppScreen;
  fileName: string;
  readinessScore: number;
  issueStatuses: Record<IssueType, IssueStatus>;
  workflowMode?: WorkflowMode;
  onNavigate?: (screen: NavigableScreen) => void;
}

const STEPS: { key: NavigableScreen; label: string }[] = [
  { key: "upload",  label: "Upload" },
  { key: "profile", label: "Profile Overview" },
  { key: "review",  label: "Decision Workspace" },
  { key: "results", label: "Results" },
];

const SCORE_COLOR = (s: number) =>
  s < 50 ? "#ef4444" : s < 70 ? "#f97316" : s < 85 ? "#eab308" : "#22c55e";

const STEP_ORDER: AppScreen[] = ["upload", "profile", "review", "results"];

export default function Sidebar({ screen, fileName, readinessScore, issueStatuses, workflowMode, onNavigate }: SidebarProps) {
  const currentIdx = STEP_ORDER.indexOf(screen);
  const reviewedCount = Object.values(issueStatuses).filter(s => s !== "pending").length;
  const totalIssues = ISSUE_DEFINITIONS.length;
  const workflow = workflowMode ? WORKFLOW_MODES[workflowMode] : null;

  // Mini circular arc SVG
  const r = 20, circ = 2 * Math.PI * r;
  const gaugeDash = circ * 0.75;
  const scoreDash = (readinessScore / 100) * gaugeDash;
  const scoreColor = SCORE_COLOR(readinessScore);

  return (
    <aside className="w-56 bg-[#0f172a] flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 3.5h11M1.5 7h7M1.5 10.5h9" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">harmonIQ</span>
        </div>
      </div>

      {/* Steps nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Workflow</p>
        {STEPS.map(({ key, label }, idx) => {
          const stepIdx = STEP_ORDER.indexOf(key);
          const isCurrent = screen === key;
          const isComplete = stepIdx < currentIdx;
          const isAccessible = stepIdx <= currentIdx || isComplete;
          const isReviewStep = key === "review";

          return (
            <button
              key={key}
              disabled={!isAccessible || !onNavigate}
              onClick={() => isAccessible && onNavigate?.(key)}
              className={`
                w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm
                transition-colors duration-100
                ${isCurrent ? "bg-slate-700/70 text-white" : ""}
                ${isComplete && !isCurrent ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200" : ""}
                ${!isAccessible ? "text-slate-600 cursor-default" : "cursor-pointer"}
                ${!isCurrent && !isComplete ? "text-slate-600" : ""}
              `}
            >
              {/* Step indicator */}
              <div className={`
                w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
                ${isCurrent ? "bg-indigo-500 text-white" : ""}
                ${isComplete ? "bg-slate-600 text-slate-300" : ""}
                ${!isCurrent && !isComplete ? "border border-slate-700 text-slate-600" : ""}
              `}>
                {isComplete ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span className="font-medium">{label}</span>

              {/* Badge for review progress */}
              {isReviewStep && (reviewedCount > 0 || isCurrent) && (
                <span className="ml-auto text-[10px] font-semibold bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                  {reviewedCount}/{totalIssues}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Readiness score mini widget */}
      {(screen === "profile" || screen === "review" || screen === "results") && (
        <div className="mx-3 mb-3 rounded-lg border border-slate-700/50 bg-slate-800/60 p-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {workflow ? workflow.shortLabel : "Readiness"} Score
          </p>
          <div className="flex items-center gap-3">
            {/* Mini gauge */}
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r={r}
                fill="none" stroke="#1e293b" strokeWidth="4"
                strokeDasharray={`${gaugeDash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(135 24 24)"
              />
              <circle cx="24" cy="24" r={r}
                fill="none" stroke={scoreColor} strokeWidth="4"
                strokeDasharray={`${scoreDash} ${circ - scoreDash}`}
                strokeLinecap="round"
                transform="rotate(135 24 24)"
              />
              <text x="24" y="26" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">
                {readinessScore}
              </text>
            </svg>
            <div>
              <p className="text-lg font-bold text-white tabular-nums">{readinessScore}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </p>
              <p className="text-[10px] text-slate-400 leading-snug">
                {readinessScore < 50 ? "Not ready" :
                 readinessScore < 70 ? "Needs work" :
                 readinessScore < 85 ? "Near ready" : "Ready"}
              </p>
            </div>
          </div>
          {workflow ? (
            <div className="mt-2 rounded border border-slate-700 bg-slate-900/50 px-2 py-1.5">
              <p className="text-[10px] font-semibold text-slate-400">Mode: {workflow.label}</p>
            </div>
          ) : null}
        </div>
      )}

      {/* File info */}
      {fileName && (
        <div className="px-4 py-3 border-t border-slate-700/60">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-500 shrink-0">
              <rect x="1.5" y="0.5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M3.5 4h5M3.5 6.5h3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            <span className="text-[11px] text-slate-500 truncate">{fileName}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
