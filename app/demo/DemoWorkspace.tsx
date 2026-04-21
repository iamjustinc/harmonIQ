"use client";

import { useState, useCallback } from "react";
import type { AppScreen, IssueType, IssueStatus, ApprovedChange, WorkflowMode } from "@/lib/types";
import {
  INITIAL_SCORE,
} from "@/lib/issueDetection";
import {
  calculateWorkflowScore,
  DEFAULT_WORKFLOW_MODE,
  getWorkflowIssueOrder,
} from "@/lib/workflows";
import { DATASET_META } from "@/lib/data";

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

  const handleAnalyze = useCallback((name: string) => {
    setFileName(name);
    setUploadedAt(new Date().toISOString());
    setScreen("profile");
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
  }, []);

  const handleNavigate = useCallback((s: "upload" | "profile" | "review" | "results") => {
    setScreen(s);
  }, []);

  if (screen === "upload") {
    return <UploadScreen onAnalyze={handleAnalyze} />;
  }

  if (screen === "profile") {
    return (
      <ProfileScreen
        fileName={fileName}
        uploadedAt={uploadedAt}
        issueStatuses={issueStatuses}
        readinessScore={readinessScore}
        workflowMode={workflowMode}
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
        activeIssueType={activeIssueType}
        onWorkflowModeChange={handleWorkflowModeChange}
        onApprove={handleApprove}
        onSkip={handleSkip}
        onUndo={handleUndo}
        onSelectIssue={handleSelectIssue}
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
