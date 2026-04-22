// ─── Core Data Types ───────────────────────────────────────────────────────

export interface CRMRecord {
  record_id: string;
  account_name: string;
  domain: string;
  owner: string;
  segment: string;
  state: string;
  country: string;
  contact_name: string;
  email: string;
  phone: string;
  harmoniq_review_status?: string;
  harmoniq_schema_notes?: string;
}

// ─── App Navigation ────────────────────────────────────────────────────────

export type AppScreen = "upload" | "profile" | "review" | "results";

export type StepStatus = "pending" | "current" | "complete";

// ─── Issue Types ───────────────────────────────────────────────────────────

export type IssueType =
  | "missing_owner"
  | "duplicate_accounts"
  | "invalid_email"
  | "missing_segment"
  | "inconsistent_state"
  | "schema_mismatch"
  | "naming_format";

export type IssueSeverity = "blocking" | "high" | "medium-high" | "medium" | "low-medium" | "low";

export type IssueStatus = "pending" | "approved" | "skipped";

// ─── Workflow Readiness Modes ──────────────────────────────────────────────

export type WorkflowMode =
  | "lead_routing"
  | "campaign_launch"
  | "quarterly_reporting"
  | "account_segmentation"
  | "enrichment_import"
  | "territory_planning";

export interface WorkflowModeDefinition {
  mode: WorkflowMode;
  label: string;
  shortLabel: string;
  readinessNoun: string;
  description: string;
  primaryRisk: string;
}

export interface WorkflowImpactMetric {
  label: string;
  value: number;
  unit: string;
  detail: string;
  issueTypes: IssueType[];
  severity: IssueSeverity;
}

export interface WorkflowIssueOverride {
  type: IssueType;
  priority?: number;
  businessImpact?: string;
  workflowLabel?: string;
  priorityReason?: string;
  downstreamImplication?: string;
  readinessImpact?: number;
}

// ─── Reviewable Resolution Suggestions ─────────────────────────────────────

export type SuggestionReviewState = "needs_approval" | "review_required" | "deterministic";

export type ReferenceSourceType = "ownership_rules" | "segment_dictionary" | "crm_reference";

export type SuggestionBasisStrength = "direct" | "strong" | "fallback" | "deterministic";

export type ResolutionType =
  | "deterministic_fix"
  | "reference_backed"
  | "ai_reviewed"
  | "manual_override"
  | "unresolved_review_required";

export interface SuggestionBasis {
  type: ReferenceSourceType | "record_heuristic" | "deterministic";
  label: string;
  detail: string;
  sourceName?: string;
  strength: SuggestionBasisStrength;
}

export interface ResolutionSuggestion {
  field: "owner" | "segment" | "state" | "country" | "lifecycle_stage" | "email" | "schema_mapping";
  suggestedValue: string;
  confidence: number;
  rationale: string;
  reviewState: SuggestionReviewState;
  basis?: SuggestionBasis;
}

// ─── Optional Reference Context ─────────────────────────────────────────────

export interface ReferenceSourceDefinition {
  type: ReferenceSourceType;
  label: string;
  expectedShape: string;
  effectDescription: string;
}

export interface ReferenceContextSource {
  type: ReferenceSourceType;
  fileName: string;
  rowCount: number;
  active: boolean;
  uploadedAt: string;
  effectDescription: string;
}

export interface OwnershipRule {
  region: string;
  territory: string;
  segment: string;
  owner: string;
  queue?: string;
  sourceName: string;
}

export interface SegmentDictionaryEntry {
  segment: string;
  allowedValues: string[];
  definition?: string;
  lifecycleStage?: string;
  sourceName: string;
}

export interface CRMReferenceRow {
  account?: string;
  domain?: string;
  state?: string;
  country?: string;
  segment?: string;
  owner?: string;
  territory?: string;
  sourceName: string;
}

