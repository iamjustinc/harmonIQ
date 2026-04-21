"use client";

import { useCallback, useRef, useState } from "react";
import { DATASET_META } from "@/lib/data";
import { ISSUE_DEFINITIONS } from "@/lib/issueDetection";
import { SeverityBadge } from "./harmoniq-ui";

interface UploadScreenProps {
  onAnalyze: (fileName: string) => void;
}

type UploadState = "idle" | "hovering" | "loaded" | "analyzing";

const REQUIRED_COLUMNS = [
  { source: "account_name", label: "account" },
  { source: "owner", label: "owner" },
  { source: "email", label: "email" },
  { source: "state", label: "state" },
  { source: "segment", label: "segment" },
];

const ANALYSIS_STEPS = [
  "Parsing columns and detecting field types",
  "Mapping to CRM schema — confirming key fields",
  "Scoring issues by routing and pipeline risk",
  "Preparing Decision Workspace",
];

export default function UploadScreen({ onAnalyze }: UploadScreenProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSample = useCallback(() => {
    setFileName(DATASET_META.fileName);
    setUploadState("loaded");
  }, []);

  const acceptFile = useCallback((name: string) => {
    setFileName(name);
    setUploadState("loaded");
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith(".csv")) {
      acceptFile(file.name);
    } else {
      setUploadState("idle");
    }
  }, [acceptFile]);

  const handleAnalyze = useCallback(() => {
    const selectedName = fileName || DATASET_META.fileName;
    setUploadState("analyzing");
    window.setTimeout(() => onAnalyze(selectedName), 1450);
  }, [fileName, onAnalyze]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
                <path d="M2.5 4.5h12M2.5 8.5h8M2.5 12.5h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-black tracking-tight text-slate-950">harmonIQ</p>
              <p className="text-xs font-medium text-slate-500">Revenue Operations data readiness</p>
            </div>
          </div>
          <p className="hidden text-xs font-medium text-slate-500 sm:block">Local demo workspace</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h1 className="text-xl font-black tracking-tight text-slate-950">Upload CRM CSV</h1>
              <p className="mt-1 text-sm text-slate-600">
                Detect routing gaps, duplicate records, invalid emails, and schema issues — then walk each fix through human review before export.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  if (uploadState !== "analyzing") setUploadState("hovering");
                }}
                onDragLeave={() => setUploadState(fileName ? "loaded" : "idle")}
                onDrop={handleDrop}
                onClick={() => uploadState !== "analyzing" && fileRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-9 text-center transition-colors ${
                  uploadState === "hovering"
                    ? "border-indigo-400 bg-indigo-50"
                    : uploadState === "loaded" || uploadState === "analyzing"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) acceptFile(file.name);
                  }}
                />

                {uploadState === "analyzing" ? (
                  <div className="mx-auto max-w-md">
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                      <svg className="animate-spin" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
                        <path d="M11 2.5a8.5 8.5 0 0 1 8.5 8.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-900">Analyzing {fileName}</p>
                    <div className="mt-4 grid gap-2 text-left">
                      {ANALYSIS_STEPS.map((step, index) => (
                        <div
                          key={step}
                          style={{
                            animation: "step-in 0.28s ease forwards",
                            animationDelay: `${index * 0.32}s`,
                            opacity: 0,
                          }}
                          className="flex items-center gap-2 rounded-md border border-indigo-100 bg-white px-3 py-2 text-xs font-medium text-slate-600"
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-700">
                            {index + 1}
                          </span>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : fileName ? (
                  <div className="mx-auto max-w-md text-left">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
                          <path d="M3 8.5l3.3 3.3L14 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">{fileName}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Parsed as {DATASET_META.rowCount} rows across {DATASET_META.columnCount} columns.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFileName("");
                        setUploadState("idle");
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Choose a different CSV
                    </button>
                  </div>
                ) : (
                  <div className="mx-auto max-w-sm">
                    <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                        <path d="M11 4v10M7.5 10.5 11 14l3.5-3.5M4 17.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{uploadState === "hovering" ? "Drop CSV to parse" : "Drag and drop a CSV file"}</p>
                    <p className="mt-1 text-xs text-slate-500">or click to browse from your machine</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={loadSample}
                disabled={uploadState === "analyzing"}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-900">Use sample CRM dataset</span>
                  <span className="mt-0.5 block text-xs text-slate-500">messy_crm_export.csv · 79 rows · 7 issue types pre-planted for demo</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-500" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {fileName ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Detected key columns</p>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      5 of 5 confirmed
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {REQUIRED_COLUMNS.map((column) => (
                      <div key={column.source} className="rounded-md border border-emerald-200 bg-white px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{column.label}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{column.source}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!fileName || uploadState === "analyzing"}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Analyze Dataset
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M2 7.5h10M8.5 4 12 7.5 8.5 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Parsed file summary</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-2xl font-black tabular-nums text-slate-950">{DATASET_META.rowCount}</p>
                  <p className="text-xs font-medium text-slate-500">Rows</p>
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums text-slate-950">{DATASET_META.columnCount}</p>
                  <p className="text-xs font-medium text-slate-500">Columns</p>
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums text-slate-950">{ISSUE_DEFINITIONS.length}</p>
                  <p className="text-xs font-medium text-slate-500">Issue types</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Supported issue preview</p>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  Review-oriented AI
                </span>
              </div>
              <div className="space-y-2">
                {ISSUE_DEFINITIONS.map((definition) => (
                  <div key={definition.type} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">{definition.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{definition.reviewMode}</p>
                    </div>
                    <SeverityBadge severity={definition.severity} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
              <p className="text-xs font-bold text-slate-700">Trust boundary</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                All analysis runs locally on sample data. No data leaves your browser. Every change requires explicit approval before export.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
