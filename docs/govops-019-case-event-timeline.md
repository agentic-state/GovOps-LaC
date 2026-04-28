# GovOps Spec — Case event timeline + new-event form
<!-- type: component+route, priority: p1, depends_on: [govops-009, govops-017] -->
type: component+route
priority: p1
depends_on: [govops-009, govops-017]
spec_id: govops-019

## Intent

Phase 10D (ADR-013) introduces life-event reassessment: a citizen's
circumstances change after their case was last evaluated, the change is
captured as a typed `CaseEvent` with an `effective_date`, and the engine
re-runs against the case as it stands after applying every event in
chronological order. The new recommendation links back to the prior via
`supersedes`, so the case becomes a *record over time* rather than a
snapshot.

Today the case-detail surface (`/cases/$caseId`) renders a single
recommendation. After 10D, the same surface needs to show:

1. The **event timeline** — every `CaseEvent` in chronological order, with
   type badge, effective date, payload summary, and the recommendation it
   triggered (if any).
2. The **supersession chain** of recommendations — visible side-by-side or
   as a stack, so a reviewer sees what changed at each step and why.
3. A **new-event form** — caseworker-driven (admin-gated) UI for adding
   `move_country`, `change_legal_status`, `add_evidence`, or `re_evaluate`
   events.

This spec adds two components and threads them into the existing case-
detail route.

## Backend contract (already shipped)

### `POST /api/cases/{case_id}/events?reevaluate={bool}`

Request body:
```ts
type CaseEventRequest = {
  event_type: "move_country" | "change_legal_status" | "add_evidence" | "re_evaluate";
  effective_date: string;       // ISO date
  payload: Record<string, unknown>;  // shape per event_type, see below
  actor?: string;                // default "citizen"
  note?: string;
};
```

Response (when `reevaluate=true`, default):
```ts
type PostEventResponse = {
  event: CaseEvent;
  recommendation: Recommendation;  // new, with .supersedes pointing at prior
};
```

Response (when `reevaluate=false`):
```ts
type PostEventResponse = { event: CaseEvent };  // no recommendation
```

#### Per-event-type payload shapes

| event_type | required payload fields | optional |
| --- | --- | --- |
| `move_country` | `to_country` (ISO code) | `from_country`, `open_new` (bool, default true) |
| `change_legal_status` | `to_status` ("citizen" / "permanent_resident" / "other") | — |
| `add_evidence` | `evidence_type` | `description`, `verified`, `source_reference` |
| `re_evaluate` | (none) | — |

A bad payload returns `400` with the missing-field reason in `detail`.

### `GET /api/cases/{case_id}/events`

Returns the full event log + recommendation history:
```ts
type GetEventsResponse = {
  events: CaseEvent[];                      // chronological, by recorded_at
  recommendations: Recommendation[];         // chronological, oldest first
};
```

## Acceptance criteria

### `<EventTimeline>` component (new)

Path: `src/components/govops/cases/EventTimeline.tsx`

Props:
```ts
type EventTimelineProps = {
  events: CaseEvent[];
  recommendations: Recommendation[];
  caseId: string;
};
```

#### Rendering

- [ ] One row per event in chronological order (`effective_date` ascending,
      tiebreak by `recorded_at`).
- [ ] Each row shows:
  - **Date column**: formatted `effective_date` (use `Intl.DateTimeFormat`
    for the active locale).
  - **Type badge**: shadcn `Badge` with i18n label
    `events.type.{event_type}` (e.g. `events.type.move_country` →
    EN `Move country`, FR `Changement de pays`).
  - **Payload summary**: one-line human-readable description built from
    the payload (e.g. for `move_country`: `CA → BR` from
    `from_country` and `to_country`). i18n via parameterized keys —
    see "i18n keys" below.
  - **Triggered recommendation chip** (if `triggered_by_event_id` matches
    on any recommendation): a compact shadcn `Badge` showing the
    outcome (`eligible` / `ineligible` / etc.) with the same color
    convention as the existing recommendation panel.
- [ ] Rows are connected by a vertical line (Tailwind:
      `border-l-2 border-muted` on a left margin) so the timeline reads
      as a single sequence rather than a flat list.
- [ ] Empty state: when `events.length === 0`, render a small subdued
      caption from i18n key `events.timeline.empty`.

### Supersession chain rendering

- [ ] Recommendations are presented as a **stack** in the existing
      recommendation panel: the latest is fully expanded; prior ones are
      collapsed `<Collapsible>` sections labeled
      `Previous decision (effective {date})` with i18n key
      `events.history.previous_decision`.
- [ ] Each prior decision renders the same `BenefitAmountCard`
      (govops-017), rule-evaluation list, and a small chip linking to
      the event that triggered it (`triggered_by_event_id`) — clicking
      the chip scrolls to that event in the timeline (smooth scroll,
      respects `prefers-reduced-motion`).

