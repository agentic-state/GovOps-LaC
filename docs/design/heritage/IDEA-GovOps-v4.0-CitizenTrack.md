# GovOps v4.0 -- Citizen Track

**Status**: Charter, draft 2026-05-12. Not yet planned.
**Predecessor**: v3.1.x editor set on `main`; v3.2 (substrate hardening) chartered in parallel.
**One-sentence pitch**: *A citizen tells GovOps a life-event happened; GovOps tells the citizen which programs they now qualify for, which they're about to lose, and -- if they crossed a border -- what the treaty says.*

> This document is the strategic vision for v4. It does not constrain implementation. If v4 ships, execution will be tracked in the per-release CHANGELOG entries and in ADRs landed under each phase. As of the heritage move (see [`heritage/README.md`](README.md)) this charter is parked, not on the active track.

---

## Disclaimer

GovOps is an independent open-source prototype. It is **not affiliated with, endorsed by, or representing any government, department, or public agency**. Legislative text is publicly available law interpreted by the author for illustrative purposes -- not authoritative operational guidance. The treaty interpretations in this charter are public-law readings, not authoritative legal advice.

## Why v4 exists

v2 (Law-as-Code, v0.4.0) proved a deterministic engine.
v3 (Program-as-Primitive, v3.1.x) proved that adding a program is as cheap as adding a jurisdiction, and that adoption itself is in-app -- no Python edits, no PRs.

Both v2 and v3 are **officer-and-leader facing**. The `/check` surface introduced in v3 is the only place a citizen touches the system; it answers exactly one question -- "am I eligible for this program right now?" -- and stops.

What v3 did **not** prove:

- That GovOps can carry **continuity across time** for a citizen (state changes, threshold transitions, expiry, follow-up obligations)
- That GovOps can carry **continuity across jurisdictions** when a citizen moves (contribution aggregation, pension portability, residence-requirement pro-rating)
- That GovOps can model **within-jurisdiction program interactions** that aren't already covered by the v3 cross-program warning primitive (clawbacks, transitions, dependencies)

v4 is the citizen-side richer floor: GovOps holds (opt-in) citizen state, recognises life-events, surfaces notifications when status changes, and resolves cross-jurisdiction questions through a new treaty framework. The CA-FR Social Security Agreement (1981) is the canonical proof pair; remaining treaty pairs ship as a v5 rollout, mirroring the v2-to-v3 EI rollout pattern.

## The bet: continuity-aware citizen experience

v3 made *program* a first-class declarable thing. v4 makes *life-event* a first-class declarable thing -- and adds the substrate to project life-events onto every program the citizen touches.

Today the citizen flow is stateless: open `/check`, answer questions, see verdict, leave. In v4:

- A citizen **opts into** a server-side account (email OTP at the demo bar; federated identity is a v5 axis)
- A citizen tells GovOps when a life-event happens (or GovOps infers it from a date threshold)
- Every eligible program re-evaluates against the new state; the inbox notifies the citizen of deltas
- If the life-event is a cross-jurisdiction move, the **treaty framework** resolves what the agreement says about contribution aggregation, pension portability, and residence pro-rating

This is the **"citizen as a first-class actor"** thesis: the same governance primitives that produce a verdict for an officer produce a notification, a transition, a clawback, or a treaty calculation for a citizen -- without privileging any audience over another.

## The proof: CA-FR treaty pair, change-of-jurisdiction life-event

The canonical v4 demonstration is a single life-event traced through one treaty pair:

> A citizen who contributed to CPP for 20 years moves from Canada to France at age 60. At age 65 in France, what pension can they expect, from whom, and on what authority?

The CA-FR Social Security Agreement of 1981 says:

- Contribution periods in either country count toward eligibility in the other (aggregation)
- Each country pays a pro-rated share based on the contribution years credited to it
- Residence requirements are waived for the partner country's nationals under specific conditions

Walking this scenario end-to-end requires:

| Capability | Where it lives |
| --- | --- |
| The citizen's CPP contribution history | Authored as `citizen_facts` against the account |
| The change-of-jurisdiction life-event | New `LifeEvent.CHANGE_OF_JURISDICTION` type |
| The treaty itself as code | New `cross_jurisdiction_treaties.py` -- the CA-FR Agreement encoded as rules |
| The pension recalculation | Existing v3 ProgramEngine, with treaty pre-processing of contribution years |
| The citation chain | Existing v2 authority chain, extended to surface treaty articles alongside domestic statute |
| The notification | New v4 inbox + email primitives |

