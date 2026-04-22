import type {
  CRMRecord,
  CRMReferenceRow,
  IssueType,
  OwnershipRule,
  ReferenceContext,
  ReferenceContextSource,
  ReferenceSourceDefinition,
  ReferenceSourceType,
  ResolutionSuggestion,
  SegmentDictionaryEntry,
  SuggestionBasis,
} from "./types";

export const REFERENCE_SOURCE_DEFINITIONS: ReferenceSourceDefinition[] = [
  {
    type: "ownership_rules",
    label: "Ownership rules",
    expectedShape: "region / territory / segment / owner",
    effectDescription: "Improves missing-owner suggestions and routing rationale.",
  },
  {
    type: "segment_dictionary",
    label: "Segment dictionary",
    expectedShape: "segment / allowed_values / definition / lifecycle_stage",
    effectDescription: "Validates segment taxonomy and missing-segment recommendations.",
  },
  {
    type: "crm_reference",
    label: "Clean CRM reference export",
    expectedShape: "account / state / country / segment / owner / territory",
    effectDescription: "Adds trusted CRM pattern context for owner, segment, and state fills.",
  },
];

export const EMPTY_REFERENCE_CONTEXT: ReferenceContext = {
  sources: [],
  ownershipRules: [],
  segmentDictionary: [],
  crmReferenceRows: [],
};

const STATE_MAP: Record<string, string> = {
  california: "CA", calif: "CA", "calif.": "CA", cal: "CA",
  washington: "WA", wash: "WA", "wash.": "WA",
  oregon: "OR",
  texas: "TX", tex: "TX", "tex.": "TX",
  florida: "FL", "fla.": "FL", georgia: "GA",
  "new york": "NY", "new york ": "NY", "new york\t": "NY", "newyork": "NY", "n.y.": "NY", "n.y": "NY",
  "new jersey": "NJ", "n.j.": "NJ", virginia: "VA",
  illinois: "IL", ill: "IL", "ill.": "IL",
};

const INVALID_VALUES = new Set(["", "tbd", "unknown", "-", "n/a", "none", "unassigned"]);

const SAMPLE_OWNERSHIP_RULES = `region,territory,segment,owner,queue
West,West Enterprise,Enterprise,Noah Kim,west-enterprise-routing
West,West Commercial,SMB,Olivia Park,west-commercial-routing
West,West Growth,Mid-Market,Olivia Park,west-growth-routing
South,South Enterprise,Enterprise,Sofia Martinez,south-enterprise-routing
South,South Commercial,SMB,Liam Carter,south-commercial-routing
South,South Growth,Mid-Market,Sofia Martinez,south-growth-routing
Northeast,Northeast Enterprise,Enterprise,Lucas Rivera,ne-enterprise-routing
Northeast,Northeast Growth,Mid-Market,Lucas Rivera,ne-growth-routing
Central,Central Strategic,Enterprise,Jordan Patel,central-enterprise-routing`;

const SAMPLE_SEGMENT_DICTIONARY = `segment,allowed_values,definition,lifecycle_stage
Enterprise,Enterprise;Strategic,Strategic and high-revenue accounts,Qualified
Mid-Market,Mid-Market;Growth,Regional growth accounts,Qualified
SMB,SMB;Small Business,Low-touch commercial accounts,Nurture`;

const SAMPLE_CRM_REFERENCE = `account,domain,state,country,segment,owner,territory
Northstar Health,northstarhealth.com,CA,United States,Enterprise,Noah Kim,West Enterprise
SableWorks,sableworks.com,CA,United States,Mid-Market,Olivia Park,West Growth
LumenGrid,lumengrid.com,NY,United States,Enterprise,Lucas Rivera,Northeast Enterprise
Northwind Foods,northwindfoods.com,TX,United States,SMB,Liam Carter,South Commercial
Redwood Biologics,redwoodbio.com,NY,United States,Enterprise,Lucas Rivera,Northeast Enterprise
Stratus One,stratusone.com,TX,United States,Mid-Market,Sofia Martinez,South Growth
MeridianOps,meridianops.com,CA,United States,Mid-Market,Olivia Park,West Growth
Bridgewell Care,bridgewellcare.com,TX,United States,SMB,Liam Carter,South Commercial`;

