import type {
  IssueDefinition,
  IssueStatus,
  IssueType,
  WorkflowImpactMetric,
  WorkflowIssueOverride,
  WorkflowMode,
  WorkflowModeDefinition,
} from "./types";
import { DETECTED, INITIAL_SCORE, ISSUE_DEFINITIONS, ISSUE_TYPE_ORDER } from "./issueDetection";

export const DEFAULT_WORKFLOW_MODE: WorkflowMode = "lead_routing";

export const WORKFLOW_MODE_ORDER: WorkflowMode[] = [
  "lead_routing",
  "campaign_launch",
  "quarterly_reporting",
  "account_segmentation",
  "enrichment_import",
  "territory_planning",
];

export const WORKFLOW_MODES: Record<WorkflowMode, WorkflowModeDefinition> = {
  lead_routing: {
    mode: "lead_routing",
    label: "Lead routing",
    shortLabel: "Routing",
    readinessNoun: "routing readiness",
    description: "Prepare records for owner assignment, SLA routing, and rep handoff.",
    primaryRisk: "Records without owners, standard territory fields, or valid segments can fall out of routing.",
  },
  campaign_launch: {
    mode: "campaign_launch",
    label: "Campaign launch",
    shortLabel: "Campaigns",
    readinessNoun: "campaign readiness",
    description: "Prepare contacts for usable outreach lists and campaign segmentation.",
    primaryRisk: "Invalid emails and missing segments can suppress contacts or create bounce risk.",
  },
  quarterly_reporting: {
    mode: "quarterly_reporting",
    label: "Quarterly reporting",
    shortLabel: "Reporting",
    readinessNoun: "reporting readiness",
    description: "Prepare account records for executive reporting and pipeline review.",
    primaryRisk: "Duplicate accounts and inconsistent fields can distort account counts and segment views.",
  },
  account_segmentation: {
    mode: "account_segmentation",
    label: "Account segmentation",
    shortLabel: "Segmentation",
    readinessNoun: "segmentation readiness",
    description: "Prepare records for target account grouping, tiers, and lifecycle cuts.",
    primaryRisk: "Missing segments and non-standard geography weaken targeting logic.",
  },
  enrichment_import: {
    mode: "enrichment_import",
    label: "Enrichment import",
    shortLabel: "Enrichment",
    readinessNoun: "import readiness",
    description: "Prepare a clean CRM export for enrichment, matching, and safe re-import.",
    primaryRisk: "Schema gaps, duplicates, and formatting issues can break match quality or import trust.",
  },
  territory_planning: {
    mode: "territory_planning",
    label: "Territory planning",
    shortLabel: "Territories",
    readinessNoun: "territory readiness",
    description: "Prepare account records for territory coverage and quota planning.",
    primaryRisk: "Non-standard states, missing owners, and duplicates can skew territory capacity.",
  },
};

const WORKFLOW_PRIORITY: Record<WorkflowMode, IssueType[]> = {
  lead_routing: [
    "missing_owner",
    "inconsistent_state",
    "missing_segment",
    "duplicate_accounts",
    "invalid_email",
    "schema_mismatch",
    "naming_format",
  ],
  campaign_launch: [
    "invalid_email",
    "missing_segment",
    "schema_mismatch",
    "duplicate_accounts",
    "missing_owner",
    "naming_format",
    "inconsistent_state",
  ],
  quarterly_reporting: [
    "duplicate_accounts",
    "missing_segment",
    "inconsistent_state",
    "schema_mismatch",
    "missing_owner",
    "naming_format",
    "invalid_email",
  ],
  account_segmentation: [
    "missing_segment",
    "inconsistent_state",
    "schema_mismatch",
    "duplicate_accounts",
    "missing_owner",
    "naming_format",
    "invalid_email",
  ],
  enrichment_import: [
    "schema_mismatch",
    "duplicate_accounts",
    "naming_format",
    "invalid_email",
    "missing_segment",
    "inconsistent_state",
    "missing_owner",
  ],
  territory_planning: [
    "inconsistent_state",
    "missing_owner",
    "duplicate_accounts",
    "missing_segment",
    "schema_mismatch",
    "naming_format",
    "invalid_email",
  ],
};

