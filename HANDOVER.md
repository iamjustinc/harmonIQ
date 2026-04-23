# harmonIQ — Project Handover Document

**Date:** 2026-04-22  
**Status:** Active development — AI layer complete, detection-layer refactor complete at library level, UI wiring pending, build passing  
**Build command:** `npm run build` (Next.js 16.2.4, Turbopack, zero errors verified)

---

## 1. Project Overview

### What the product is
harmonIQ is a CRM data quality review tool. Users upload a messy CRM CSV export, the app detects data quality issues, surfaces evidence-based fix suggestions, and lets the user review/approve/override each issue type before exporting a cleaned dataset with a full audit trail.

### The core problem it solves
CRM exports going into marketing, sales ops, or enrichment workflows are frequently broken: owners are missing or invalid, segment values are blank or non-standard, state fields are spelled out instead of abbreviated, emails are malformed, duplicate accounts exist. harmonIQ makes those issues reviewable and auditable rather than silently wrong or silently fixed.

### Current goal of the project
The current development focus is completing the **real-data upload pipeline** — the issue detection infrastructure was just refactored so that `runDetection(records)` accepts any `CRMRecord[]`. The remaining step is wiring that function through the UI so that an uploaded CSV actually changes the issue counts and review queue.

### Intended user / workflow
1. Data ops / revenue ops analyst uploads a CRM CSV (or uses the demo flow)
2. Sets workflow mode (e.g. "Lead Routing", "Campaign Launch")
3. Reviews each issue type in turn: sees affected records, deterministic + AI suggestions, and a right-panel analysis
4. Approves, skips, or manually resolves each issue type
5. Exports cleaned CSV + change summary CSV with full audit trail

---

## 2. Current State

### Completed and working (verified by passing build + code inspection)

**Core product flow:**
- Landing page → upload screen → profile screen → review screen → results screen
- `/demo` route (self-contained demo at `app/demo/page.tsx` + `app/demo/DemoWorkspace.tsx`)
- All 7 issue types detected and surfaced: `missing_owner`, `duplicate_accounts`, `invalid_email`, `missing_segment`, `inconsistent_state`, `schema_mismatch`, `naming_format`
- 6 workflow modes: `lead_routing`, `campaign_launch`, `quarterly_reporting`, `account_segmentation`, `enrichment_import`, `territory_planning`
- Downstream impact simulator (per workflow mode)
- Right-side collapsible analysis panel with issue detail, suggestions, AI panel
- Manual exception handling modal (ManualFixDrawer) for `missing_owner`, `missing_segment`, `invalid_email`
- Save progress / continue later flow (localStorage)
- Cleaned CSV export + change summary CSV export

**Trust / evidence model:**
- `suggestOwner()` never proposes a named owner from heuristics alone — always returns placeholder `"Unassigned - Review"` unless reference context is loaded
- `suggestSegment()` returns keyword-signal candidates at `review_required` state; falls back to `"Needs Review"` placeholder when no signal fires
- `contextualizeSuggestion()` is the ONLY path to a named owner — requires ownership rules CSV or CRM reference CSV to be loaded
- Placeholder values render in amber italic throughout UI; "Use suggestion" button disabled for them
- Cleaned dataset preview color-codes cells by resolution type (emerald = deterministic/reference, violet = AI-reviewed, amber = unresolved)

**AI layer (fully wired):**
- OpenAI `gpt-4o-mini` (configurable via `OPENAI_MODEL` env var)
- Uses `OPENAI_API_KEY` from `.env.local` — key IS populated in the environment
- Server route: `app/api/recommend/route.ts` — direct HTTP fetch to OpenAI, no SDK, `json_object` response format, temperature 0.1
- Client helper: `lib/aiRecommendation.ts` — `fetchAIRecommendationWithStatus()` with 12-second timeout, diagnostic status return
- Rich evidence package per candidate (`AIRecommendationCandidate`: value, basisType, basisLabel, basisDetail, confidenceBand, source, matchSummary)
- Bounded candidate enforcement: server-side `validateAndNormalize` rejects any `recommendedValue` not in `candidateValues`; also rejects `missing_owner` and `missing_segment` candidates with only `weak_heuristic` / `no_basis` evidence
- `rejectedCandidateSummary: string[]` in AI output — model provides per-candidate rejection reasons in `"CandidateName: reason"` format
- AI panel in review screen: selected candidate card, confidence band + basis type pills, rationale, per-candidate comparison cards, evidence summary, caution note
- `AIFallbackPanel` shown when status is `"unavailable"` or `"fallback"`
- `annotateChangesWithAIReview()` — stamps ALL changes in an issue type with `aiCandidateCount`; primary record also gets `resolutionType: "ai_reviewed"`, `after` override, `candidateComparison`
- Results screen transformation log: `ResolutionBadge` (violet for ai_reviewed), `aiCandidateCount` line, `evidenceDetail`, `candidateComparison` per change

