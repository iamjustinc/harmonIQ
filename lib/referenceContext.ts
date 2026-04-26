import type {
  CRMRecord,
  CRMReferenceRow,
  EvidenceTier,
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
    effectDescription: "Inspect-only derived patterns. Disabled by default unless a single-owner pattern is consistent.",
  },
  {
    type: "segment_dictionary",
    label: "Segment dictionary",
    expectedShape: "segment / allowed_values / definition / lifecycle_stage",
    effectDescription: "Validates allowed segment taxonomy from the real cleaned export.",
  },
  {
    type: "crm_reference",
    label: "Clean CRM reference export",
    expectedShape: "account / state / country / segment / owner / territory",
    effectDescription: "Primary trusted source for owner, segment, and state recommendations.",
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

const INVALID_VALUES = new Set([
  "",
  "tbd",
  "unknown",
  "-",
  "n/a",
  "none",
  "unassigned",
  "unassigned - review",
  "needs review",
  "needs manual assignment",
  "manual review required",
]);

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

// Simplified demo reference set. Not used in production — createRealReferenceContext()
// loads the actual real_clean_crm_reference_from_cleaned.csv instead.
// Owner values are aligned with the real cleaned export to prevent synthetic drift.
const SAMPLE_CRM_REFERENCE = `account,domain,state,country,segment,owner,territory
Northstar Health,northstarhealth.com,CA,United States,Enterprise,Noah Kim,West Enterprise
SableWorks,sableworks.com,CA,United States,Mid-Market,Olivia Park,West Growth
LumenGrid,lumengrid.com,NY,United States,Enterprise,Lucas Rivera,Northeast Enterprise
Northwind Foods,northwindfoods.com,TX,United States,SMB,Lucas Rivera,South Commercial
Redwood Biologics,redwoodbio.com,NY,United States,Enterprise,Noah Kim,Northeast Enterprise
Stratus One,stratusone.com,TX,United States,Mid-Market,Sofia Martinez,South Growth
MeridianOps,meridianops.com,CA,United States,Mid-Market,Ethan Brooks,West Growth
Bridgewell Care,bridgewellcare.com,TX,United States,SMB,Liam Carter,South Commercial`;

const REAL_CLEAN_CRM_REFERENCE = `record_id,account_name,domain,owner,segment,state,country,email,basis
REC-001,Northstar Health,northstarhealth.com,Noah Kim,Enterprise,CA,United States,jordan.johnson@northstarhealth.com,Trusted cleaned export row
REC-003,Altura Systems,alturasystems.com,Olivia Park,Enterprise,IL,United States,sam.flores@alturasystems.com,Trusted cleaned export row
REC-004,Greenline Bio,greenlinebio.com,Ava Thompson,Enterprise,WA,United States,drew.johnson@greenlinebio.com,Trusted cleaned export row
REC-005,Orbitiq,orbitiq.ai,Sofia Martinez,Enterprise,TX,United States,skyler.ward@orbitiq.ai,Trusted cleaned export row
REC-006,Corepath,corepath.io,Noah Kim,SMB,IL,United States,skyler.morris@corepath.io,Trusted cleaned export row
REC-007,Sableworks,sableworks.com,Olivia Park,Needs Review,CA,United States,casey.patel@sableworks.com,Trusted cleaned export row
REC-008,Bluepeak Retail,bluepeakretail.com,Liam Carter,Needs Review,TX,United States,jamie@bluepeakretail.com,Trusted cleaned export row
REC-009,Summitforge,summitforge.com,Ethan Brooks,Enterprise,TX,United States,reese.martinez@summitforge.com,Trusted cleaned export row
REC-010,Meridianops,meridianops.com,Ethan Brooks,Needs Review,CA,United States,smorris@meridianops.com,Trusted cleaned export row
REC-012,Lumengrid,lumengrid.com,Lucas Rivera,Enterprise,NY,United States,morgan.baker@lumengrid.com,Trusted cleaned export row
REC-013,Pinecrest Health,pinecresthealth.com,Olivia Park,Mid-Market,IL,United States,harperwong@pinecresthealth.com,Trusted cleaned export row
REC-014,Everfield Logistics,everfieldlogistics.com,Ethan Brooks,Enterprise,CA,United States,rjohnson@everfieldlogistics.com,Trusted cleaned export row
REC-015,Asterpoint,asterpoint.com,Isabella Nguyen,Enterprise,TX,United States,emerson@asterpoint.com,Trusted cleaned export row
REC-016,Maplestone Capital,maplestonecap.com,Liam Carter,Mid-Market,IL,United States,emerson.lee@maplestonecap.com,Trusted cleaned export row
REC-017,Clearspring Media,clearspringmedia.com,Liam Carter,Enterprise,NY,United States,ava.martinez@clearspringmedia.com,Trusted cleaned export row
REC-018,Verity Motors,veritymotors.com,Isabella Nguyen,Enterprise,NY,United States,mallen@veritymotors.com,Trusted cleaned export row
REC-019,Northwind Foods,northwindfoods.com,Lucas Rivera,SMB,TX,United States,cameron.turner@northwindfoods.com,Trusted cleaned export row
REC-020,Brightarc Education,brightarcedu.org,Isabella Nguyen,Enterprise,TX,United States,jordan.morris@brightarcedu.org,Trusted cleaned export row
REC-021,Nimbus Telecom,nimbustelecom.com,Ethan Brooks,Needs Review,NY,United States,chris.smith@nimbustelecom.com,Trusted cleaned export row
REC-022,Cobalt Freight,cobaltfreight.com,Liam Carter,Mid-Market,IL,United States,mmorris@cobaltfreight.com,Trusted cleaned export row
REC-023,Silveroak Health,silveroakhealth.com,Olivia Park,Mid-Market,CA,United States,parker.turner@silveroakhealth.com,Trusted cleaned export row
REC-024,Ironbridge Systems,ironbridgesys.com,Jordan Patel,Enterprise,CA,United States,cameron@ironbridgesys.com,Trusted cleaned export row
REC-026,Atlas Commerce,atlascommerce.com,Noah Kim,Enterprise,IL,United States,jwong@atlascommerce.com,Trusted cleaned export row
REC-027,Heliowave,heliowave.com,Maya Chen,Mid-Market,CA,United States,rclark@heliowave.com,Trusted cleaned export row
REC-028,Redwood Biologics,redwoodbio.com,Noah Kim,Enterprise,NY,United States,samdavis@redwoodbio.com,Trusted cleaned export row
REC-029,Vectorlane,vectorlane.io,Maya Chen,SMB,IL,United States,emerson.nguyen@vectorlane.io,Trusted cleaned export row
REC-030,Trunorth Security,trunorthsec.com,Liam Carter,Enterprise,NY,United States,cameron.patel@trunorthsec.com,Trusted cleaned export row
REC-032,Cloudmosaic,cloudmosaic.io,Maya Chen,Mid-Market,IL,United States,drew.wong@cloudmosaic.io,Trusted cleaned export row
REC-033,Peakriver Finance,peakriverfin.com,Jordan Patel,Enterprise,TX,United States,morganturner@peakriverfin.com,Trusted cleaned export row
REC-035,Stratus One,stratusone.com,Sofia Martinez,Mid-Market,TX,United States,reesekim@stratusone.com,Trusted cleaned export row
REC-037,Westgate Health,westgatehealth.com,Lucas Rivera,SMB,NY,United States,jamie.nguyen@westgatehealth.com,Trusted cleaned export row
REC-038,Urbannest Living,urbannestliving.com,Liam Carter,Needs Review,IL,United States,aturner@urbannestliving.com,Trusted cleaned export row
REC-039,Tidal Metrics,tidalmetrics.io,Noah Kim,SMB,TX,United States,ava.turner@tidalmetrics.io,Trusted cleaned export row
REC-040,Fieldstone Manufacturing,fieldstonemfg.com,Ava Thompson,Enterprise,NY,United States,morgan.martinez@fieldstonemfg.com,Trusted cleaned export row
REC-041,Arcbloom,arcbloom.com,Ava Thompson,SMB,WA,United States,cjohnson@arcbloom.com,Trusted cleaned export row
REC-042,Praxis Medical,praxismedical.com,Ethan Brooks,Needs Review,NY,United States,sam@praxismedical.com,Trusted cleaned export row
REC-043,Voltaris,voltaris.com,Jordan Patel,Mid-Market,TX,United States,djohnson@voltaris.com,Trusted cleaned export row
REC-045,Crescent Foods,crescentfoods.com,Liam Carter,SMB,IL,United States,dhall@crescentfoods.com,Trusted cleaned export row
REC-046,Truespan Networks,truespan.net,Isabella Nguyen,SMB,CA,United States,parkerlee@truespan.net,Trusted cleaned export row
REC-047,Mirapath,mirapath.com,Sofia Martinez,SMB,CA,United States,dpatel@mirapath.com,Trusted cleaned export row
REC-048,Skyledger,skyledger.io,Olivia Park,Needs Review,NY,United States,morgan@skyledger.io,Trusted cleaned export row
REC-049,Northgrove,northgrove.com,Sofia Martinez,Mid-Market,WA,United States,rlee@northgrove.com,Trusted cleaned export row
REC-050,Terrafleet,terrafleet.com,Noah Kim,SMB,WA,United States,quinn@terrafleet.com,Trusted cleaned export row
REC-051,Aquila Health,aquilahealth.com,Jordan Patel,Enterprise,IL,United States,harper@aquilahealth.com,Trusted cleaned export row
REC-052,Primelayer,primelayer.io,Liam Carter,Needs Review,CA,United States,callen@primelayer.io,Trusted cleaned export row
REC-054,Blueridge Labs,blueridgelabs.com,Maya Chen,SMB,NY,United States,emerson.young@blueridgelabs.com,Trusted cleaned export row
REC-055,Civicaxis,civicaxis.org,Ethan Brooks,Mid-Market,IL,United States,rward@civicaxis.org,Trusted cleaned export row
REC-056,Element Harbor,elementharbor.com,Sofia Martinez,SMB,WA,United States,jamie@elementharbor.com,Trusted cleaned export row
REC-057,Vantacore,vantacore.com,Ethan Brooks,Needs Review,TX,United States,casey@vantacore.com,Trusted cleaned export row
REC-058,Brightfield,brightfieldag.com,Olivia Park,Mid-Market,NY,United States,swong@brightfieldag.com,Trusted cleaned export row
REC-059,Opentrail,opentrail.io,Maya Chen,SMB,NY,United States,cameron.morris@opentrail.io,Trusted cleaned export row
REC-060,Signalforge,signalforge.com,Isabella Nguyen,SMB,WA,United States,pflores@signalforge.com,Trusted cleaned export row
REC-062,Echovista,echovista.co,Liam Carter,SMB,CA,United States,cameron.morris@echovista.co,Trusted cleaned export row
REC-064,Rivermint,rivermint.com,Sofia Martinez,Enterprise,WA,United States,jamie.hall@rivermint.com,Trusted cleaned export row
REC-065,Pureline Labs,purelinelabs.com,Maya Chen,Enterprise,TX,United States,casey@purelinelabs.com,Trusted cleaned export row
REC-066,North Harbor Tech,northharbortech.com,Jordan Patel,Needs Review,NY,United States,mallen@northharbortech.com,Trusted cleaned export row`;

const REAL_SEGMENT_DICTIONARY = `segment,definition,source
Enterprise,Large strategic accounts,Derived from cleaned_crm_export
Mid-Market,Growth accounts between SMB and Enterprise,Derived from cleaned_crm_export
SMB,Small and medium business accounts,Derived from cleaned_crm_export`;

const REAL_OWNERSHIP_RULES = `region,state,segment,owner,territory,basis
West,CA,Enterprise,Ethan Brooks,West Enterprise,Derived from cleaned_crm_export trusted rows
West,CA,Enterprise,Jordan Patel,West Enterprise,Derived from cleaned_crm_export trusted rows
West,CA,Enterprise,Noah Kim,West Enterprise,Derived from cleaned_crm_export trusted rows
West,CA,Mid-Market,Maya Chen,West Mid-Market,Derived from cleaned_crm_export trusted rows
West,CA,Mid-Market,Olivia Park,West Mid-Market,Derived from cleaned_crm_export trusted rows
West,CA,Needs Review,Ethan Brooks,West Needs Review,Derived from cleaned_crm_export trusted rows
West,CA,Needs Review,Liam Carter,West Needs Review,Derived from cleaned_crm_export trusted rows
West,CA,Needs Review,Olivia Park,West Needs Review,Derived from cleaned_crm_export trusted rows
West,CA,SMB,Isabella Nguyen,West SMB,Derived from cleaned_crm_export trusted rows
West,CA,SMB,Liam Carter,West SMB,Derived from cleaned_crm_export trusted rows
West,CA,SMB,Sofia Martinez,West SMB,Derived from cleaned_crm_export trusted rows
Midwest,IL,Enterprise,Jordan Patel,Midwest Enterprise,Derived from cleaned_crm_export trusted rows
Midwest,IL,Enterprise,Noah Kim,Midwest Enterprise,Derived from cleaned_crm_export trusted rows
Midwest,IL,Enterprise,Olivia Park,Midwest Enterprise,Derived from cleaned_crm_export trusted rows
Midwest,IL,Mid-Market,Ethan Brooks,Midwest Mid-Market,Derived from cleaned_crm_export trusted rows
Midwest,IL,Mid-Market,Liam Carter,Midwest Mid-Market,Derived from cleaned_crm_export trusted rows
Midwest,IL,Mid-Market,Maya Chen,Midwest Mid-Market,Derived from cleaned_crm_export trusted rows
Midwest,IL,Mid-Market,Olivia Park,Midwest Mid-Market,Derived from cleaned_crm_export trusted rows
Midwest,IL,Needs Review,Liam Carter,Midwest Needs Review,Derived from cleaned_crm_export trusted rows
Midwest,IL,SMB,Liam Carter,Midwest SMB,Derived from cleaned_crm_export trusted rows
Midwest,IL,SMB,Maya Chen,Midwest SMB,Derived from cleaned_crm_export trusted rows
Midwest,IL,SMB,Noah Kim,Midwest SMB,Derived from cleaned_crm_export trusted rows
Northeast,NY,Enterprise,Ava Thompson,Northeast Enterprise,Derived from cleaned_crm_export trusted rows
Northeast,NY,Enterprise,Isabella Nguyen,Northeast Enterprise,Derived from cleaned_crm_export trusted rows
Northeast,NY,Enterprise,Liam Carter,Northeast Enterprise,Derived from cleaned_crm_export trusted rows
Northeast,NY,Enterprise,Lucas Rivera,Northeast Enterprise,Derived from cleaned_crm_export trusted rows
Northeast,NY,Enterprise,Noah Kim,Northeast Enterprise,Derived from cleaned_crm_export trusted rows
Northeast,NY,Mid-Market,Olivia Park,Northeast Mid-Market,Derived from cleaned_crm_export trusted rows
Northeast,NY,Needs Review,Ethan Brooks,Northeast Needs Review,Derived from cleaned_crm_export trusted rows
Northeast,NY,Needs Review,Jordan Patel,Northeast Needs Review,Derived from cleaned_crm_export trusted rows
Northeast,NY,Needs Review,Olivia Park,Northeast Needs Review,Derived from cleaned_crm_export trusted rows
Northeast,NY,SMB,Lucas Rivera,Northeast SMB,Derived from cleaned_crm_export trusted rows
Northeast,NY,SMB,Maya Chen,Northeast SMB,Derived from cleaned_crm_export trusted rows
South,TX,Enterprise,Ethan Brooks,South Enterprise,Derived from cleaned_crm_export trusted rows
South,TX,Enterprise,Isabella Nguyen,South Enterprise,Derived from cleaned_crm_export trusted rows
South,TX,Enterprise,Jordan Patel,South Enterprise,Derived from cleaned_crm_export trusted rows
South,TX,Enterprise,Maya Chen,South Enterprise,Derived from cleaned_crm_export trusted rows
South,TX,Enterprise,Sofia Martinez,South Enterprise,Derived from cleaned_crm_export trusted rows
South,TX,Mid-Market,Jordan Patel,South Mid-Market,Derived from cleaned_crm_export trusted rows
South,TX,Mid-Market,Sofia Martinez,South Mid-Market,Derived from cleaned_crm_export trusted rows
South,TX,Needs Review,Ethan Brooks,South Needs Review,Derived from cleaned_crm_export trusted rows
South,TX,Needs Review,Liam Carter,South Needs Review,Derived from cleaned_crm_export trusted rows
South,TX,SMB,Lucas Rivera,South SMB,Derived from cleaned_crm_export trusted rows
South,TX,SMB,Noah Kim,South SMB,Derived from cleaned_crm_export trusted rows
West,WA,Enterprise,Ava Thompson,West Enterprise,Derived from cleaned_crm_export trusted rows
West,WA,Enterprise,Sofia Martinez,West Enterprise,Derived from cleaned_crm_export trusted rows
West,WA,Mid-Market,Sofia Martinez,West Mid-Market,Derived from cleaned_crm_export trusted rows
West,WA,SMB,Ava Thompson,West SMB,Derived from cleaned_crm_export trusted rows
West,WA,SMB,Isabella Nguyen,West SMB,Derived from cleaned_crm_export trusted rows
West,WA,SMB,Noah Kim,West SMB,Derived from cleaned_crm_export trusted rows
West,WA,SMB,Sofia Martinez,West SMB,Derived from cleaned_crm_export trusted rows`;

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
        state: pick(row, ["state", "province", "region_state"]),
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
      record_id: pick(row, ["record_id", "id"]) || undefined,
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

export function createRealReferenceContext(): ReferenceContext {
  const context = [
    buildContextForSource("crm_reference", "real_clean_crm_reference_from_cleaned.csv", REAL_CLEAN_CRM_REFERENCE, "2026-04-22T16:14:00Z"),
    buildContextForSource("segment_dictionary", "real_segment_dictionary_from_cleaned.csv", REAL_SEGMENT_DICTIONARY, "2026-04-22T16:14:00Z"),
    buildContextForSource("ownership_rules", "real_ownership_rules_from_cleaned.csv", REAL_OWNERSHIP_RULES, "2026-04-22T16:14:00Z"),
  ].reduce(mergeReferenceContext, EMPTY_REFERENCE_CONTEXT);

  return {
    ...context,
    sources: context.sources.map((source) => (
      source.type === "ownership_rules"
        ? {
            ...source,
            active: false,
            effectDescription: "Inspect-only derived patterns. Disabled by default because owner assignment requires exact clean CRM reference evidence.",
          }
        : source
    )),
  };
}

export function hasSyntheticSampleReferenceContext(context: ReferenceContext): boolean {
  return context.sources.some((source) => source.fileName.startsWith("sample_"));
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

type BasisProvenance = Pick<SuggestionBasis,
  "evidenceTier" | "matchedRecordId" | "matchedDomain" | "matchedAccount" | "matchedState" | "matchedSegment" | "refusalReason"
>;

function basis(
  type: SuggestionBasis["type"],
  label: string,
  detail: string,
  strength: SuggestionBasis["strength"],
  sourceNameValue?: string,
  provenance?: Partial<BasisProvenance>,
): SuggestionBasis {
  return { type, label, detail, sourceName: sourceNameValue, strength, ...provenance };
}

function fallbackBasis(issueType: IssueType): SuggestionBasis {
  if (issueType === "inconsistent_state" || issueType === "schema_mismatch") {
    return basis("deterministic", "Based on deterministic normalization", "Uses a controlled mapping rule rather than inferred business context.", "deterministic");
  }
  return basis(
    "record_heuristic",
    "Based on record-only heuristic",
    "No domain, account, or record_id match found in the clean CRM reference export. No active ownership rule covers this state/segment with a single consistent owner.",
    "fallback",
    undefined,
    {
      evidenceTier: "insufficient_evidence",
      refusalReason: "No domain match in real_clean_crm_reference_from_cleaned.csv. Ownership rules are inspect-only and show multiple owners per territory — no single trusted owner can be inferred.",
    }
  );
}

function matchOwnershipRule(record: CRMRecord, context: ReferenceContext): OwnershipRule | undefined {
  if (!sourceIsActive(context, "ownership_rules")) return undefined;
  const recordRegion = regionForRecord(record);
  const recordState = standardizeState(record.state);
  const recordSegment = canonicalSegment(record.segment);

  const eligible = context.ownershipRules
    .filter((rule) => isValidReferenceValue(rule.owner))
    .map((rule) => {
      const ruleState = standardizeState(rule.state);
      const stateMatches = !!recordState && !!ruleState && recordState === ruleState;
      const regionMatches = stateMatches || (!!recordRegion && (
        rule.region.toLowerCase() === recordRegion.toLowerCase() ||
        rule.territory.toLowerCase().includes(recordRegion.toLowerCase())
      ));
      const segmentMatches = !!rule.segment && !!recordSegment && rule.segment.toLowerCase() === recordSegment.toLowerCase();
      const ruleIsEligible = rule.segment ? regionMatches && segmentMatches : regionMatches;
      const score = (stateMatches ? 4 : regionMatches ? 3 : 0) + (segmentMatches ? 2 : 0);
      return { rule, score, ruleIsEligible };
    })
    .filter(({ ruleIsEligible }) => ruleIsEligible);

  const uniqueOwners = new Set(eligible.map(({ rule }) => rule.owner));
  if (uniqueOwners.size !== 1) return undefined;

  return eligible.sort((a, b) => b.score - a.score)[0]?.rule;
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
    const referenceRow = matchReferenceRow(record, context);
    if (referenceRow?.owner && isValidReferenceValue(referenceRow.owner)) {
      const refDomain = normalizeValue(referenceRow.domain);
      const refAccount = normalizeValue(referenceRow.account);
      const refState = standardizeState(referenceRow.state);
      const refSegment = canonicalSegment(referenceRow.segment ?? "");
      const refRowId = referenceRow.record_id ?? "";
      const recordDomain = normalizeValue(record.domain).toLowerCase();
      const isDomainMatch = !!refDomain && refDomain.toLowerCase() === recordDomain;
      const matchKind = isDomainMatch ? `domain match (${refDomain})` : `account-name match (${refAccount})`;
      const refLabel = refRowId ? `${refRowId} — ${refAccount}` : refAccount;
      // Exact tier when the reference row carries the same record_id as the messy record.
      const isSameRecordId = !!refRowId && refRowId === record.record_id;
      const evidenceTier: EvidenceTier = isSameRecordId ? "exact_reference_match" : "strong_reference_match";

      const contextParts = [
        refState ? `state: ${refState}` : "",
        refSegment && isValidReferenceValue(refSegment) ? `segment: ${refSegment}` : "",
      ].filter(Boolean).join(", ");

      return {
        ...baseSuggestion,
        suggestedValue: referenceRow.owner,
        confidence: isSameRecordId ? 93 : 88,
        rationale: `${referenceRow.sourceName} contains this account/domain with owner "${referenceRow.owner}" via ${matchKind} — reference row: ${refLabel}${contextParts ? ` (${contextParts})` : ""}. Treat as a strong candidate requiring approval, not an automatic assignment.`,
        reviewState: "needs_approval",
        basis: basis(
          "crm_reference",
          "Based on reference CRM pattern",
          `${matchKind} → ${referenceRow.sourceName}${refRowId ? ` (${refRowId})` : ""}. Account: ${refAccount}${refState ? `, state: ${refState}` : ""}${refSegment && isValidReferenceValue(refSegment) ? `, segment: ${refSegment}` : ""}.`,
          "strong",
          referenceRow.sourceName,
          {
            evidenceTier,
            matchedRecordId: refRowId || undefined,
            matchedDomain: isDomainMatch ? refDomain : undefined,
            matchedAccount: refAccount || undefined,
            matchedState: refState || undefined,
            matchedSegment: refSegment && isValidReferenceValue(refSegment) ? refSegment : undefined,
          }
        ),
      };
    }

    const rule = matchOwnershipRule(record, context);
    if (rule) {
      const territoryLabel = rule.territory || rule.region || "matched territory";
      const stateLabel = standardizeState(record.state) || record.state || "unknown state";
      const segmentLabel = canonicalSegment(record.segment) || "no segment";
      return {
        ...baseSuggestion,
        suggestedValue: rule.owner,
        confidence: rule.segment ? 82 : 76,
        rationale: `Ownership rules file (${rule.sourceName}) has a single consistent owner for state ${stateLabel}${rule.segment ? ` and segment ${rule.segment}` : ""} in ${territoryLabel}. Treat as review-first — ownership rules are inspect-only and must be confirmed against the clean CRM reference.`,
        reviewState: "needs_approval",
        basis: basis(
          "ownership_rules",
          "Based on enabled ownership pattern",
          `Single-owner pattern matched state ${stateLabel} → ${regionForRecord(record)} and segment ${segmentLabel} → ${territoryLabel}${rule.queue ? ` via ${rule.queue}` : ""}.`,
          "strong",
          rule.sourceName,
          {
            evidenceTier: "rule_supported_match",
            matchedState: stateLabel,
            matchedSegment: segmentLabel,
          }
        ),
      };
    }
  }

  if (issueType === "missing_segment") {
    const isPlaceholderSuggestion = baseSuggestion.suggestedValue.toLowerCase().startsWith("needs");

    // Dictionary upgrade: only valid when the base suggestion IS a named segment tier.
    // Skip if the base is a placeholder (no keyword signal fired).
    if (!isPlaceholderSuggestion) {
      const dictionaryEntry = matchSegmentDictionary(baseSuggestion.suggestedValue, context);
      if (dictionaryEntry) {
        return {
          ...baseSuggestion,
          suggestedValue: dictionaryEntry.segment,
          confidence: Math.min(90, Math.max(baseSuggestion.confidence + 8, 84)),
          rationale: `Keyword signal confirmed against segment dictionary (${dictionaryEntry.sourceName}): "${dictionaryEntry.segment}" is an allowed tier${dictionaryEntry.definition ? ` — ${dictionaryEntry.definition}` : ""}. Review before export because the source record was blank.`,
          reviewState: "needs_approval",
          basis: basis(
            "segment_dictionary",
            "Based on segment dictionary",
            `${dictionaryEntry.segment} is an allowed segment in ${dictionaryEntry.sourceName}${dictionaryEntry.lifecycleStage ? ` for ${dictionaryEntry.lifecycleStage} lifecycle records` : ""}.`,
            "direct",
            dictionaryEntry.sourceName,
            { evidenceTier: "rule_supported_match" }
          ),
        };
      }
    }

    // CRM reference upgrade: works for both keyword candidates and no-signal records.
    const referenceRow = matchReferenceRow(record, context);
    if (referenceRow?.segment && isValidReferenceValue(referenceRow.segment)) {
      const refDomain = normalizeValue(referenceRow.domain);
      const refAccount = normalizeValue(referenceRow.account);
      const refState = standardizeState(referenceRow.state);
      const refRowId = referenceRow.record_id ?? "";
      const recordDomain = normalizeValue(record.domain).toLowerCase();
      const isDomainMatch = !!refDomain && refDomain.toLowerCase() === recordDomain;
      const matchKind = isDomainMatch ? `domain match (${refDomain})` : `account-name match (${refAccount})`;
      const isSameRecordId = !!refRowId && refRowId === record.record_id;
      const evidenceTier: EvidenceTier = isSameRecordId ? "exact_reference_match" : "strong_reference_match";
      const canonSeg = canonicalSegment(referenceRow.segment);

      return {
        ...baseSuggestion,
        suggestedValue: canonSeg,
        confidence: isSameRecordId ? 91 : 86,
        rationale: `${referenceRow.sourceName} shows this account/domain in the "${canonSeg}" segment via ${matchKind}${refRowId ? ` (${refRowId})` : ""}${refState ? `, state: ${refState}` : ""}. Keep review-first — source record was blank.`,
        reviewState: "needs_approval",
        basis: basis(
          "crm_reference",
          "Based on reference CRM pattern",
          `${matchKind} → ${referenceRow.sourceName}${refRowId ? ` (${refRowId})` : ""}. Account: ${refAccount}${refState ? `, state: ${refState}` : ""}, segment: ${canonSeg}.`,
          "strong",
          referenceRow.sourceName,
          {
            evidenceTier,
            matchedRecordId: refRowId || undefined,
            matchedDomain: isDomainMatch ? refDomain : undefined,
            matchedAccount: refAccount || undefined,
            matchedState: refState || undefined,
            matchedSegment: canonSeg,
          }
        ),
      };
    }
  }

  if (issueType === "inconsistent_state") {
    const referenceRow = matchReferenceRow(record, context);
    const referenceState = standardizeState(referenceRow?.state);
    if (referenceState && referenceState === standardizeState(baseSuggestion.suggestedValue)) {
      const refDomain = normalizeValue(referenceRow?.domain);
      const refAccount = normalizeValue(referenceRow?.account);
      const refRowId = referenceRow?.record_id ?? "";
      return {
        ...baseSuggestion,
        confidence: 98,
        rationale: "State normalization matches both the deterministic USPS mapping and the trusted CRM reference export.",
        basis: basis(
          "crm_reference",
          "Based on reference CRM pattern",
          `Reference row${refRowId ? ` (${refRowId})` : ""} confirms ${referenceState} for ${refDomain || refAccount}.`,
          "strong",
          referenceRow?.sourceName,
          {
            evidenceTier: "strong_reference_match",
            matchedRecordId: refRowId || undefined,
            matchedDomain: refDomain || undefined,
            matchedAccount: refAccount || undefined,
            matchedState: referenceState,
          }
        ),
      };
    }
  }

  return baseSuggestion;
}

export function suggestionBasisLabel(suggestion: ResolutionSuggestion): string {
  return suggestion.basis?.label ?? "Based on record-only heuristic";
}