If this single walk works end-to-end -- citizen logs in, declares the move, sees a notification explaining their CA + FR pension projection with full citation chain back to the Agreement -- the architecture is proven. The remaining four treaty pairs (CA-DE, CA-BR, CA-UA, CA-ES) are content authoring, not architecture, and ship in v5.

### Why CA-FR specifically

- Both jurisdictions are already in the v3 program registry
- The 1981 Agreement is public (CRA + URSSAF both publish English/French texts)
- Pension portability is the canonical bilateral treaty primitive across most agreements -- if it works for CA-FR, it works structurally for the other four
- Two official languages (en + fr) align with v3's locale coverage

## New primitives v4 forces

### Life-events (extends v3's `job_loss`)

| Event | Trigger shape | Why it's interesting |
| --- | --- | --- |
| `BIRTH_OF_CHILD` | State-based (citizen-declared) | Activates child benefit eligibility; per-jurisdiction asymmetric content (CCB in CA, allocations familiales in FR) |
| `RETIREMENT_AGE_REACHED` | Time-based (clock advances past 65th birthday) | Triggers OAS transition; lapses EI in jurisdictions where it does (CA does; not all do) |
| `DISABILITY_ONSET` | State-based (citizen-declared) | Activates disability programs; intersects with EI (sickness benefits) and OAS (CPP-D in CA) |
| `CHANGE_OF_JURISDICTION` | State-based (citizen-declared) | The treaty-framework gateway -- the only event that activates cross-jurisdiction calculations |

Life-events are typed events with per-jurisdiction evaluators. The evaluator returns: (a) which programs newly apply, (b) which programs lapse, (c) which transitions are pending, (d) what notifications to fire.

### `PROGRAM_INTERACTION` rule type (new in v4, expands v3's interaction warning)

Today v3 has exactly one cross-program interaction (OAS + EI overlap, info severity). v4 introduces a typed `RuleType.PROGRAM_INTERACTION` that handles:

- **Clawbacks** -- GIS (CA Guaranteed Income Supplement) reduces as OAS-recipient income crosses thresholds
- **Transitions** -- EI lapses at 65 in CA when OAS activates
- **Dependencies** -- CCB requires a current tax filing on record

The interaction rule is per-jurisdiction asymmetric (BR has different clawback shapes than CA), authored through the v3.1.x editor set, evaluated by the existing ProgramEngine.

### Treaty framework

A new module `cross_jurisdiction_treaties.py` modelling bilateral agreements as code:

- A **treaty** is a typed contract between two jurisdictions
- A treaty carries **articles** (similar shape to `legal_documents[].sections[]` in v3)
- A treaty defines **pre-evaluators** that transform inputs (e.g. add FR contribution years to a CPP calculation when computing CA pension eligibility)
- A treaty defines **post-evaluators** that transform outputs (e.g. pro-rate the CA pension by the ratio of CA-credited years to total credited years)
- Treaty authoring uses the v3.1.x substrate (draft -> approve -> commit) once v4 lands

The model is intentionally minimal at v4: only contribution aggregation + pro-ration + residence waiver. Richer treaty primitives (totalisation across more than two countries, multi-leg moves, dual citizenship) are deferred.

### Notification primitive

In-app inbox (per account) + email out. No SMS, no push. Two trigger shapes:

- **Time-based** -- the clock advances past a threshold (turn 65, work-permit expiry approaching, GIS quarterly review)
- **State-based** -- a citizen-fact changes (new evidence uploaded, life-event declared, treaty calculation updated)

Notifications carry the same citation chain v3 verdicts already carry, localized per the citizen's preferred locale. The notification template is itself authored through the substrate (a new draft type, `notification_template`).

### Identity (Posture B)

Server-side opt-in account. Email + OTP at the demo bar. No password, no MFA, no session hardening beyond a signed cookie. The bar matches v3's "MVP demo, not production at scale" -- the production answer is a single ADR swap to Posture C (federated GC-Key / FranceConnect / etc.), explicitly v5 axis.