**Detection library refactor (completed — library layer only):**
- `lib/issueDetection.ts` now exports `DetectionResult` type, `runDetection(records: CRMRecord[])`, and `buildIssueDefinitions(detected: DetectionResult)`
- `DETECTED` is now `runDetection(SAMPLE_DATA)` — a backward-compat constant, NOT a hard dependency
- `ISSUE_DEFINITIONS` is now `buildIssueDefinitions(DETECTED)` — backward-compat constant
- `generateChanges(issueType, referenceContext?, detected?)` now accepts an optional third `detected` parameter, defaulting to the sample `DETECTED`
- `lib/data.ts` now exports `parseCrmCsv(csvText: string): CRMRecord[]` — a robust CSV parser with quoted-field support and flexible column name mapping

**Dependencies:**
- `@anthropic-ai/sdk` was REMOVED — no longer in package.json or installed. Do not add it back.
- No `openai` npm package — route uses direct HTTP fetch. This is intentional.
- Current dependencies: `next@16.2.4`, `react@19.2.4`, `react-dom@19.2.4`

### Partially completed

- **UI wiring for uploaded CSV data** — The library layer is ready (`runDetection`, `parseCrmCsv` exist) but `DemoWorkspace.tsx`, `ReviewScreen.tsx`, `ProfileScreen.tsx`, and `lib/workflows.ts` still reference the static `DETECTED` / `ISSUE_DEFINITIONS` constants. The next step is adding `crmRecords` state to `DemoWorkspace`, parsing the uploaded file, calling `runDetection`, and passing `DetectionResult` as a prop down to screens that use it.

- **AI only evaluates the FIRST record** in an issue type as the representative. If there are 4 missing-owner records, the AI was only consulted about record[0]'s context. Records 2–4 get deterministic/reference annotations + `aiCandidateCount` stamped, but their `resolutionType` stays as deterministic/reference, not `"ai_reviewed"`. This is a known, deliberate design tradeoff (not a bug) but limits completeness.

### Still broken / unresolved

- **Real uploaded CSV is still not used for issue detection** — the library layer is now ready (`runDetection`, `parseCrmCsv`), but the UI stack has not been wired. `DemoWorkspace.tsx` calls `handleAnalyze(fileName)` with the file name only — it does NOT read the file content or run `runDetection`. `ReviewScreen.tsx` and `ProfileScreen.tsx` still call `DETECTED.*` and `ISSUE_DEFINITIONS` directly. See Section 7 Step 1 for the wiring plan.

- **`UploadScreen.tsx` discards the file content** — when a CSV is dropped or selected, only `file.name` is stored. The actual `File` object is not retained. To wire real data, `UploadScreen` must store the File reference and read its content before calling `onAnalyze`.

- **`lib/workflows.ts` `impactCountByIssue`** is a module-level constant using `DETECTED.*`. It is used by `getWorkflowImpactMetrics()` to show counts like "14 would fail routing". These counts are hardcoded to the sample data until `getWorkflowImpactMetrics` is updated to accept an optional `DetectionResult`.

### Still using placeholder / synthetic / demo logic

- ALL 79 records in `lib/data.ts` are synthetic. They are designed to demonstrate specific issue types.
- Sample reference context in `lib/referenceContext.ts` (`SAMPLE_OWNERSHIP_RULES`, `SAMPLE_SEGMENT_DICTIONARY`, `SAMPLE_CRM_REFERENCE`) is hardcoded as CSV strings — used by the demo flow and the "Load sample context" button in the app.
- Readiness score changes are hardcoded per issue type in `lib/workflows.ts`.

---

## 3. Important Decisions Already Made

### UX / product decisions
- **AI never auto-applies values.** Every AI recommendation requires human approval through the "Approve Issue Type" button. The panel is advisory only.
- **Placeholder values are visible and honest.** `"Unassigned - Review"` and `"Needs Review"` render in amber italic everywhere. They cannot be accepted via "Use suggestion." The user must manually enter a value or leave it unchanged.
- **Deterministic fixes (state normalization, email repair) don't need AI.** AI only runs for `missing_owner` and `missing_segment`. Never for `inconsistent_state`, `naming_format`, `schema_mismatch`, `duplicate_accounts`, `invalid_email`.
- **AI fallback is silent to the user.** If `OPENAI_API_KEY` is missing or the API fails, the `AIFallbackPanel` shows a message but the rest of the UI remains fully functional with deterministic suggestions.
- **All decisions are reversible until export.** "Undo decision" button re-opens any approved issue for re-review.
- **No row-level editing in the main approval flow.** "Approve Issue Type" applies changes to all records of that type. Row-level editing is only available via the ManualFixDrawer.

