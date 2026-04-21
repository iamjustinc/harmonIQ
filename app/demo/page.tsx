"use client";

import { useState, useCallback } from "react";
import type { AppScreen, IssueType, IssueStatus, ApprovedChange } from "@/lib/types";
import {
  INITIAL_SCORE,
  calculateScore,
  ISSUE_TYPE_ORDER,
} from "@/lib/issueDetection";

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

// ─── Demo workspace page ──────────────────────────────────────────────────────
export default function DemoPage() {
  const [screen, setScreen] = useState<AppScreen>("upload");
  const [fileName, setFileName] = useState("");
  const [uploadedAt, setUploadedAt] = useState("");
  const [issueStatuses, setIssueStatuses] = useState<Record<IssueType, IssueStatus>>(INITIAL_STATUSES);
  const [approvedChanges, setApprovedChanges] = useState<ApprovedChange[]>([]);
  const [readinessScore, setReadinessScore] = useState(INITIAL_SCORE);
  const [activeIssueType, setActiveIssueType] = useState<IssueType>(ISSUE_TYPE_ORDER[0]);

  const handleAnalyze = useCallback((name: string) => {
    setFileName(name);
    setUploadedAt(new Date().toISOString());
    setScreen("profile");
  }, []);

  const handleBeginReview = useCallback(() => {
    const first = ISSUE_TYPE_ORDER.find(t => issueStatuses[t] === "pending") ?? ISSUE_TYPE_ORDER[0];
    setActiveIssueType(first);
    setScreen("review");
  }, [issueStatuses]);

  const handleApprove = useCallback((issueType: IssueType, changes: ApprovedChange[]) => {
    const nextStatuses = { ...issueStatuses, [issueType]: "approved" as IssueStatus };
    setIssueStatuses(nextStatuses);
    setReadinessScore(calculateScore(nextStatuses));
    setApprovedChanges(prev => [...prev, ...changes]);
    const nextIssue = ISSUE_TYPE_ORDER.find(t => t !== issueType && nextStatuses[t] === "pending");
    if (nextIssue) setActiveIssueType(nextIssue);
  }, [issueStatuses]);

  const handleSkip = useCallback((issueType: IssueType) => {
    const nextStatuses = { ...issueStatuses, [issueType]: "skipped" as IssueStatus };
    setIssueStatuses(nextStatuses);
    const nextIssue = ISSUE_TYPE_ORDER.find(t => t !== issueType && nextStatuses[t] === "pending");
    if (nextIssue) setActiveIssueType(nextIssue);
  }, [issueStatuses]);

  const handleUndo = useCallback((issueType: IssueType) => {
    const nextStatuses = { ...issueStatuses, [issueType]: "pending" as IssueStatus };
    setIssueStatuses(nextStatuses);
    setReadinessScore(calculateScore(nextStatuses));
    setApprovedChanges(prev => prev.filter(c => c.issueType !== issueType));
    setActiveIssueType(issueType);
  }, [issueStatuses]);

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
    setActiveIssueType(ISSUE_TYPE_ORDER[0]);
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
        activeIssueType={activeIssueType}
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
      onNavigate={handleNavigate}
      onStartNew={handleStartNew}
    />
  );
}