const WORKFLOW_OVERRIDES: Record<WorkflowMode, WorkflowIssueOverride[]> = {
  lead_routing: [
    {
      type: "missing_owner",
      businessImpact: "Blocks lead routing and SLA assignment",
      workflowLabel: "Routing blocker",
      priorityReason: "Ranks first for lead routing because owner gaps stop records from entering rep queues.",
      downstreamImplication: "Unowned records cannot be assigned to reps, so they can miss SLA and follow-up windows.",
      readinessImpact: 20,
    },
    {
      type: "inconsistent_state",
      businessImpact: "Can route records to the wrong territory",
      workflowLabel: "Territory logic",
      priorityReason: "State standardization moves up because routing rules often depend on geographic territory filters.",
      downstreamImplication: "Non-standard states can bypass territory filters or route to the wrong coverage team.",
      readinessImpact: 13,
    },
    {
      type: "missing_segment",
      businessImpact: "Weakens route-to-team rules",
      workflowLabel: "Segment rule risk",
      priorityReason: "Missing segments rank above duplicates when routing rules use segment tiers to choose queues.",
      downstreamImplication: "Records without segment values may skip segment-based queues or need manual triage.",
      readinessImpact: 10,
    },
  ],
  campaign_launch: [
    {
      type: "invalid_email",
      businessImpact: "Creates outreach failure and bounce risk",
      workflowLabel: "Campaign blocker",
      priorityReason: "Ranks first for campaign launch because unusable emails directly reduce reachable audience size.",
      downstreamImplication: "Malformed and placeholder emails will fail campaign execution or increase bounce rates.",
      readinessImpact: 18,
    },
    {
      type: "missing_segment",
      businessImpact: "Breaks campaign audience rules",
      workflowLabel: "Audience gap",
      priorityReason: "Missing segments rank second because campaign inclusion and suppression rules often depend on segment.",
      downstreamImplication: "Contacts without segment values may be excluded from campaign lists or targeted incorrectly.",
      readinessImpact: 14,
    },
    {
      type: "schema_mismatch",
      businessImpact: "Creates list mapping risk",
      workflowLabel: "Launch mapping",
      priorityReason: "Schema mismatches matter before campaign launch because field mapping errors can break list imports.",
      downstreamImplication: "Campaign tools may reject or mis-map fields if canonical contact and lifecycle columns are unclear.",
      readinessImpact: 5,
    },
  ],
  quarterly_reporting: [
    {
      type: "duplicate_accounts",
      businessImpact: "Inflates account and pipeline reporting",
      workflowLabel: "Reporting distortion",
      priorityReason: "Ranks first for quarterly reporting because duplicates overstate account volume and pipeline coverage.",
      downstreamImplication: "Duplicate accounts can overcount territories, segments, and pipeline rollups in executive reporting.",
      readinessImpact: 20,
    },
    {
      type: "missing_segment",
      businessImpact: "Creates unclassified reporting buckets",
      workflowLabel: "Segment blind spot",
      priorityReason: "Missing segments rank high because quarterly views usually break down performance by segment.",
      downstreamImplication: "Unclassified accounts create blind spots in segment-level reporting and planning review.",
      readinessImpact: 13,
    },
    {
      type: "inconsistent_state",
      businessImpact: "Weakens geographic rollups",
      workflowLabel: "Geo rollup risk",
      priorityReason: "State cleanup ranks high because geographic reporting depends on normalized location fields.",
      downstreamImplication: "Mixed state values can split or omit records in territory and regional reporting.",
      readinessImpact: 11,
    },
  ],
  account_segmentation: [
    {
      type: "missing_segment",
      businessImpact: "Blocks account tiering and targeting",
      workflowLabel: "Segmentation blocker",
      priorityReason: "Ranks first for account segmentation because records without segment cannot enter tiering logic.",
      downstreamImplication: "Unsegmented accounts will fall out of target account lists, lifecycle cuts, and planning cohorts.",
      readinessImpact: 18,
    },
    {
      type: "inconsistent_state",
      businessImpact: "Breaks geo-based segment rules",
      workflowLabel: "Geo segment risk",
      priorityReason: "State standardization ranks second because segmentation often combines segment with geography.",
      downstreamImplication: "Non-standard state values weaken geographic segment logic and list filters.",
      readinessImpact: 13,
    },
    {
      type: "schema_mismatch",
      businessImpact: "Creates lifecycle and field mapping gaps",
      workflowLabel: "Segment schema",
      priorityReason: "Schema mismatches matter because missing lifecycle fields limit segmentation context.",
      downstreamImplication: "Missing lifecycle-stage context forces reviewers to treat affected records as segmentation exceptions.",
      readinessImpact: 6,
    },
  ],
  enrichment_import: [
    {
      type: "schema_mismatch",
      businessImpact: "Can break enrichment import mapping",
      workflowLabel: "Import blocker",
      priorityReason: "Ranks first for enrichment import because schema gaps and field naming inconsistencies create import failure risk.",
      downstreamImplication: "Unconfirmed mappings can cause enrichment outputs to write back into the wrong CRM fields.",
      readinessImpact: 14,
    },
    {
      type: "duplicate_accounts",
      businessImpact: "Weakens account match quality",
      workflowLabel: "Match collision",
      priorityReason: "Duplicates rank second because enrichment providers may match one company to multiple CRM records.",
      downstreamImplication: "Duplicate records can receive conflicting enrichment data or inflate import volume.",
      readinessImpact: 16,
    },
    {
      type: "naming_format",
      businessImpact: "Reduces match confidence",
      workflowLabel: "Match hygiene",
      priorityReason: "Naming format moves up because clean company and contact names improve enrichment match confidence.",
      downstreamImplication: "Messy names can reduce fuzzy-match quality and create lower-confidence enrichment candidates.",
      readinessImpact: 7,
    },
  ],
  territory_planning: [
    {
      type: "inconsistent_state",
      businessImpact: "Breaks territory boundaries",
      workflowLabel: "Territory blocker",
      priorityReason: "Ranks first for territory planning because territory capacity depends on standardized geography.",
      downstreamImplication: "Mixed state values can move accounts out of the right territory model or quota plan.",
      readinessImpact: 18,
    },
    {
      type: "missing_owner",
      businessImpact: "Creates unassigned territory coverage",
      workflowLabel: "Coverage gap",
      priorityReason: "Missing owners rank second because planning needs visible account coverage and owner accountability.",
      downstreamImplication: "Unassigned accounts create capacity gaps and unclear territory coverage.",
      readinessImpact: 14,
    },
    {
      type: "duplicate_accounts",
      businessImpact: "Overstates territory account volume",
      workflowLabel: "Capacity distortion",
      priorityReason: "Duplicates rank high because they inflate territory account counts and capacity assumptions.",
      downstreamImplication: "Duplicate accounts can overstate book size and skew quota balancing.",
      readinessImpact: 14,
    },
  ],
};