### Technical decisions
- **OpenAI via direct HTTP fetch** — no SDK dependency. `Authorization: Bearer ${apiKey}` header.
- **Bounded candidate enforcement is server-side.** Even if the AI prompt is ignored, `validateAndNormalize()` overrides any out-of-bounds `recommendedValue` to null. Trust does not depend on prompt compliance alone.
- **`"Unassigned - Review"` as owner placeholder** is a deliberate trust signal, not an oversight. It tells the reviewer "the system found no evidence to recommend a named owner."
- **`contextualizeSuggestion()` in `lib/referenceContext.ts` is the only upgrade path to a named owner.** `suggestOwner()` always returns a placeholder. Only after a reference CSV is loaded and matched does a named owner appear.
- **AI is skipped when `candidateValues` is empty.** If no reference context is loaded and no same-domain dataset evidence exists, the AI call is bypassed and `AIFallbackPanel` shows. This is correct — the AI would only return null anyway.
- **Model is `gpt-4o-mini`** by default. Can be overridden via `OPENAI_MODEL` env var.
- **`parseCrmCsv` uses a hand-rolled tokeniser** (not a library) — handles double-quoted fields and flexible column name aliasing. No external dependency needed.

### Constraints the owner explicitly cares about
1. **Do NOT use Anthropic / Claude API.** Use OpenAI only. `@anthropic-ai/sdk` was deliberately removed.
2. **Do NOT broad-refactor.** Changes must be targeted and narrow.
3. **Do NOT redesign screens.** Existing layout, sidebar, workflow panels, and review flow must be preserved exactly.
4. **No `any` types, no type suppression.**
5. **`npm run build` must always pass.**
6. **Do NOT remove or break** the demo route (`/demo`), the reference context upload flow, the manual exception modal, the save/continue flow, or the CSV export.
7. **AI must not invent values.** It may only select from the bounded `candidateValues` list derived from reference context and deterministic logic.

### Things that should NOT be changed
- `lib/types.ts` — stable, do not modify unless adding a new field with clear justification
- `lib/data.ts` — 79-row synthetic sample, do not edit the record rows (adding exports like `parseCrmCsv` is fine)
- `app/demo/` — demo route must stay working
- `components/Sidebar.tsx` — navigation sidebar, do not touch
- `components/harmoniq-ui.tsx` — shared UI components, do not refactor
- The 4-screen navigation flow (upload → profile → review → results)
- Workflow mode system in `lib/workflows.ts` (extending it is fine; removing things is not)
- Color scheme conventions: emerald = deterministic/grounded, amber = heuristic/review-required, indigo = reference-backed, violet = AI-reviewed

---

## 4. Data and File Context

### Exact file inventory

```
harmonIQ/
├── app/
│   ├── api/recommend/route.ts      ← OpenAI API route (server-side only)
│   ├── demo/
│   │   ├── page.tsx                ← /demo route entry
│   │   └── DemoWorkspace.tsx       ← self-contained demo state + navigation
│   ├── layout.tsx                  ← root layout, minimal
│   └── page.tsx                    ← renders LandingPage
├── components/
│   ├── LandingPage.tsx             ← marketing/entry page with "Try Demo" CTA
│   ├── UploadScreen.tsx            ← file upload UI (stores filename only — see Step 1)
│   ├── ProfileScreen.tsx           ← workflow mode selection + reference context upload
│   ├── ReviewScreen.tsx            ← main review UI — AI panel, flag table, diff table, manual fix drawer
│   ├── ResultsScreen.tsx           ← results screen — cleaned preview, transformation log, exports
│   ├── Sidebar.tsx                 ← navigation sidebar (do not modify)
│   └── harmoniq-ui.tsx             ← shared UI primitives (do not refactor)
├── lib/
│   ├── data.ts                     ← 79-row SAMPLE_DATA + parseCrmCsv(csvText) export
│   ├── types.ts                    ← all TypeScript interfaces (CRMRecord, ApprovedChange, etc.)
│   ├── issueDetection.ts           ← DetectionResult type, runDetection(), buildIssueDefinitions(),
│   │                                  generateChanges(issueType, refCtx?, detected?)
│   │                                  DETECTED / ISSUE_DEFINITIONS still exported as compat constants
│   ├── referenceContext.ts         ← CSV parsing, contextualizeSuggestion, sample context strings
│   ├── aiRecommendation.ts         ← AI types + fetchAIRecommendationWithStatus
│   └── workflows.ts                ← workflow mode definitions + issue definitions per mode
│                                     NOTE: still uses module-level DETECTED for impact counts
├── .env.local                      ← OPENAI_API_KEY is set here (do not print or commit)
└── package.json                    ← next, react, react-dom only (no openai SDK, no anthropic)
```