**Shipped (PLAN §12 10D.x.3)**: the supersession-chain affordance landed
as a dedicated named component
`src/components/govops/cases/PreviousDecisions.tsx` rather than being
inlined in `cases.$caseId.tsx`. This is beyond the spec's "render the
chip on each event" wording and was accepted on merit — the
collapsible stack is the shape officers need for an audit-of-record
view, and a named component keeps the case-detail route readable. The
chip-back-to-event interaction works as specified above.

### `<NewEventForm>` component (new, admin-gated)

Path: `src/components/govops/cases/NewEventForm.tsx`

Props:
```ts
type NewEventFormProps = {
  caseId: string;
  onCreated: (response: PostEventResponse) => void;
};
```

#### Behaviour

- [ ] The form renders inside a shadcn `Dialog` triggered by a
      "Record event" button below the event timeline.
- [ ] Field set varies by `event_type`:
  - **All types**: `event_type` (radio or `Select`), `effective_date`
    (date input), optional `note` (textarea).
  - **`move_country`**: `to_country` (text or `Select` of known ISO
    codes), `from_country` (optional text/Select), `open_new` (checkbox,
    default checked).
  - **`change_legal_status`**: `to_status` (`Select`: citizen /
    permanent_resident / other).
  - **`add_evidence`**: `evidence_type` (text), `description` (optional
    text), `verified` (checkbox).
  - **`re_evaluate`**: no extra fields.
- [ ] Form uses `react-hook-form` + `zod` schema validation per
      event_type (matches the existing approval-form pattern).
- [ ] Submit posts to `POST /api/cases/{caseId}/events`. On success,
      calls `onCreated` and closes the dialog.
- [ ] On `400` / `5xx`: surface error in a toast; keep dialog open with
      the same field values.

### Consumption — `/cases/$caseId`

- [ ] In `src/routes/cases.$caseId.tsx`, after the existing
      recommendation panel, render `<EventTimeline>` with the response
      data from a new `GET /api/cases/{caseId}/events` fetch.
- [ ] Below the timeline, render a "Record event" button that opens
      `<NewEventForm>`. On `onCreated`, refetch the events query so the
      new event + (optional) new recommendation appear immediately.
- [ ] Loading state: existing skeleton component.
- [ ] If the fetch returns no events but the case is evaluated, the
      timeline section is still rendered (empty-state caption inside it).

### i18n keys (all 6 locales)

Add to `src/messages/{lang}.json`:

| key | EN value | FR value |
| --- | --- | --- |
| `events.heading` | `Event timeline` | `Chronologie des événements` |
| `events.timeline.empty` | `No life events recorded for this case yet.` | `Aucun événement enregistré pour ce dossier.` |
| `events.type.move_country` | `Move country` | `Changement de pays` |
| `events.type.change_legal_status` | `Legal status change` | `Changement de statut légal` |
| `events.type.add_evidence` | `New evidence` | `Nouvelle preuve` |
| `events.type.re_evaluate` | `Re-evaluation` | `Réévaluation` |
| `events.summary.move_country` | `{from} → {to}` | `{from} → {to}` |
| `events.summary.change_legal_status` | `to {to_status}` | `vers {to_status}` |
| `events.summary.add_evidence` | `+ {evidence_type}` | `+ {evidence_type}` |
| `events.summary.re_evaluate` | `Reassessment requested` | `Réévaluation demandée` |
| `events.history.previous_decision` | `Previous decision (effective {date})` | `Décision précédente (en vigueur {date})` |
| `events.form.record_button` | `Record event` | `Enregistrer un événement` |
| `events.form.submit` | `Save event` | `Enregistrer l'événement` |
| `events.form.cancel` | `Cancel` | `Annuler` |
| `events.form.heading` | `Record a life event` | `Enregistrer un événement de vie` |

For pt-BR, es-MX, de, uk: machine-translate and flag.

### Out of scope

- Don't implement edit/delete on existing events. Per ADR-013 events are
  append-only; corrections are new `re_evaluate` events with
  `supersedes_event_id` in the payload.
- Don't implement a "schedule future event" UI. Future-dated events are
  supported by the backend (the timeline renders them) but a dedicated
  scheduling surface is out of scope.
- Don't implement event search/filter. Linear timeline only for v1.
- Don't implement cross-jurisdiction handoff visualization (a CA→BR move
  triggering a BR jurisdiction evaluation is a Phase 11 concern; this
  spec only renders the move event itself).

### Verification

- [ ] Demo case `demo-case-001` → POST a `re_evaluate` event → timeline
      shows the event and the new recommendation appears in the
      supersession chain.
- [ ] POST a `move_country` event with payload
      `{to_country: "BR", from_country: "CA"}` → timeline summary shows
      `CA → BR`.
- [ ] Bad payload (`{}` for move_country) → toast shows `to_country
      required` (or equivalent localized message); dialog stays open.
- [ ] FR locale: timeline labels and form labels render in French; date
      formatting uses `fr-CA` `Intl.DateTimeFormat`.
- [ ] `npm run check:i18n` passes.
- [ ] `npm run lint` clean.
- [ ] Existing Playwright suite passes; smoke spec gains an assertion
      that `/cases/demo-case-001` shows an event timeline section.