export interface ReferenceContext {
  sources: ReferenceContextSource[];
  ownershipRules: OwnershipRule[];
  segmentDictionary: SegmentDictionaryEntry[];
  crmReferenceRows: CRMReferenceRow[];
}

// ─── Issue Detection Results ────────────────────────────────────────────────

export interface MissingOwnerRecord {
  record: CRMRecord;
  ownerValue: string; // "", "TBD", "Unknown", etc.
  suggestion: ResolutionSuggestion;
}

export interface DuplicateCluster {
  domain: string;
  records: CRMRecord[];
  confidence: number; // 0-100
  canonicalRecord?: CRMRecord; // suggested primary
}

export interface InvalidEmailRecord {
  record: CRMRecord;
  emailValue: string;
  reason: string; // "missing @", "no TLD", "placeholder", etc.
  suggestedValue?: string;
  suggestion?: ResolutionSuggestion;
}

export interface InconsistentStateRecord {
  record: CRMRecord;
  currentValue: string;
  standardValue: string; // 2-letter code
  suggestion: ResolutionSuggestion;
}

export interface MissingSegmentRecord {
  record: CRMRecord;
  segmentValue: string;
  suggestion: ResolutionSuggestion;
}

export interface NamingFormatRecord {
  record: CRMRecord;
  field: "account_name" | "contact_name";
  currentValue: string;
  suggestedValue: string;
  reason: string;
}

export interface SchemaMismatchRecord {
  scope: "field" | "column";
  source: string;
  expected: string;
  reason: string;
  impact: string;
  suggestion?: ResolutionSuggestion;
}

// ─── Issue Definition (for UI display) ─────────────────────────────────────

export interface IssueDefinition {
  type: IssueType;
  title: string;
  severity: IssueSeverity;
  category: "Routing" | "Records" | "Outreach" | "Segmentation" | "Standardization" | "Schema";
  recordCount: number;
  businessImpact: string;       // short label for the card
  workflowLabel: string;        // e.g. "Blocking Routing"
  confidence: number;           // 0-100
  priorityReason: string;       // why it ranks where it does
  reviewMode: string;           // review-first, deterministic, cluster review, etc.
  whyItMatters: string;         // paragraph for the review panel
  suggestedAction: string;      // plain-English recommendation
  riskLevel: "High" | "Medium-High" | "Medium" | "Low";
  downstreamImplication: string;
  canBatchAccept: boolean;      // for "Accept All Low-Risk" button
  readinessImpact: number;      // score points gained by approving
}

// ─── Approved Changes ──────────────────────────────────────────────────────

export interface ApprovedChange {
  changeId: string;
  recordId: string;
  accountName: string;
  field: string;
  before: string;
  after: string;
  issueType: IssueType;
  timestamp: string;
  riskLevel: "High" | "Medium-High" | "Medium" | "Low";
  userDecision: "Accepted" | "Rejected" | "Flagged";
  /** Label shown in audit trail and cleaned preview ("Based on ownership rules", etc.) */
  basisLabel?: string;
  /** Drives color coding in cleaned dataset preview */
  basisStrength?: SuggestionBasisStrength;
  /** Explains how the final value or review status was produced */
  resolutionType?: ResolutionType;
  /** Concise evidence note for results and exported change summary */
  evidenceDetail?: string;
  /** Present when AI reviewed a bounded candidate set for this change */
  aiCandidateCount?: number;
  /** Short selected/rejected candidate comparison for audit surfaces */
  candidateComparison?: string;
}

// ─── App State ─────────────────────────────────────────────────────────────

export interface AppState {
  screen: AppScreen;
  fileName: string;
  uploadedAt: string;
  issueStatuses: Record<IssueType, IssueStatus>;
  approvedChanges: ApprovedChange[];
  readinessScore: number;
  activeIssueType: IssueType;
  workflowMode: WorkflowMode;
  referenceContext: ReferenceContext;
}