### Real data vs fake/sample/demo data

| File | Data type | Notes |
|------|-----------|-------|
| `lib/data.ts` SAMPLE_DATA | **Fully synthetic** | 79 hand-crafted records with planted issues |
| `lib/data.ts` parseCrmCsv | **Runtime parser** | Converts uploaded CSV text to CRMRecord[] |
| `lib/referenceContext.ts` → `SAMPLE_OWNERSHIP_RULES` | **Synthetic** | 9 routing rules for demo |
| `lib/referenceContext.ts` → `SAMPLE_SEGMENT_DICTIONARY` | **Synthetic** | 3 segment entries |
| `lib/referenceContext.ts` → `SAMPLE_CRM_REFERENCE` | **Synthetic** | 8 reference rows |
| `.env.local` | **Real** | Real `OPENAI_API_KEY` — works live |
| `app/api/recommend/route.ts` | **Real** | Live OpenAI calls |

### Which files to prioritize for understanding

1. `lib/types.ts` — start here for all data shapes
2. `lib/referenceContext.ts` — understand `contextualizeSuggestion()` before touching any suggestion logic
3. `lib/aiRecommendation.ts` — AI types and fetch helper
4. `app/api/recommend/route.ts` — server route, validation logic
5. `components/ReviewScreen.tsx` — largest file, contains all AI state/effects/panel
6. `lib/issueDetection.ts` — detection functions, `runDetection`, `generateChanges`

### Which files or logic should no longer be used

- `@anthropic-ai/sdk` — removed, do not reinstall
- Any previous `fetchAIRecommendation()` call sites that don't pass `candidates: AIRecommendationCandidate[]` — the interface now REQUIRES this field
- Old pattern of building `candidateValues: string[]` without evidence — use `buildAIRecommendationEvidencePackage()` from ReviewScreen.tsx

---

## 5. AI Reasoning / Matching Logic

### How the current AI flow works

**Trigger:** When `activeIssueType` is `"missing_owner"` or `"missing_segment"` AND `candidateValues.length > 0`, the `useEffect` in `ReviewScreen` fires an AI request.

**Evidence building (`buildAIRecommendationEvidencePackage` in ReviewScreen.tsx):**
1. Takes the FIRST record in `DETECTED.missingOwner` or `DETECTED.missingSegments` as representative context
2. For `missing_owner`:
   - Iterates `ctx.ownershipRules` — if rule matches both region AND segment → `direct_rule` candidate; partial match → `weak_heuristic`
   - Iterates `ctx.crmReferenceRows` — domain or account name match → `reference_pattern` candidate
   - Iterates `DETECTED.duplicates` — same-domain records with populated owner → `dataset_pattern` candidate
3. For `missing_segment`:
   - Iterates `ctx.segmentDictionary` — all allowed values → `direct_rule` if matches deterministic suggestion, else `weak_heuristic`
   - Falls back to built-in ["Enterprise", "Mid-Market", "SMB"] if no dictionary loaded
   - Iterates `ctx.crmReferenceRows` — domain/account match with segment → `reference_pattern`
   - Iterates `DETECTED.duplicates` — same-domain records with segment → `dataset_pattern`
4. `upsertCandidate()` deduplicates by value, keeping the highest `BASIS_RANK` entry
5. Returns `{ candidates: AIRecommendationCandidate[], candidateValues: string[], currentDatasetSignals: string[] }`

**API call (`app/api/recommend/route.ts`):**
- Sends issue type, workflow mode, record context, candidate list with full evidence, existing deterministic suggestion, evidence summary (which reference sources are loaded, matched rule detail, active source filenames)
- System prompt enforces: no email-as-owner, no state-alone-as-owner, evidence hierarchy (direct_rule > reference_pattern > dataset_pattern > weak_heuristic > no_basis)
- Model returns JSON with `recommendedValue`, `basisType`, `confidenceBand`, `rationale`, `evidenceSummary`, `cautionNote`, `manualReviewRequired`, `rejectedCandidateSummary`
- `validateAndNormalize()` server-side:
  - Rejects any `recommendedValue` not in `candidateValues` → override to null + caution note
  - Rejects any `missing_owner` or `missing_segment` recommendation backed only by `weak_heuristic` or `no_basis` → override to null
  - Returns normalized `AIRecommendationResult`

