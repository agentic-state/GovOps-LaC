# GovOps Spec — Cases (list + detail with evaluate / review / audit)
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002] -->
type: route
priority: p1
depends_on: [govops-001, govops-002]
spec_id: govops-009

## Intent

Replace the existing Jinja `/cases` and `/cases/{id}` surfaces with a React equivalent. Maintainers and reviewers see the case bundle list, drill into a case to inspect the applicant, evidence, and residency periods, run the evaluation engine, review the recommendation, take human-review actions, and view the full audit package. This is the operational surface where citizens' files become decisions.

The backend already serves all required endpoints — no new backend work is needed for this spec.

## Acceptance criteria

### `/cases` — list

- [ ] Route loads `GET /api/cases` on mount; columns: applicant name, status, "evaluated?" indicator, action button
- [ ] Status pill maps to verdict tokens: `intake`/`under_review` → pending, `recommendation_ready` → agent, `decided` → enacted, `escalated` → rejected
- [ ] Each row shows a provenance ribbon — `agent` if `has_recommendation` is true, `human` once a review is on file (heuristic: backend doesn't tell us yet, so client treats `decided` status as `human`), else `system`
- [ ] Click row → `/cases/$caseId`
- [ ] Filter chips: status (multi-select), jurisdiction (single)
- [ ] Empty state: "No cases yet — seed a jurisdiction or import data."

### `/cases/$caseId` — detail

- [ ] Loads `GET /api/cases/$caseId` on mount; layout uses three sections: **Applicant + evidence**, **Recommendation**, **Human review + audit**
- [ ] **Applicant pane** shows: legal name, date_of_birth (locale-formatted), legal_status pill, country_of_birth, residency periods (vertical list, each with country chip + start/end dates + verified checkmark), evidence items (table: type, description, provided/verified flags)
- [ ] **Recommendation pane**:
  - If `recommendation == null`: empty card with "Run evaluation" agent-variant button → `POST /api/cases/$caseId/evaluate`
  - If present: outcome pill (eligible/ineligible/insufficient_evidence/escalate), confidence ring (0-100% as donut), explanation paragraph, list of `RuleEvaluation`s (each: rule description, citation as `<CitationLink>`, outcome chip, evidence_used chips, detail expandable), `pension_type` + `partial_ratio` if present, missing_evidence list, flags
  - Provenance ribbon: `agent` (recommendation is engine-generated)
- [ ] **Human review** pane:
  - Lists prior `HumanReviewAction`s, each with reviewer, action chip, rationale, timestamp, final_outcome
  - "Take action" panel (visible only when a recommendation exists and the case is not yet `decided`):
    - Action select: `approve` / `modify` / `reject` / `request_info` / `escalate`
    - Rationale textarea (required, min 20 chars)
    - Final outcome select (defaults to recommendation outcome; only shown when action is `modify`)
    - Submit button (authority variant) → `POST /api/cases/$caseId/review`
  - Provenance ribbon: `human` (review is the canonical human-authority act)
- [ ] **Audit drawer**: "View audit package" button opens a slide-over (shadcn `Sheet`) with `GET /api/cases/$caseId/audit`
  - Shows: jurisdiction, authority chain, applicant_summary, recommendation, review_actions, full audit_trail (timestamp + event_type + actor + detail), rules_applied, evidence_summary
  - "Export JSON" button: downloads the package as `case-$caseId-audit.json`
  - Tab navigation between sections; first tab is "Trail" with chronological list
- [ ] Loading: skeleton cards for each section
- [ ] Error: civic banner + retry; on action failure (network/validation), toast
- [ ] All actions announce status via `aria-live="polite"` ("Recommendation generated", "Review recorded")

## Files to create / modify

```
src/routes/cases.tsx                            (new — list)
src/routes/cases.$caseId.tsx                    (new — detail)
src/components/govops/cases/CaseRow.tsx         (new)
src/components/govops/cases/ApplicantPane.tsx   (new)
src/components/govops/cases/EvidenceTable.tsx   (new)
src/components/govops/cases/ResidencyTimeline.tsx (new)
src/components/govops/cases/RecommendationPane.tsx (new)
src/components/govops/cases/RuleEvaluationItem.tsx (new)
src/components/govops/cases/ConfidenceRing.tsx  (new)
src/components/govops/cases/ReviewActionForm.tsx (new)
src/components/govops/cases/ReviewLog.tsx       (new)
src/components/govops/cases/AuditDrawer.tsx     (new — uses shadcn Sheet)
src/components/govops/cases/StatusPill.tsx      (new)
src/components/govops/cases/OutcomePill.tsx     (new)
src/components/govops/cases/ActionPill.tsx      (new)
src/lib/api.ts                                  (modify — add 5 case helpers)
src/lib/types.ts                                (modify — add Case, Recommendation, HumanReviewAction, AuditPackage types)
src/messages/{en,fr,pt-BR,es-MX,de,uk}.json     (modify — add cases.* keys)
```

Update masthead nav in [Masthead.tsx](src/components/govops/Masthead.tsx) to include `/cases` link before `/config`.

## Tokens / data

```ts
// src/lib/types.ts additions
export type CaseStatus =
  | "intake" | "evaluating" | "recommendation_ready"
  | "under_review" | "decided" | "escalated";

export type DecisionOutcome =
  | "eligible" | "ineligible" | "insufficient_evidence" | "escalate";

export type ReviewActionType =
  | "approve" | "modify" | "reject" | "request_info" | "escalate";

export type RuleOutcome =
  | "satisfied" | "not_satisfied" | "insufficient_evidence" | "not_applicable";

export interface CaseListItem {
  id: string;
  applicant_name: string;
  status: CaseStatus;
  has_recommendation: boolean;
}

export interface Applicant {
  id: string;
  date_of_birth: string;       // ISO date
  legal_name: string;
  legal_status: string;
  country_of_birth: string;
}

export interface ResidencyPeriod {
  country: string;
  start_date: string;
  end_date: string | null;
  verified: boolean;
  evidence_ids: string[];
}

export interface EvidenceItem {
  id: string;
  evidence_type: string;
  description: string;
  provided: boolean;
  verified: boolean;
  source_reference: string;
}

export interface CaseBundle {
  id: string;
  created_at: string;
  status: CaseStatus;
  jurisdiction_id: string;
  applicant: Applicant;
  residency_periods: ResidencyPeriod[];
  evidence_items: EvidenceItem[];
}

export interface RuleEvaluation {
  rule_id: string;
  rule_description: string;
  citation: string;
  outcome: RuleOutcome;
  detail: string;
  evidence_used: string[];
}

export interface Recommendation {
  id: string;
  case_id: string;
  timestamp: string;
  outcome: DecisionOutcome;
  confidence: number;          // 0..1
  rule_evaluations: RuleEvaluation[];
  explanation: string;
  pension_type: string;        // "full" | "partial" | ""
  partial_ratio: string | null;
  missing_evidence: string[];
  flags: string[];
}

export interface HumanReviewAction {
  id: string;
  case_id: string;
  recommendation_id: string;
  reviewer: string;
  action: ReviewActionType;
  rationale: string;
  timestamp: string;
  final_outcome: DecisionOutcome | null;
}

export interface CaseDetail {
  case: CaseBundle;
  recommendation: Recommendation | null;
  reviews: HumanReviewAction[];
}

export interface AuditPackage {
  case_id: string;
  generated_at: string;
  jurisdiction: { id: string; name: string; country: string; level: string } | null;
  authority_chain: Array<{
    id: string; layer: string; title: string; citation: string;
    effective_date: string | null; url: string;
  }>;
  applicant_summary: Record<string, unknown>;
  recommendation: Recommendation | null;
  review_actions: HumanReviewAction[];
  audit_trail: Array<{
    timestamp: string; event_type: string; actor: string;
    detail: string; data: Record<string, unknown>;
  }>;
  rules_applied: RuleEvaluation[];
  evidence_summary: Array<Record<string, unknown>>;
}
```

```ts
// src/lib/api.ts additions
export async function listCases(): Promise<{ cases: CaseListItem[] }> {
  return fetcher<{ cases: CaseListItem[] }>("/api/cases");
}

export async function getCase(caseId: string): Promise<CaseDetail> {
  return fetcher<CaseDetail>(`/api/cases/${encodeURIComponent(caseId)}`);
}

export async function evaluateCase(caseId: string): Promise<{ recommendation: Recommendation }> {
  return fetcher(`/api/cases/${encodeURIComponent(caseId)}/evaluate`, { method: "POST" });
}

export interface ReviewRequestBody {
  action: ReviewActionType;
  rationale: string;
  final_outcome: DecisionOutcome | null;
}

export async function reviewCase(
  caseId: string,
  body: ReviewRequestBody,
): Promise<{ review: HumanReviewAction }> {
  return fetcher(`/api/cases/${encodeURIComponent(caseId)}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getCaseAudit(caseId: string): Promise<AuditPackage> {
  return fetcher<AuditPackage>(`/api/cases/${encodeURIComponent(caseId)}/audit`);
}
```

Tokens used: `--surface`, `--surface-raised`, `--surface-sunken` (audit drawer), `--agentic` (recommendation pane ribbon), `--authority` (review pane ribbon, submit button), `--verdict-enacted`/`--verdict-pending`/`--verdict-rejected`/`--verdict-draft` (status & outcome pills), `--font-mono` (case id, citations, evidence_ids), `--font-serif` (rule descriptions, applicant name).

ConfidenceRing: SVG donut chart, stroke `--agentic` for the filled arc, `--border` for the rest. 96px diameter, 12px stroke. Centered numeric `{confidence * 100, number, ::percent}` in mono.

## Reference implementation

```tsx
// src/components/govops/cases/ConfidenceRing.tsx
import { useIntl } from "react-intl";

export function ConfidenceRing({ value }: { value: number }) {
  const intl = useIntl();
  const pct = Math.max(0, Math.min(1, value));
  const r = 42, c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div
      role="img"
      aria-label={intl.formatMessage(
        { id: "cases.confidence.aria" },
        { pct: Math.round(pct * 100) },
      )}
      className="relative h-24 w-24"
    >
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke="var(--agentic)" strokeWidth="12"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatNumber(pct, { style: "percent", maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}
```

```tsx
// src/components/govops/cases/ReviewActionForm.tsx
// Self-contained form using react-hook-form + zod (already a dep).
// Submit calls reviewCase(); on success, parent refetches the case detail.
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: capable_but_inactive   # no RTL locales currently — see project memory
copy_keys:
  - cases.list.heading
  - cases.list.empty.title
  - cases.list.empty.body
  - cases.list.column.applicant
  - cases.list.column.status
  - cases.list.column.evaluated
  - cases.list.filter.status
  - cases.list.filter.jurisdiction
  - cases.detail.heading                    # ICU: "Case {id}"
  - cases.applicant.heading
  - cases.applicant.dob
  - cases.applicant.legal_status
  - cases.applicant.country_of_birth
  - cases.residency.heading
  - cases.residency.ongoing                  # "Ongoing"
  - cases.residency.verified
  - cases.residency.unverified
  - cases.evidence.heading
  - cases.evidence.column.type
  - cases.evidence.column.description
  - cases.evidence.column.provided
  - cases.evidence.column.verified
  - cases.evidence.empty
  - cases.recommendation.heading
  - cases.recommendation.empty.title
  - cases.recommendation.empty.body
  - cases.recommendation.evaluate
  - cases.recommendation.evaluating
  - cases.recommendation.outcome
  - cases.recommendation.confidence
  - cases.recommendation.explanation
  - cases.recommendation.rules_applied
  - cases.recommendation.pension_type.full
  - cases.recommendation.pension_type.partial
  - cases.recommendation.partial_ratio
  - cases.recommendation.missing_evidence
  - cases.recommendation.flags
  - cases.confidence.aria                    # ICU: "Confidence {pct, number}%"
  - cases.review.heading
  - cases.review.empty
  - cases.review.action.label
  - cases.review.action.approve
  - cases.review.action.modify
  - cases.review.action.reject
  - cases.review.action.request_info
  - cases.review.action.escalate
  - cases.review.rationale.label
  - cases.review.rationale.placeholder
  - cases.review.final_outcome.label
  - cases.review.submit
  - cases.review.submitting
  - cases.review.success
  - cases.audit.open
  - cases.audit.heading
  - cases.audit.tab.trail
  - cases.audit.tab.recommendation
  - cases.audit.tab.reviews
  - cases.audit.tab.evidence
  - cases.audit.tab.authority
  - cases.audit.export_json
  - status.intake
  - status.evaluating
  - status.recommendation_ready
  - status.under_review
  - status.decided
  - status.escalated
  - outcome.eligible
  - outcome.ineligible
  - outcome.insufficient_evidence
  - outcome.escalate
  - rule_outcome.satisfied
  - rule_outcome.not_satisfied
  - rule_outcome.insufficient_evidence
  - rule_outcome.not_applicable
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - List: Tab through filter chips, then rows; Enter opens detail
  - Detail: Tab through panes in source order; Esc on audit drawer closes it
  - Review form: Tab through action select → rationale → (final_outcome if visible) → submit
  - Audit drawer: focus trapped while open; Esc closes; restore focus to trigger
aria_live: polite
  - "Evaluation complete" after evaluate action
  - "Review recorded" after review submission
  - Audit drawer announces tab name on switch
reduced_motion: respect
landmarks:
  - <main> for the page
  - Each pane is <section aria-labelledby="...">
  - Audit drawer is a <dialog>-style sheet with role="dialog"
print:
  - Audit drawer has @media print: expanded inline (no overlay), interactive controls hidden
```

provenance: hybrid
  # Cases surface mixes agent-generated recommendations and human reviews.
  # Each pane carries its own ribbon (agent vs human) per acceptance criteria.

## Out of scope

- Creating new cases via UI (current backend doesn't expose a public POST /api/cases route — out of v2.0 scope)
- Editing applicant or evidence data
- Bulk evaluate / bulk review
- Real-time websocket updates (poll on demand only)
- Notification of citizens about decisions (Phase 10C)
- Calculation of benefit amounts (Phase 10B)
- Life-event reassessment (Phase 10D)
