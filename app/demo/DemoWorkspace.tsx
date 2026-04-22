"use client";

import { useState, useCallback, useEffect } from "react";
import type { AppScreen, IssueType, IssueStatus, ApprovedChange, WorkflowMode, ReferenceSourceType, ReferenceContext } from "@/lib/types";
import {
  INITIAL_SCORE,
} from "@/lib/issueDetection";
import {
  calculateWorkflowScore,
  DEFAULT_WORKFLOW_MODE,
  getWorkflowIssueOrder,
} from "@/lib/workflows";
import { DATASET_META } from "@/lib/data";
import {
  attachReferenceCsv,
  createSampleReferenceContext,
  EMPTY_REFERENCE_CONTEXT,
  hasReferenceSources,
  updateReferenceSourceActive,
} from "@/lib/referenceContext";

import UploadScreen from "@/components/UploadScreen";
import ProfileScreen from "@/components/ProfileScreen";
import ReviewScreen from "@/components/ReviewScreen";
import ResultsScreen from "@/components/ResultsScreen";

// ─── Initial issue statuses ───────────────────────────────────────────────────
const INITIAL_STATUSES: Record<IssueType, IssueStatus> = {
  missing_owner: "pending",
  duplicate_accounts: "pending",
  invalid_email: "pending",
  missing_segment: "pending",
  inconsistent_state: "pending",
  schema_mismatch: "pending",
  naming_format: "pending",
};

interface DemoWorkspaceProps {
  initialSample?: boolean;
}

const SAVED_PROGRESS_KEY = "harmoniq.reviewProgress.v1";

type SavedProgressSnapshot = {
  version: 1;
  savedAt: string;
  screen: AppScreen;
  fileName: string;
  uploadedAt: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  approvedChanges: ApprovedChange[];
  readinessScore: number;
  activeIssueType: IssueType;
  workflowMode: WorkflowMode;
  referenceContext: ReferenceContext;
  reviewedIssueCount: number;
  appliedIssueCount: number;
};