**UI display (ReviewScreen.tsx `AIRecommendationPanel`):**
- Shows selected candidate in a white box, or "Manual review required — insufficient evidence" in amber italic
- Shows confidence band pill + basis type pill
- Shows rationale text
- Shows per-candidate cards: each candidate value + basisLabel + source + confidenceBand + Selected/Rejected/Review label + model's rejection reason (from `rejectedCandidateSummary`) or fallback static string
- Shows evidence summary and caution note
- Shows deterministic preview value with note "AI output is not applied until the issue type is approved"

**Approval (`approveCurrentIssue` in ReviewScreen.tsx):**
- Calls `generateChanges(activeIssueType, activeReferenceContext)` — deterministic changes for ALL records
- Calls `annotateChangesWithAIReview(changes, activeIssueType, aiRecommendation, aiCandidates)` — annotates all matching changes

**Change annotation (`annotateChangesWithAIReview`):**
- Matches on `change.issueType === issueType && change.field === field`
- PRIMARY record (first one, whose context was sent to AI):
  - If `recommendation.recommendedValue`: sets `after` to AI value, `resolutionType: "ai_reviewed"`, full `evidenceDetail` with candidate count, `candidateComparison`
  - If `recommendation.manualReviewRequired`: sets `after` to placeholder, `resolutionType: "unresolved_review_required"`, `aiCandidateCount`
- ALL OTHER records in same issue type: adds `aiCandidateCount` + appends note to `evidenceDetail`

### Where the reasoning is too broad or ungrounded

1. **AI only evaluates ONE representative record.** If record 1 is CA/Enterprise and record 2 is TX/SMB, the AI saw record 1's context. Record 2's annotation is lighter. The AI recommendation may not apply.

2. **`dataset_pattern` candidates come from `DETECTED.duplicates`.** This uses domain clustering. For the current sample data, Northstar Health appears 3 times — if record 1 has owner "Noah Kim", that becomes a `dataset_pattern` candidate for the missing-owner records. This is reasonable but assumes the duplicate owner is correct (it was planted as correct in the sample data).

3. **Segment dictionary lookup in `contextualizeSuggestion`** only upgrades the suggestion if `baseSuggestion.suggestedValue` is NOT a placeholder. So if no keyword fired and the base is `"Needs Review"`, the dictionary is still checked via the CRM reference path, not the dictionary path.

### What needs to change so outputs are evidence-based

The system is already well-grounded. The remaining improvement opportunities are:
- When multiple records have different contexts (different state/segment), run AI on a representative sample of them, not just the first
- Make `dataset_pattern` evidence stronger only when the same-domain records were already verified (not just present with a populated value)

### How candidate matching / owner assignment / manual review should behave

| Evidence available | Expected behavior |
|---|---|
| No reference context loaded | `"Unassigned - Review"` placeholder, no AI call |
| Ownership rules loaded, no segment | `direct_rule` candidate from region match only (88% confidence) |
| Ownership rules loaded, segment matches | `direct_rule` candidate (94% confidence) |
| CRM reference only | `reference_pattern` candidate (88% confidence) |
| Both rules and reference | Both candidates appear; AI selects highest-rank |
| Weak keyword only | `weak_heuristic` candidate — AI REJECTS for owner and segment |
| Empty candidates | AI not called; `AIFallbackPanel` shows |

### What "good" grounded reasoning looks like

For `jordan.johnson@northstarhealth.com` (REC-002, ZENITH LABS, CA, Enterprise):
- **Good:** "Noah Kim selected: direct_rule match — West Enterprise territory in ownership rules file. Rejected: Olivia Park: SMB/Mid-Market territory only. Lucas Rivera: Northeast territory, not West."
- **Bad (must not happen):** "Jordan Johnson selected: email address matches account domain"
- **Bad (must not happen):** "Noah Kim selected: CA is a West state (geographic heuristic)"

---

## 6. Known Problems

### Functional
1. **Real uploaded CSV is not yet wired into detection.** The library layer is done (`runDetection`, `parseCrmCsv`), but `DemoWorkspace`, `ReviewScreen`, `ProfileScreen`, and `workflows.ts` still use the static `DETECTED` constant. See Step 1 in Section 7 for the exact wiring plan.
2. **`UploadScreen` discards the File object.** `acceptFile(file.name)` stores the name only. The File reference is lost before `onAnalyze` is called. Must store the file object (or its parsed CSV text) so it can be passed to `DemoWorkspace`.
3. **AI evaluates only the first record per issue type.** If records have diverse contexts, the AI recommendation may be inappropriate for some of them (though the `after` value is only changed for the first record).
4. **`aiCandidates` state resets on issue type change.** If user switches issue types and comes back, the AI re-fetches. This is correct behavior but can be slow on first load.