Per the locked intent: "B is honest demo-grade -- 'production answer is a one-line ADR swap.'"

## Audiences and surfaces

| Audience | v3.1.x today | v4 delta |
| --- | --- | --- |
| Citizen | Stateless `/check` and `/check/life-event?event=job_loss` | Account at `/me`; inbox at `/me/inbox`; life-event declarations at `/me/events`; treaty projections surfaced under `/me/programs/<id>?across=fr` |
| Officer | `/cases/<id>` unchanged | Operator can attach a life-event to a case; treaty calculation visible in the audit package |
| Program leader | `/compare/<program-id>` unchanged | Treaty-aware comparison: "EI in CA vs FR vs CA-FR (totalised)" surfaces in compare view |
| Authoring operator | v3.1.x editor set | Adds treaty editor (`/admin/drafts/$id/treaty`) + notification-template editor (`/admin/drafts/$id/notification`) |
| Developer / contributor | OpenAPI + journey docs | OpenAPI extends; treaty + life-event + inbox endpoints documented |

## What's IN v4-medium scope (per locked intent)

- Email-OTP identity + opt-in account + audit trail for citizen-side state
- Notification primitive: inbox + email; time-based + state-based triggers; localized templates with citation chain preserved
- Life-event library: `birth-of-child`, `retirement-age-reached`, `disability-onset`, `change-of-jurisdiction` (4 new; `job_loss` already shipped in v3)
- Within-jurisdiction cross-program interactions: GIS clawback (CA), EI -> OAS transition (CA), 1-2 equivalents in other jurisdictions where they exist
- Treaty framework module (`cross_jurisdiction_treaties.py`)
- CA-FR treaty pair fleshed out: pension portability + contribution-period aggregation + residence-requirement pro-rating
- Citizen surfaces: `/me`, `/me/events`, `/me/inbox`, treaty-aware `/me/programs/<id>`

## What's OUT of v4-medium scope (v5 or later)

- Production-grade auth (no MFA, no session-management hardening)
- SMS / push notifications
- Federated gov identity (Posture C: GC-Key / FranceConnect / etc.) -- v5 axis
- Cross-jurisdiction account portability (a CA account stays a CA account)
- Other treaty pairs (CA-DE, CA-BR, CA-UA, CA-ES) -- v5 rollout, mirrors v2-to-v3 EI rollout pattern
- Full retention / GDPR-grade compliance -- demo-grade "delete my account" only
- Sub-national jurisdictions (provinces / Laender / regions)
- Adjacent domains (licensing, tax, civil registry, healthcare entitlement)
- Multi-leg moves (citizen who lived in CA, then DE, then FR)
- Dual citizenship as treaty input
- **Angle A** (unified provenance for governed affordances -- a forward-looking concept exploring whether every UI affordance can declare its substrate-bound policy provenance) -- explicitly deferred to v5; can be either v4's substrate retro or v5's architectural axis, decided at v5 charter time

## Phase decomposition (provisional, ~10-12 phases)

v3 ran in 9 phases (A through I). v4-medium provisional shape:

| Phase | Scope | Why first / why later |
| --- | --- | --- |
| A | Identity + account substrate (email-OTP, signed cookie, audit trail) | Gates every other phase; nothing else can build until accounts exist |
| B | Citizen-facts substrate (per-account state, draft against existing ConfigStore pattern) | Required for life-event evaluators to have something to evaluate |
| C | Life-event registry + 4 new event types (declared, no notifications yet) | Builds the typed events; defers wiring to notifications |
| D | Notification primitive (inbox + email + templates) | The output side of life-events |
| E | Wire phases C + D together (state-based triggers) | First end-to-end loop |
| F | Time-based triggers (clock advances past threshold) | The other half of trigger surface |
| G | `PROGRAM_INTERACTION` rule type + GIS clawback (CA) + EI->OAS transition (CA) | Within-jurisdiction interactions, no treaty yet |
| H | Treaty framework module + treaty editor (substrate authoring extends to treaties) | Architecture of cross-jurisdiction; no specific treaty yet |
| I | CA-FR treaty pair fleshed out (Articles encoded, pre/post-evaluators implemented) | The proof |
| J | Citizen surfaces (`/me`, `/me/events`, `/me/inbox`, treaty-aware `/me/programs/<id>`) | UI layer last; depends on every backend phase |
| K | Operator surface delta (case-attached life-events, treaty visibility in compare) | Bring officer + leader audiences along |
| L | Adoption walkthrough + E2E spec (mirrors v3 L14) | Closes the release |