// ─── Demo workspace ──────────────────────────────────────────────────────────
export default function DemoWorkspace({ initialSample = false }: DemoWorkspaceProps) {
  const [screen, setScreen] = useState<AppScreen>(initialSample ? "profile" : "upload");
  const [fileName, setFileName] = useState(initialSample ? DATASET_META.fileName : "");
  const [uploadedAt, setUploadedAt] = useState(() => initialSample ? new Date().toISOString() : "");
  const [issueStatuses, setIssueStatuses] = useState<Record<IssueType, IssueStatus>>(INITIAL_STATUSES);
  const [approvedChanges, setApprovedChanges] = useState<ApprovedChange[]>([]);
  const [readinessScore, setReadinessScore] = useState(INITIAL_SCORE);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(DEFAULT_WORKFLOW_MODE);
  const [activeIssueType, setActiveIssueType] = useState<IssueType>(getWorkflowIssueOrder(DEFAULT_WORKFLOW_MODE)[0]);
  const [referenceContext, setReferenceContext] = useState<ReferenceContext>(() => initialSample ? createSampleReferenceContext() : EMPTY_REFERENCE_CONTEXT);
  const [lastSavedAt, setLastSavedAt] = useState("");

  useEffect(() => {
    const rawProgress = window.localStorage.getItem(SAVED_PROGRESS_KEY);
    if (!rawProgress) return;

    try {
      const saved = JSON.parse(rawProgress) as SavedProgressSnapshot;
      if (saved.version !== 1) return;

      setScreen(saved.screen === "upload" ? "profile" : saved.screen);
      setFileName(saved.fileName || DATASET_META.fileName);
      setUploadedAt(saved.uploadedAt);
      setIssueStatuses(saved.issueStatuses);
      setApprovedChanges(saved.approvedChanges);
      setReadinessScore(saved.readinessScore);
      setWorkflowMode(saved.workflowMode);
      setActiveIssueType(saved.activeIssueType);
      setReferenceContext(saved.referenceContext ?? EMPTY_REFERENCE_CONTEXT);
      setLastSavedAt(saved.savedAt);
    } catch {
      window.localStorage.removeItem(SAVED_PROGRESS_KEY);
    }
  }, []);

  const handleSaveProgress = useCallback(() => {
    const savedAt = new Date().toISOString();
    const snapshot: SavedProgressSnapshot = {
      version: 1,
      savedAt,
      screen,
      fileName: fileName || DATASET_META.fileName,
      uploadedAt,
      issueStatuses,
      approvedChanges,
      readinessScore,
      activeIssueType,
      workflowMode,
      referenceContext,
      reviewedIssueCount: Object.values(issueStatuses).filter((status) => status !== "pending").length,
      appliedIssueCount: Object.values(issueStatuses).filter((status) => status === "approved").length,
    };

    window.localStorage.setItem(SAVED_PROGRESS_KEY, JSON.stringify(snapshot));
    setLastSavedAt(savedAt);
  }, [
    activeIssueType,
    approvedChanges,
    fileName,
    issueStatuses,
    readinessScore,
    referenceContext,
    screen,
    uploadedAt,
    workflowMode,
  ]);

  const handleAnalyze = useCallback((name: string) => {
    if (name === DATASET_META.fileName && !hasReferenceSources(referenceContext)) {
      setReferenceContext(createSampleReferenceContext());
    }
    setFileName(name);
    setUploadedAt(new Date().toISOString());
    setScreen("profile");
  }, [referenceContext]);

  const handleAttachReferenceFile = useCallback((type: ReferenceSourceType, name: string, csv: string) => {
    setReferenceContext((current) => attachReferenceCsv(current, type, name, csv));
  }, []);

  const handleAttachSampleReferencePack = useCallback(() => {
    setReferenceContext(createSampleReferenceContext());
  }, []);

  const handleToggleReferenceSource = useCallback((type: ReferenceSourceType, active: boolean) => {
    setReferenceContext((current) => updateReferenceSourceActive(current, type, active));
  }, []);

  const handleBeginReview = useCallback(() => {
    const order = getWorkflowIssueOrder(workflowMode);
    const first = order.find(t => issueStatuses[t] === "pending") ?? order[0];
    setActiveIssueType(first);
    setScreen("review");
  }, [issueStatuses, workflowMode]);

  const handleWorkflowModeChange = useCallback((mode: WorkflowMode) => {
    setWorkflowMode(mode);
    setReadinessScore(calculateWorkflowScore(issueStatuses, mode));
    setActiveIssueType((current) => {
      const order = getWorkflowIssueOrder(mode);
      return order.includes(current) ? current : order[0];
    });
  }, [issueStatuses]);

  const handleApprove = useCallback((issueType: IssueType, changes: ApprovedChange[]) => {
    const nextStatuses = { ...issueStatuses, [issueType]: "approved" as IssueStatus };
    setIssueStatuses(nextStatuses);
    setReadinessScore(calculateWorkflowScore(nextStatuses, workflowMode));
    setApprovedChanges(prev => [...prev, ...changes]);
    const nextIssue = getWorkflowIssueOrder(workflowMode).find(t => t !== issueType && nextStatuses[t] === "pending");
    if (nextIssue) setActiveIssueType(nextIssue);
  }, [issueStatuses, workflowMode]);

  const handleSkip = useCallback((issueType: IssueType) => {
    const nextStatuses = { ...issueStatuses, [issueType]: "skipped" as IssueStatus };
    setIssueStatuses(nextStatuses);
    const nextIssue = getWorkflowIssueOrder(workflowMode).find(t => t !== issueType && nextStatuses[t] === "pending");
    if (nextIssue) setActiveIssueType(nextIssue);
  }, [issueStatuses, workflowMode]);

  const handleUndo = useCallback((issueType: IssueType) => {
    const nextStatuses = { ...issueStatuses, [issueType]: "pending" as IssueStatus };
    setIssueStatuses(nextStatuses);
    setReadinessScore(calculateWorkflowScore(nextStatuses, workflowMode));
    setApprovedChanges(prev => prev.filter(c => c.issueType !== issueType));
    setActiveIssueType(issueType);
  }, [issueStatuses, workflowMode]);

  const handleSelectIssue = useCallback((issueType: IssueType) => {
    setActiveIssueType(issueType);
  }, []);

  const handleFinish = useCallback(() => {
    setScreen("results");
  }, []);

  const handleStartNew = useCallback(() => {
    setScreen("upload");
    setFileName("");
    setUploadedAt("");
    setIssueStatuses(INITIAL_STATUSES);
    setApprovedChanges([]);
    setReadinessScore(INITIAL_SCORE);
    setWorkflowMode(DEFAULT_WORKFLOW_MODE);
    setActiveIssueType(getWorkflowIssueOrder(DEFAULT_WORKFLOW_MODE)[0]);
    setReferenceContext(EMPTY_REFERENCE_CONTEXT);
    setLastSavedAt("");
    window.localStorage.removeItem(SAVED_PROGRESS_KEY);
  }, []);

  const handleNavigate = useCallback((s: "upload" | "profile" | "review" | "results") => {
    setScreen(s);
  }, []);

  if (screen === "upload") {
    return (
      <UploadScreen
        referenceContext={referenceContext}
        onAnalyze={handleAnalyze}
        onAttachReferenceFile={handleAttachReferenceFile}
        onAttachSampleReferencePack={handleAttachSampleReferencePack}
        onToggleReferenceSource={handleToggleReferenceSource}
      />
    );
  }

  if (screen === "profile") {
    return (
      <ProfileScreen
        fileName={fileName}
        uploadedAt={uploadedAt}
        issueStatuses={issueStatuses}
        readinessScore={readinessScore}
        workflowMode={workflowMode}
        referenceContext={referenceContext}
        onWorkflowModeChange={handleWorkflowModeChange}
        onBeginReview={handleBeginReview}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen === "review") {
    return (
      <ReviewScreen
        fileName={fileName}
        issueStatuses={issueStatuses}
        readinessScore={readinessScore}
        workflowMode={workflowMode}
        referenceContext={referenceContext}
        activeIssueType={activeIssueType}
        lastSavedAt={lastSavedAt}
        onWorkflowModeChange={handleWorkflowModeChange}
        onApprove={handleApprove}
        onSkip={handleSkip}
        onUndo={handleUndo}
        onSelectIssue={handleSelectIssue}
        onSaveProgress={handleSaveProgress}
        onFinish={handleFinish}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <ResultsScreen
      fileName={fileName}
      uploadedAt={uploadedAt}
      issueStatuses={issueStatuses}
      approvedChanges={approvedChanges}
      readinessScore={readinessScore}
      workflowMode={workflowMode}
      onWorkflowModeChange={handleWorkflowModeChange}
      onNavigate={handleNavigate}
      onStartNew={handleStartNew}
    />
  );
}