### UI / Trust
5. **Transformation log shows `evidenceDetail` truncated with `line-clamp-2`** in the Evidence column. Long AI evidence strings get cut off. Not a bug but reduces legibility.
6. **ManualFixDrawer "Use all suggestions" skips placeholder rows** (correct) but doesn't explain to the user why those rows weren't pre-filled.
7. **`resolutionType` on non-primary records is `"reference_backed"` even though AI ran.** This is architecturally correct (each record's own evidence determines its type) but can confuse users reading the log.

### Edge cases
8. **Records with no state value** return empty region from `regionForRecord()` → no ownership rule match possible → falls through to reference row or dataset pattern only.
9. **Segment values like "Growth" map to "Mid-Market"** via `canonicalSegment()` — this is intentional but not visible to the user. They might see "Growth" in a source file and "Mid-Market" in the suggestion.
10. **`matchReferenceRow` uses substring match** for account names (`account.includes(referenceAccount)`). A reference account name of "Star" would match "Northstar" — overly broad.

### Performance
11. **AI call fires on every issue type switch** (missing_owner or missing_segment). No caching between sessions. 12-second timeout.

---

## 7. Next Recommended Steps

### Priority order

**Step 1 (highest priority): Finish wiring uploaded CSV into issue detection**

The library layer is done. What remains is the UI stack. The exact changes needed:

**(A) `components/UploadScreen.tsx`:**
- Store the File object: add `const fileObjRef = useRef<File | null>(null)` (or a state variable)
- In `handleDrop` and the `onChange` handler: save the file object alongside the name
- In `handleAnalyze`: read the file text `await fileObj.current?.text()` and pass it to `onAnalyze(selectedName, csvContent)`
- Change `onAnalyze` prop signature: `onAnalyze: (fileName: string, csvContent?: string) => void`
- When using the sample (loadSample path): pass `csvContent = undefined`

**(B) `app/demo/DemoWorkspace.tsx`:**
- Import: `CRMRecord` from `lib/types`, `SAMPLE_DATA` from `lib/data`, `parseCrmCsv` from `lib/data`, `runDetection`, `DetectionResult`, `buildIssueDefinitions` from `lib/issueDetection`
- Add state: `const [crmRecords, setCrmRecords] = useState<CRMRecord[]>(SAMPLE_DATA)`
- Add derived state: `const [detectionResults, setDetectionResults] = useState<DetectionResult>(() => DETECTED)` — or compute it as a memo from `crmRecords`
- Update `handleAnalyze(name, csvContent?)`:
  - If `csvContent` is provided: `const records = parseCrmCsv(csvContent); setCrmRecords(records.length > 0 ? records : SAMPLE_DATA)`
  - Call `setDetectionResults(runDetection(records))`
- Pass `detectionResults` prop to `ReviewScreen` and `ProfileScreen`

**(C) `components/ReviewScreen.tsx`:**
- Add `detectionResults?: DetectionResult` to props interface
- Add `const detected = detectionResults ?? DETECTED` at top of component
- Replace all `DETECTED.*` usages with `detected.*` (there are ~15 references)
- Pass `detected` as third arg to `generateChanges(activeIssueType, activeReferenceContext, detected)`

**(D) `components/ProfileScreen.tsx`:**
- Add `detectionResults?: DetectionResult` to props interface
- Change `const definitions = getWorkflowIssueDefinitions(workflowMode)` to pass detected when available
- OR: accept `issueDefinitions?: IssueDefinition[]` from the parent directly

**(E) `lib/workflows.ts` (optional but makes counts accurate):**
- Import `DetectionResult` from issueDetection
- Convert `impactCountByIssue` from a module-level const to a function `getImpactCounts(detected: DetectionResult)`
- Add optional `detected?: DetectionResult` to `getWorkflowIssueDefinitions` and `getWorkflowImpactMetrics`

**Validation:** Upload a custom 5-row CSV with 2 missing-owner records. Verify the "Missing Owner Fields" card in ProfileScreen shows count 2, not 14.

**Step 2: Multi-record AI evaluation**
For issue types with diverse records (e.g., missing owners across 3 different states), evaluate a small representative sample (max 3 records) and aggregate the AI results.
- Build `buildAIRecommendationEvidencePackage` for up to 3 records
- Pass the aggregated candidate set to AI with context noting it covers multiple records
- **Validate:** Test with records from 2 different territories; verify AI selects the right owner for each context

**Step 3: Session persistence**
Currently all work is lost on refresh. Add `localStorage` persistence for:
- `approvedChanges` array
- `issueStatuses` object
- `referenceContext` (or at minimum, a flag that reference was loaded)
- **Validate:** Approve one issue, refresh, confirm decision persists

**Step 4 (polish): Transformation log evidence detail truncation**
Remove `line-clamp-2` from the Evidence column or add a "show more" toggle so the full `evidenceDetail` is readable in the UI.

**Step 5: Account for multi-record AI in the transformation log**
Improve `annotateChangesWithAIReview` to run separate AI evaluations for each record with a distinct evidence context (different territory, segment), rather than applying one representative result.

### What success looks like
- Upload any CRM CSV → issue detection runs on that file's actual data, profile shows correct counts
- Load sample ownership rules → missing-owner records show named candidates from rules
- Click "Approve Issue Type" for missing_owner → transformation log shows which record got which owner, why, what AI evaluated, what was rejected
- User can verify causal chain for every change in the export

---

## 8. Prompting / Implementation Guidance for the Next Chat

### What the next assistant MUST know

1. **This is NOT a standard Next.js app.** The project has already been set up with Next.js 16.2.4 (App Router), `"use client"` components, and a server route at `app/api/recommend/route.ts`. The guide in `node_modules/next/dist/docs/` should be checked before writing Next.js-specific code.

2. **The AI layer is ALREADY COMPLETE.** Do not rewrite `lib/aiRecommendation.ts`, `app/api/recommend/route.ts`, or the AI panel in `ReviewScreen.tsx`. These were completed and verified in previous sessions.

3. **The detection library layer is ALREADY REFACTORED.** `lib/issueDetection.ts` now exports `DetectionResult`, `runDetection(records)`, `buildIssueDefinitions(detected)`. `generateChanges` accepts an optional `detected` third arg. `lib/data.ts` exports `parseCrmCsv`. Do NOT re-add these — they exist. What is missing is the UI wiring (see Step 1, items A–E in Section 7).

4. **`@anthropic-ai/sdk` was deliberately removed.** Do not add it back. Do not add the `openai` npm package either — the route uses direct HTTP fetch intentionally.

5. **Do not edit the SAMPLE_DATA rows in `lib/data.ts`** — the 79-row SAMPLE_DATA is intentionally synthetic and must remain as the demo baseline.

6. **`contextualizeSuggestion()` in `lib/referenceContext.ts`** is the upgrade path from placeholder to named suggestion. Understanding this function is mandatory before editing any suggestion logic.

7. **The `AIRecommendationRequest` interface requires `candidates: AIRecommendationCandidate[]`** (not just `candidateValues: string[]`). Any call to `/api/recommend` that omits `candidates` will fail TypeScript.

### Warnings about common mistakes

- **DO NOT** call `suggestOwner()` in any context that expects a named owner. It always returns a placeholder. Only `contextualizeSuggestion()` with loaded reference context produces a named owner.
- **DO NOT** add named owners to `suggestOwner()` based on state or segment alone. This was intentionally removed.
- **DO NOT** remove the `isPlaceholderSuggestion()` check before the "Use suggestion" button. This guard exists so users can't accidentally accept `"Unassigned - Review"` as a real value.
- **DO NOT** add `aiGenerated: true` manually to objects — it is only set by `validateAndNormalize()` in the server route.
- **DO NOT** call `fetchAIRecommendation()` (the compat wrapper) from new code. Use `fetchAIRecommendationWithStatus()` which returns status + message + provider in addition to the result.
- **DO NOT** use `response_format: { type: "json_schema" }` with strict mode for the OpenAI call — nullable fields like `recommendedValue: string | null` don't work cleanly with strict mode. Keep `json_object` + server-side `validateAndNormalize`.
- **DO NOT** re-add `DetectionResult`, `runDetection`, or `parseCrmCsv` — they already exist in the codebase.

### How to avoid regressing the existing product

Before any PR/commit:
1. `npm run build` must pass with zero errors
2. Navigate to `/demo` — it must load, show 79 records, show all 7 issue types
3. Load sample context from the UI — owner suggestions must change from placeholder to named reps
4. AI panel must show (if `OPENAI_API_KEY` is in `.env.local`) or show fallback panel (if not)
5. Approve missing_owner → results screen must show violet "AI-reviewed" badge for the first missing-owner record

### How to preserve current style/UI while fixing logic

- Tailwind classes define the color semantic: `text-violet-*`/`border-violet-*`/`bg-violet-*` = AI; `text-amber-*`/`bg-amber-*` = heuristic/review-required; `text-emerald-*`/`bg-emerald-*` = deterministic/grounded; `text-indigo-*` = reference-backed
- `RESOLUTION_META` in `ResultsScreen.tsx` maps `ResolutionType` to these colors — add new resolution types here if needed
- All badge/pill patterns use: `rounded-full border px-2 py-0.5 text-[10px] font-bold` — follow this for consistency
- Font scale: `text-[10px]` for labels/captions, `text-[11px]` for secondary info, `text-xs` for body, `text-sm` for primary values, `text-base`/`text-lg` for headings

---

## 9. Open Questions / Uncertainties

### Not yet verified in production
1. **OpenAI call latency in practice.** The 12-second timeout should be sufficient for `gpt-4o-mini`, but this has not been tested under load or with large candidate sets.
2. **Whether `rejectedCandidateSummary` format is consistent.** The system prompt asks for `"CandidateName: reason"` format, and the panel parses it with `.startsWith(candidate.value.toLowerCase() + ":")`. If the model returns a slightly different format (e.g., wrapping in quotes), the parse will fall back to the static `candidateReason()` string. This fallback is safe but the model reason won't show.
3. **`gpt-4o-mini` compliance with `rejectedCandidateSummary` schema.** This field was added but has not been tested end-to-end with a live API call in a controlled scenario.

### Assumptions that still need checking
4. **Sample CRM reference domain matching** — `matchReferenceRow` uses substring match for account names. This could produce false positive matches for short reference account names. Needs review for edge cases.
5. **`DETECTED.duplicates` as source of `dataset_pattern` candidates** — this assumes the same-domain records in the duplicate clusters have valid populated owners. For records where the owner IS missing (that's why we're in the missing_owner flow), this would create a circular reference. In the sample data this doesn't happen (the duplicate clusters have valid owners), but in real data it might.
6. **The `activeReferenceContext` dependency in the `useEffect`** — since `activeReferenceContext` is `referenceContext ?? EMPTY_REFERENCE_CONTEXT` and `referenceContext` is a prop, every parent re-render that creates a new referenceContext object (even with the same content) will re-trigger the AI fetch. This could cause unnecessary API calls if the parent isn't memoizing the referenceContext.

### Things verified in this session
7. **`DemoWorkspace.tsx`** — fully read. Uses localStorage for save/restore. `handleAnalyze` receives only `fileName: string` (no CSV content). Confirms that File content is never passed up.
8. **`ProfileScreen.tsx`** — fully read. Uses `getWorkflowIssueDefinitions(workflowMode)` and `getWorkflowImpactMetrics(workflowMode, issueStatuses)` from `lib/workflows.ts` — both still use module-level `DETECTED`. Will need the `DetectionResult` prop passed in once Step 1 is done.

---

## 10. Restart Prompt

Paste this into a new chat to continue:

---

> **Project:** harmonIQ — CRM data quality review tool at `/Users/justinsmacbookair/Downloads/harmonIQ`
>
> **Stack:** Next.js 16.2.4 (App Router), React 19, TypeScript, Tailwind v4. No openai npm package — OpenAI calls use direct HTTP fetch via `app/api/recommend/route.ts`. No @anthropic-ai/sdk. `OPENAI_API_KEY` is in `.env.local`. Build passes (`npm run build`).
>
> **What's complete:** The full product flow works. Issue detection, suggestion logic, AI recommendation layer (OpenAI-backed, bounded candidates, `rejectedCandidateSummary`), transformation log with AI visibility, all exports. The detection library was also refactored this session: `lib/issueDetection.ts` now exports `DetectionResult`, `runDetection(records: CRMRecord[])`, `buildIssueDefinitions(detected)`, and `generateChanges` accepts an optional `detected` third arg. `lib/data.ts` exports `parseCrmCsv`. See HANDOVER.md for full context.
>
> **Core design rule:** AI never invents values. It evaluates a bounded `AIRecommendationCandidate[]` set derived from uploaded reference context and selects from it or returns null. `validateAndNormalize()` server-side enforces this regardless of model output.
>
> **The remaining gap (UI wiring only):** The library layer is ready but `DemoWorkspace.tsx`, `ReviewScreen.tsx`, `ProfileScreen.tsx`, and `lib/workflows.ts` still use the static `DETECTED`/`ISSUE_DEFINITIONS` constants. The wiring plan is detailed in Section 7, Step 1 items A–E. Summary: (A) `UploadScreen` must store the File object and pass CSV text to `onAnalyze`; (B) `DemoWorkspace` must add `crmRecords` state, call `parseCrmCsv` + `runDetection`, and pass `detectionResults` prop down; (C) `ReviewScreen` must accept `detectionResults?: DetectionResult` and replace `DETECTED.*` usages; (D) `ProfileScreen` must accept `detectionResults?` and use it in `getWorkflowIssueDefinitions`; (E) `workflows.ts` `getWorkflowImpactMetrics` needs an optional `detected` param.
>
> **Read HANDOVER.md before writing any code.** It contains the full file inventory, trust model, AI architecture, known bugs, and implementation guidance.
>
> **First task:** Start with items (A) and (B) — update `UploadScreen` to capture and pass CSV content, then update `DemoWorkspace` to parse it and run `runDetection`. Verify with `npm run build` after each item. Do not start on (C) until (A) and (B) pass the build.