function overrideFor(mode: WorkflowMode, type: IssueType): WorkflowIssueOverride | undefined {
  return WORKFLOW_OVERRIDES[mode].find((item) => item.type === type);
}

export function getWorkflowIssueOrder(mode: WorkflowMode): IssueType[] {
  return WORKFLOW_PRIORITY[mode] ?? ISSUE_TYPE_ORDER;
}

export function getWorkflowIssueDefinitions(mode: WorkflowMode): IssueDefinition[] {
  return getWorkflowIssueOrder(mode).map((type) => {
    const base = ISSUE_DEFINITIONS.find((definition) => definition.type === type)!;
    const override = overrideFor(mode, type);
    return {
      ...base,
      ...override,
      type,
    };
  });
}

export function calculateWorkflowScore(
  issueStatuses: Record<IssueType, IssueStatus>,
  mode: WorkflowMode
): number {
  const score = getWorkflowIssueDefinitions(mode).reduce((sum, definition) => {
    return issueStatuses[definition.type] === "approved" ? sum + definition.readinessImpact : sum;
  }, INITIAL_SCORE);
  return Math.min(score, 100);
}

const impactCountByIssue: Record<IssueType, number> = {
  missing_owner: DETECTED.missingOwner.length,
  duplicate_accounts: DETECTED.duplicates.reduce((sum, cluster) => sum + cluster.records.length, 0),
  invalid_email: DETECTED.invalidEmails.length,
  missing_segment: DETECTED.missingSegments.length,
  inconsistent_state: DETECTED.inconsistentStates.length,
  schema_mismatch: DETECTED.schemaMismatches.length,
  naming_format: DETECTED.namingFormat.length,
};

function unresolvedCount(issueTypes: IssueType[], issueStatuses?: Record<IssueType, IssueStatus>): number {
  return issueTypes.reduce((sum, type) => (
    sum + (issueStatuses?.[type] === "approved" ? 0 : impactCountByIssue[type])
  ), 0);
}