function sourceDefinition(type: ReferenceSourceType): ReferenceSourceDefinition {
  return REFERENCE_SOURCE_DEFINITIONS.find((item) => item.type === type) ?? REFERENCE_SOURCE_DEFINITIONS[0];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeValue(value: string | undefined): string {
  return (value ?? "").trim();
}

function isValidReferenceValue(value: string | undefined): boolean {
  return !INVALID_VALUES.has(normalizeValue(value).toLowerCase());
}

function standardizeState(value: string | undefined): string {
  const state = normalizeValue(value);
  if (!state) return "";
  if (/^[A-Za-z]{2}$/.test(state)) return state.toUpperCase();
  return STATE_MAP[state.toLowerCase()] ?? "";
}

function regionForRecord(record: CRMRecord | CRMReferenceRow): string {
  const state = standardizeState(record.state);
  if (["CA", "WA", "OR"].includes(state)) return "West";
  if (["TX", "FL", "GA"].includes(state)) return "South";
  if (["NY", "NJ", "VA"].includes(state)) return "Northeast";
  if (["IL", "OH", "MI", "MN", "CO"].includes(state)) return "Central";
  return "";
}

function canonicalSegment(value: string): string {
  const normalized = normalizeValue(value).toLowerCase();
  if (normalized === "smb" || normalized === "small business") return "SMB";
  if (normalized === "mid-market" || normalized === "mid market" || normalized === "growth") return "Mid-Market";
  if (normalized === "enterprise" || normalized === "strategic") return "Enterprise";
  return normalizeValue(value);
}

function splitAllowedValues(value: string): string[] {
  return value.split(/[;|,]/).map((item) => normalizeValue(item)).filter(Boolean);
}

function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === "\"" && quoted && next === "\"") {
        current += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[normalizeKey(key)];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function buildSource(type: ReferenceSourceType, fileName: string, rowCount: number, uploadedAt: string): ReferenceContextSource {
  const definition = sourceDefinition(type);
  return {
    type,
    fileName,
    rowCount,
    active: true,
    uploadedAt,
    effectDescription: definition.effectDescription,
  };
}

function buildContextForSource(
  type: ReferenceSourceType,
  fileName: string,
  csv: string,
  uploadedAt = new Date().toISOString()
): ReferenceContext {
  const rows = parseCsvRows(csv);
  const source = buildSource(type, fileName, rows.length, uploadedAt);

  if (type === "ownership_rules") {
    return {
      ...EMPTY_REFERENCE_CONTEXT,
      sources: [source],
      ownershipRules: rows.map((row): OwnershipRule => ({
        region: pick(row, ["region", "geo", "area"]),
        territory: pick(row, ["territory", "territory_name", "routing_territory"]),
        segment: canonicalSegment(pick(row, ["segment", "market_segment", "account_segment"])),
        owner: pick(row, ["owner", "account_owner", "sales_owner", "rep"]),
        queue: pick(row, ["queue", "routing_queue"]),
        sourceName: fileName,
      })).filter((row) => isValidReferenceValue(row.owner)),
    };
  }

  if (type === "segment_dictionary") {
    return {
      ...EMPTY_REFERENCE_CONTEXT,
      sources: [source],
      segmentDictionary: rows.map((row): SegmentDictionaryEntry => {
        const segment = canonicalSegment(pick(row, ["segment", "canonical_segment", "name"]));
        const allowedValues = splitAllowedValues(pick(row, ["allowed_values", "allowed_value", "aliases", "values"]));
        return {
          segment,
          allowedValues: allowedValues.length > 0 ? allowedValues.map(canonicalSegment) : [segment],
          definition: pick(row, ["definition", "description"]),
          lifecycleStage: pick(row, ["lifecycle_stage", "stage"]),
          sourceName: fileName,
        };
      }).filter((row) => isValidReferenceValue(row.segment)),
    };
  }

  return {
    ...EMPTY_REFERENCE_CONTEXT,
    sources: [source],
    crmReferenceRows: rows.map((row): CRMReferenceRow => ({
      account: pick(row, ["account", "account_name", "company"]),
      domain: pick(row, ["domain", "website", "account_domain"]),
      state: pick(row, ["state", "province", "region_state"]),
      country: pick(row, ["country"]),
      segment: canonicalSegment(pick(row, ["segment", "market_segment", "account_segment"])),
      owner: pick(row, ["owner", "account_owner", "sales_owner", "rep"]),
      territory: pick(row, ["territory", "territory_name", "region"]),
      sourceName: fileName,
    })).filter((row) => isValidReferenceValue(row.domain) || isValidReferenceValue(row.account)),
  };
}

export function mergeReferenceContext(current: ReferenceContext, next: ReferenceContext): ReferenceContext {
  const nextTypes = new Set(next.sources.map((source) => source.type));
  return {
    sources: [...current.sources.filter((source) => !nextTypes.has(source.type)), ...next.sources],
    ownershipRules: nextTypes.has("ownership_rules") ? next.ownershipRules : current.ownershipRules,
    segmentDictionary: nextTypes.has("segment_dictionary") ? next.segmentDictionary : current.segmentDictionary,
    crmReferenceRows: nextTypes.has("crm_reference") ? next.crmReferenceRows : current.crmReferenceRows,
  };
}

export function attachReferenceCsv(
  current: ReferenceContext,
  type: ReferenceSourceType,
  fileName: string,
  csv: string
): ReferenceContext {
  return mergeReferenceContext(current, buildContextForSource(type, fileName, csv));
}

export function createSampleReferenceContext(): ReferenceContext {
  return [
    buildContextForSource("ownership_rules", "sample_ownership_rules.csv", SAMPLE_OWNERSHIP_RULES, "2026-04-20T09:18:00Z"),
    buildContextForSource("segment_dictionary", "sample_segment_dictionary.csv", SAMPLE_SEGMENT_DICTIONARY, "2026-04-20T09:18:00Z"),
    buildContextForSource("crm_reference", "sample_clean_crm_reference.csv", SAMPLE_CRM_REFERENCE, "2026-04-20T09:18:00Z"),
  ].reduce(mergeReferenceContext, EMPTY_REFERENCE_CONTEXT);
}

export function updateReferenceSourceActive(
  context: ReferenceContext,
  type: ReferenceSourceType,
  active: boolean
): ReferenceContext {
  return {
    ...context,
    sources: context.sources.map((source) => source.type === type ? { ...source, active } : source),
  };
}

export function activeReferenceSources(context: ReferenceContext): ReferenceContextSource[] {
  return context.sources.filter((source) => source.active);
}

export function hasReferenceSources(context: ReferenceContext): boolean {
  return context.sources.length > 0;
}

function sourceIsActive(context: ReferenceContext, type: ReferenceSourceType): boolean {
  return context.sources.some((source) => source.type === type && source.active);
}

function basis(
  type: SuggestionBasis["type"],
  label: string,
  detail: string,
  strength: SuggestionBasis["strength"],
  sourceNameValue?: string
): SuggestionBasis {
  return { type, label, detail, sourceName: sourceNameValue, strength };
}

function fallbackBasis(issueType: IssueType): SuggestionBasis {
  if (issueType === "inconsistent_state" || issueType === "schema_mismatch") {
    return basis("deterministic", "Based on deterministic normalization", "Uses a controlled mapping rule rather than inferred business context.", "deterministic");
  }
  return basis("record_heuristic", "Based on record-only heuristic", "No active reference source produced a safer direct match for this record.", "fallback");
}

function matchOwnershipRule(record: CRMRecord, context: ReferenceContext): OwnershipRule | undefined {
  if (!sourceIsActive(context, "ownership_rules")) return undefined;
  const recordRegion = regionForRecord(record);
  const recordSegment = canonicalSegment(record.segment);

  return context.ownershipRules
    .filter((rule) => isValidReferenceValue(rule.owner))
    .map((rule) => {
      let score = 0;
      if (rule.region && recordRegion && rule.region.toLowerCase() === recordRegion.toLowerCase()) score += 2;
      if (rule.territory && recordRegion && rule.territory.toLowerCase().includes(recordRegion.toLowerCase())) score += 1;
      if (rule.segment && recordSegment && rule.segment.toLowerCase() === recordSegment.toLowerCase()) score += 3;
      return { rule, score };
    })
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)[0]?.rule;
}