Decision gates land at A-end (identity model approved), C-end (life-event taxonomy locked), H-end (treaty contract approved), I-end (CA-FR proof passes acceptance), L-end (release-ready). Detailed gates locked at charter approval time.

## Estimate

v4-medium is sized larger than v3.1 + v3.1.x combined but smaller than v3.0 (which delivered EI + 6 jurisdictions + the entire cross-program comparison surface). The treaty framework is the architectural risk; identity + life-events + notifications are well-trodden patterns.

Bundled-release pattern as v3 ran: one tag, ~12-15 PRs across the 12 phases, ~3-5 weeks of focused work depending on bandwidth.

ADRs to pre-claim at charter approval (current main is at ADR-022; v3.2 charter pre-claims ADR-023 through ADR-026):

- ADR-027: citizen account model (Posture B, email-OTP, signed cookie)
- ADR-028: citizen facts substrate (per-account ConfigValue-shape store)
- ADR-029: life-event taxonomy + evaluator contract
- ADR-030: notification primitive (inbox + email, triggers, templates)
- ADR-031: PROGRAM_INTERACTION rule type
- ADR-032: treaty framework + bilateral contract
- ADR-033: CA-FR Social Security Agreement encoding (the canonical example, like v3's ADR-014 for OAS)

## Verification

End-to-end checks before declaring v4 done:

| Check | How | Pass criteria |
| --- | --- | --- |
| Identity loop | Browser: opt in, receive OTP email, complete login, sign out, sign back in | Account persists; signed cookie validates; audit trail records both sessions |
| Life-event registration | Browser: declare `birth-of-child` for a logged-in citizen | New event in `/me/events`; child-benefit notification appears in `/me/inbox` |
| Time-based trigger | Test harness: advance clock past 65th birthday for a CA citizen | OAS-transition notification fires; EI eligibility (if applicable) lapses |
| Within-jurisdiction interaction | Browser: simulate income above GIS threshold for an OAS-receiving citizen | GIS clawback notification fires with citation chain to OAS Act ss. 10-13 |
| Treaty proof | Browser: CPP-contributor moves CA -> FR, ages to 65 in FR, checks pension projection at `/me/programs/oas?across=fr` | Both CA pro-rated share and FR pro-rated share visible; citation chain shows 1981 Agreement Articles + domestic statute |
| Adoption E2E (v4 equivalent of v3.1.0 L14) | `cd web && npm run test:e2e -- v4-adoption.spec.ts` | Cross-browser pass: full citizen walk from signup through treaty calculation |
| Officer audit package | Open the treaty-affected case in `/cases/<id>` | Treaty calculation + citation chain present in the audit JSON |
| Full suite | `pytest -q` + `cd web && npm run test && npm run test:e2e` | All green; backend test count grows for identity + life-events + notifications + treaty modules |
| HF deploy | Push to `hf` remote | New v4 surfaces visible at `agentic-state-govops-lac.hf.space` |

## Sequencing relative to v3.2

v3.2 (substrate hardening) and v4 (citizen track) are independent. v3.2's substrate hardening is *good for* v4 -- the treaty editor and notification-template editor benefit from v3.2's conflict refusal, RBAC, and round-trip YAML emission -- but v4 does not strictly require it.

Recommended order: ship v3.2 first because (a) it's smaller, (b) it closes the v3.1.x carryover, and (c) it gives v4 a substrate that's already safe-for-two. If bandwidth forces a choice, v4 can proceed against v3.1.x's substrate and inherit v3.2's improvements on the next release.

## Post-merge follow-ups

- Bundle a v4 release record (CHANGELOG entry + release tag).
- Mark the prior v4 charter intent as superseded by this charter doc.
- Close v4-medium scope items; v5 candidates (Posture C identity, remaining treaty pairs, Angle A unified provenance, multi-leg moves) move to the v5 backlog.
- Capture the treaty-contract design (pre-evaluator / post-evaluator shape, contract evolution rules) as an ADR.