export function getWorkflowImpactMetrics(
  mode: WorkflowMode,
  issueStatuses?: Record<IssueType, IssueStatus>
): WorkflowImpactMetric[] {
  const count = (issueTypes: IssueType[]) => unresolvedCount(issueTypes, issueStatuses);

  const metrics: Record<WorkflowMode, WorkflowImpactMetric[]> = {
    lead_routing: [
      {
        label: "Would fail routing",
        value: count(["missing_owner"]),
        unit: "records",
        detail: "Records need a valid owner or explicit review assignment before rep routing.",
        issueTypes: ["missing_owner"],
        severity: "high",
      },
      {
        label: "May route to wrong territory",
        value: count(["inconsistent_state"]),
        unit: "records",
        detail: "Territory filters depend on standardized state values.",
        issueTypes: ["inconsistent_state"],
        severity: "medium",
      },
      {
        label: "Need queue triage",
        value: count(["missing_segment"]),
        unit: "records",
        detail: "Segment gaps can bypass route-to-team logic.",
        issueTypes: ["missing_segment"],
        severity: "medium-high",
      },
    ],
    campaign_launch: [
      {
        label: "Unusable for outreach",
        value: count(["invalid_email"]),
        unit: "contacts",
        detail: "Malformed or placeholder emails would fail campaign execution.",
        issueTypes: ["invalid_email"],
        severity: "medium-high",
      },
      {
        label: "Missing audience logic",
        value: count(["missing_segment"]),
        unit: "records",
        detail: "Segment gaps weaken inclusion, suppression, and personalization rules.",
        issueTypes: ["missing_segment"],
        severity: "medium-high",
      },
      {
        label: "At list-import risk",
        value: count(["schema_mismatch"]),
        unit: "fields",
        detail: "Unconfirmed mappings can break campaign list upload.",
        issueTypes: ["schema_mismatch"],
        severity: "medium",
      },
    ],
    quarterly_reporting: [
      {
        label: "May distort rollups",
        value: count(["duplicate_accounts"]),
        unit: "records",
        detail: "Duplicate accounts can overstate account counts and pipeline coverage.",
        issueTypes: ["duplicate_accounts"],
        severity: "high",
      },
      {
        label: "Unclassified in reports",
        value: count(["missing_segment"]),
        unit: "records",
        detail: "Missing segments create blind spots in executive views.",
        issueTypes: ["missing_segment"],
        severity: "medium-high",
      },
      {
        label: "Weak geo reporting",
        value: count(["inconsistent_state"]),
        unit: "records",
        detail: "Mixed state formats split territory and regional reporting.",
        issueTypes: ["inconsistent_state"],
        severity: "medium",
      },
    ],
    account_segmentation: [
      {
        label: "Break segmentation logic",
        value: count(["missing_segment"]),
        unit: "records",
        detail: "Records without segment values cannot be tiered reliably.",
        issueTypes: ["missing_segment"],
        severity: "medium-high",
      },
      {
        label: "Weak geo segments",
        value: count(["inconsistent_state"]),
        unit: "records",
        detail: "Geographic filters require normalized state values.",
        issueTypes: ["inconsistent_state"],
        severity: "medium",
      },
      {
        label: "Need lifecycle review",
        value: count(["schema_mismatch"]),
        unit: "fields",
        detail: "Lifecycle-stage context is missing from the source schema.",
        issueTypes: ["schema_mismatch"],
        severity: "medium",
      },
    ],
    enrichment_import: [
      {
        label: "Could break import mapping",
        value: count(["schema_mismatch"]),
        unit: "fields",
        detail: "Canonical field mappings need review before import or enrichment writeback.",
        issueTypes: ["schema_mismatch"],
        severity: "medium",
      },
      {
        label: "May collide on match",
        value: count(["duplicate_accounts"]),
        unit: "records",
        detail: "Duplicate records can receive conflicting enrichment outputs.",
        issueTypes: ["duplicate_accounts"],
        severity: "high",
      },
      {
        label: "Lower match confidence",
        value: count(["naming_format"]),
        unit: "values",
        detail: "Messy account or contact names weaken fuzzy matching.",
        issueTypes: ["naming_format"],
        severity: "low-medium",
      },
    ],
    territory_planning: [
      {
        label: "Break territory logic",
        value: count(["inconsistent_state"]),
        unit: "records",
        detail: "Territory planning depends on standardized geographic fields.",
        issueTypes: ["inconsistent_state"],
        severity: "medium",
      },
      {
        label: "Unassigned coverage",
        value: count(["missing_owner"]),
        unit: "records",
        detail: "Unowned records create unclear territory accountability.",
        issueTypes: ["missing_owner"],
        severity: "high",
      },
      {
        label: "Distort territory volume",
        value: count(["duplicate_accounts"]),
        unit: "records",
        detail: "Duplicate accounts overstate book size and quota coverage.",
        issueTypes: ["duplicate_accounts"],
        severity: "high",
      },
    ],
  };

  return metrics[mode];
}