function matchReferenceRow(record: CRMRecord, context: ReferenceContext): CRMReferenceRow | undefined {
  if (!sourceIsActive(context, "crm_reference")) return undefined;
  const domain = normalizeValue(record.domain).toLowerCase();
  const account = normalizeValue(record.account_name).toLowerCase();
  return context.crmReferenceRows.find((row) => normalizeValue(row.domain).toLowerCase() === domain)
    ?? context.crmReferenceRows.find((row) => {
      const referenceAccount = normalizeValue(row.account).toLowerCase();
      return referenceAccount !== "" && account.includes(referenceAccount);
    });
}

function matchSegmentDictionary(value: string, context: ReferenceContext): SegmentDictionaryEntry | undefined {
  if (!sourceIsActive(context, "segment_dictionary")) return undefined;
  const canonical = canonicalSegment(value).toLowerCase();
  return context.segmentDictionary.find((entry) => entry.segment.toLowerCase() === canonical)
    ?? context.segmentDictionary.find((entry) => entry.allowedValues.some((allowed) => allowed.toLowerCase() === canonical));
}

export function contextualizeSuggestion(
  issueType: IssueType,
  record: CRMRecord,
  suggestion: ResolutionSuggestion,
  context: ReferenceContext
): ResolutionSuggestion {
  const baseSuggestion = {
    ...suggestion,
    basis: suggestion.basis ?? fallbackBasis(issueType),
  };

  if (issueType === "missing_owner") {
    const rule = matchOwnershipRule(record, context);
    if (rule) {
      const territoryLabel = rule.territory || rule.region || "matched territory";
      return {
        ...baseSuggestion,
        suggestedValue: rule.owner,
        confidence: rule.segment ? 94 : 88,
        rationale: `Ownership rule maps ${territoryLabel}${rule.segment ? ` and ${rule.segment}` : ""} accounts to ${rule.owner}. Human review remains required before assignment.`,
        reviewState: "needs_approval",
        basis: basis("ownership_rules", "Based on ownership rules", `Matched ${territoryLabel}${rule.queue ? ` via ${rule.queue}` : ""}.`, "direct", rule.sourceName),
      };
    }

    const referenceRow = matchReferenceRow(record, context);
    if (referenceRow?.owner && isValidReferenceValue(referenceRow.owner)) {
      return {
        ...baseSuggestion,
        suggestedValue: referenceRow.owner,
        confidence: 88,
        rationale: "Trusted CRM reference export contains the same account/domain with a populated owner. Treat as a strong candidate, not an automatic assignment.",
        reviewState: "needs_approval",
        basis: basis("crm_reference", "Based on reference CRM pattern", `Matched prior clean CRM row for ${referenceRow.domain || referenceRow.account}.`, "strong", referenceRow.sourceName),
      };
    }
  }

  if (issueType === "missing_segment") {
    const dictionaryEntry = matchSegmentDictionary(baseSuggestion.suggestedValue, context);
    if (dictionaryEntry) {
      return {
        ...baseSuggestion,
        suggestedValue: dictionaryEntry.segment,
        confidence: Math.min(90, Math.max(baseSuggestion.confidence + 8, 84)),
        rationale: `Candidate segment is part of the approved taxonomy${dictionaryEntry.definition ? `: ${dictionaryEntry.definition}` : "."} Review before export because the source record was blank.`,
        reviewState: "needs_approval",
        basis: basis("segment_dictionary", "Based on segment dictionary", `${dictionaryEntry.segment} is an allowed segment${dictionaryEntry.lifecycleStage ? ` for ${dictionaryEntry.lifecycleStage} lifecycle records` : ""}.`, "direct", dictionaryEntry.sourceName),
      };
    }

    const referenceRow = matchReferenceRow(record, context);
    if (referenceRow?.segment && isValidReferenceValue(referenceRow.segment)) {
      return {
        ...baseSuggestion,
        suggestedValue: canonicalSegment(referenceRow.segment),
        confidence: 86,
        rationale: "Trusted CRM reference export shows the same account/domain with this populated segment. Keep the recommendation review-first before applying it.",
        reviewState: "needs_approval",
        basis: basis("crm_reference", "Based on reference CRM pattern", `Matched prior clean CRM row for ${referenceRow.domain || referenceRow.account}.`, "strong", referenceRow.sourceName),
      };
    }
  }

  if (issueType === "inconsistent_state") {
    const referenceRow = matchReferenceRow(record, context);
    const referenceState = standardizeState(referenceRow?.state);
    if (referenceState && referenceState === standardizeState(baseSuggestion.suggestedValue)) {
      return {
        ...baseSuggestion,
        confidence: 98,
        rationale: "State normalization matches both the deterministic USPS mapping and the trusted CRM reference export.",
        basis: basis("crm_reference", "Based on reference CRM pattern", `Reference row confirms ${referenceState} for ${referenceRow?.domain || referenceRow?.account}.`, "strong", referenceRow?.sourceName),
      };
    }
  }

  return baseSuggestion;
}

export function suggestionBasisLabel(suggestion: ResolutionSuggestion): string {
  return suggestion.basis?.label ?? "Based on record-only heuristic";
}
