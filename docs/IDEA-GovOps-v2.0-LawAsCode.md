# GovOps v2.0 - Law as Code Implementation Plan

## From Eligibility Engine to Live Configurable Decision Substrate

**Status:** Proposed
**Supersedes:** Architectural direction set in v1.0-CDD and v1.0-MVP
**Scope:** All six current jurisdictions (CA, BR, ES, FR, DE, UA) treated as equal peers

## Executive Summary

GovOps v1.0 proved one bounded thesis: legislation can be formalized into deterministic, traceable, auditable decision support across multiple jurisdictions. Six countries, six languages, 65 passing tests, full authority traceability.

GovOps v2.0 takes the thesis further. Inspired by the SPRIND "Law as Code" initiative, this plan turns GovOps from an eligibility engine into a working reference implementation of Law as Code: every parameter, threshold, status code, evidence type, message, and reasoning prompt becomes a dated, versioned, configurable artefact. Nothing is hardcoded. Behaviour changes are configuration writes, not deploys. Every decision is reproducible against the exact substrate in effect on the date it was made.

The plan also extends the pipeline beyond eligibility into self-screening, entitlement calculation, decision notification, and life-event reassessment. The visible surface is rebuilt as a modern web UI. The result is a complete Law-as-Code reference implementation other governments can fork.

This is a separate product path: an open public good for the global public sector, license-compatible with v1.0 (Apache 2.0).

## Strategic Position

### What changed externally

The SPRIND "Law as Code" initiative articulates five foundational elements for a digital legal infrastructure:

1. A definition of legal code (a binding schema for executable norms)
2. Open-source legal coding editors
3. AI-powered legal coding processes
4. A central repository of the official legal code
5. Training and capacity building

GovOps v1.0 already implements partial versions of all five elements: a Pydantic rule schema, a web-based encoding pipeline, an AI-assisted extraction backend, an open-source repository, and ecosystem documentation. v2.0 closes the gaps and adds a sixth dimension SPRIND does not yet articulate: **the interpretive apparatus is also versioned configuration**.

### The v2.0 thesis

> The Siebel List of Values pattern, applied universally and extended to include reasoning prompts.

In Siebel, every status code, dropdown value, and message lives in a configuration table with effective dates. Change the value, write a new record, the new effective date applies, no deploy.

In GovOps v2.0, every parameter is governed by the same pattern. Threshold ages, accepted statuses, evidence types, country code lists, UI labels, audit event types, and the LLM extraction prompt itself all become entries in a universal configuration store. The runtime resolves "what is the value of X on date Y for jurisdiction Z?" instead of reading constants. This is true Law as Code: not just the rules, but the entire decision substrate.

### Boundaries v1.0 set, v2.0 preserves

- Decision support, not autonomous adjudication
- Human-in-the-loop at every critical point
- Evidence-first operation
- Full traceability from decision to authority
- Explicit handling of missing or contradictory information
- Audit-ready outputs by design
- Apache 2.0 open public-good posture

v2.0 strengthens these properties; it does not relax any of them.

## Architectural Foundation: The Effective-Value Substrate

### Concept

Every value the system uses, except behaviour-defining code itself, lives as a `ConfigValue` record. The store is queried by `(domain, key, evaluation_date, jurisdiction_id)` and returns the value in effect for that key on that date. Old values are never deleted; they are superseded with a new effective period.

### Data model

```text
ConfigValue
  id              uuid
  domain          enum   "rule.parameter" | "enum.legal_status"
                         | "prompt.extraction" | "ui.label"
                         | "engine.threshold" | "calculation.formula"
                         | "notice.template" | other
  key             string hierarchical, e.g. "ca-oas.rule.age-65.min_age"
  jurisdiction_id string nullable; null = applies globally
  value           any    scalar, list, dict, prompt text, or formula
  value_type      enum   "scalar" | "list" | "object" | "prompt"
                         | "rule_expression" | "template"
  effective_from  date
  effective_to    date   nullable; null = current
  citation        string statutory or design-doc authority for this value
  author          string who configured it
  approved_by     string nullable; null = unapproved draft
  rationale       string why this value, or why it changed
  supersedes      uuid   nullable; back-pointer to previous version
  created_at      timestamp
```

### What is migrated to ConfigValue

Every constant that today lives in Python source becomes a record:

| Today (hardcoded) | Tomorrow (effective-value lookup) |
| ----------------- | --------------------------------- |
| `min_age: 65` in rule `parameters` | `resolve("ca-oas.rule.age-65.min_age", eval_date)` |
| `home_countries: ["CA", "CANADA", "CAN"]` | `resolve("ca-oas.rule.residency.home_countries", eval_date)` |
| `accepted_statuses: ["citizen", "permanent_resident"]` | `resolve("ca-oas.legal_status.accepted", eval_date)` |
| `EXTRACTION_SYSTEM_PROMPT` in `encoder.py` | `resolve("global.prompt.extraction.system", eval_date)` |
| `_TRANSLATIONS` dict in `i18n.py` | `resolve("ui.label.<key>", eval_date, lang=...)` |
| `RuleType` enum members | `resolve("global.enum.rule_type", eval_date)` |
| `DEFAULT_LANGUAGE = "en"` | `resolve("global.config.default_language", eval_date)` |
| Engine outcome dispatch logic | Driven by `resolve("global.engine.outcome_logic", eval_date)` |

### The List-of-Prompts dimension

Some `ConfigValue` records hold prompts. Prompts are how the system reasons. When extraction batch X ran on date D, the audit must be able to show the exact prompt that was in effect on D, even if the prompt has been improved many times since.

| Prompt key | Function | Why effective-valued |
| ---------- | -------- | -------------------- |
| `global.prompt.extraction.system` | Instructs the LLM during rule extraction | Old extractions must remain reproducible |
| `global.prompt.extraction.user_template` | Wraps each batch | Same reasoning |
| `<jur>.prompt.legal_interpretation_hint` | Jurisdiction-specific interpretive guidance | Jurisdictions encode interpretive conventions |
| `global.prompt.officer_explanation` | Plain-language rationale shown to officers | Tone, accessibility, lay-language quality evolve |
| `global.prompt.audit_summary` | Audit package narrative | Auditors and appeals bodies have evolving expectations |
| `<jur>.prompt.evidence_review_guidance` | What to look for when verifying evidence from a given source country | Operational knowledge, not just legal knowledge |

### The "configure without deploy" workflow

1. A legal or policy contributor identifies a parameter change (statute amended, threshold updated, prompt improved).
2. They draft a new `ConfigValue` record in the admin UI: new value, `effective_from` date, citation, rationale.
3. A reviewer approves; the record is committed.
4. On the `effective_from` date at 00:00 UTC, every evaluation calling `resolve()` returns the new value.
5. Cases evaluated before the change continue to produce the old outcome forever, because they resolve against the old effective record.
6. No deployment, no service restart, no code change.

### Audit becomes complete

A v1.0 audit package shows which rules fired. A v2.0 audit package additionally shows:

- The exact parameter values resolved at evaluation time
- The prompt versions used in any LLM-assisted step
- The UI labels presented to the officer
- A reconstructable configuration snapshot for the evaluation moment

A 2030 appeals body can reconstruct the exact decision substrate that produced a 2026 case outcome. This is what audit-ready should mean.

## UI/UX Track: Lovable

### Architectural shift

v1.0 served a Jinja2 HTML UI from FastAPI. v2.0 separates the API from the UI: FastAPI exposes only JSON endpoints; the Lovable application consumes them. The OpenAPI spec becomes the contract between backend and frontend.

```text
Today                          Tomorrow

FastAPI ---- /api/* (JSON)     FastAPI -- /api/* (JSON only)
        \--- /     (HTML)                      ^
                                               |
                                          Lovable app
                                          (deployed separately;
                                           bilingual EN/FR/PT/ES/DE/UK;
                                           WCAG 2.1 AA)
```

### Lovable scope

| Surface | Replaces / adds |
| ------- | --------------- |
| Officer workstation | Replaces `mvp_sample.html`. Three-pane layout (queue, case detail, evidence and authority). Real interactions. |
| Case dashboard | Replaces `index.html`. Filter, sort, multi-jurisdiction switch in header. |
| Case detail | Replaces `case_detail.html`. Rule-by-rule view with PASS/FAIL/NEEDS-EVIDENCE chips and citation links. |
| Authority chain browser | Replaces `authority.html`. Visual hierarchy with click-through to legislative sources. |
| Audit package view | Replaces `audit.html`. Clean, exportable, court-ready. |
| Encoding pipeline | Replaces `encode.html` and `encode_review.html`. Side-by-side statute/rule editor, diff view, approval flow. |
| ConfigValue admin (new) | Configure-without-deploy interface. Search by key, view effective-value timeline, draft new value, scheduled `effective_from`, approval workflow, rationale capture. |
| Prompt admin (new) | Markdown-style editor for prompts, diff view across versions, "test this prompt against fixture X" preview. |
| Public landing | Replaces `docs/index.html` and the screenshot pages. Multi-language switcher. |
| Self-screening wizard (new) | Public-facing, no login, mobile-first. See Pipeline Extension 2A. |
| Calculation breakdown (new) | Per-case entitlement amount with formula trace. See 2B. |
| Notice viewer and template editor (new) | Citizen-facing decision notices and configurable templates. See 2C. |
| Life-event capture (new) | Triggers reassessment. See 2D. |

### Constraints given to Lovable up front

- WCAG 2.1 AA minimum
- Six languages from day one (existing i18n keys as the schema)
- Mobile-responsive
- Server is the source of truth; the UI is a view, never a source of state that contradicts effective-value resolution
- Citations are first-class: any rule, parameter, or decision is one click from its statutory authority
- Loading states for every async call

## Pipeline Extensions

v1.0 covers eligibility determination only. v2.0 extends the pipeline both upstream and downstream so the system supports a full Law-as-Code flow.

### Full pipeline target

```text
[1] Awareness    [2] Intake    [3] Evidence       [4] Eligibility    [5] Calculation
  & screening      & profile    collection         (CURRENT)         & entitlement
                                & verification
       v               v             v                   v                  v
[6] Decision     [7] Notification  [8] Disbursement   [9] Ongoing      [10] Appeals
  issuance         & rationale       setup              compliance &       & review
                                                        life events
```

v2.0 adds four extensions: self-screening (front), calculation (immediately downstream of eligibility), notification (citizen-facing artefact), and life-event reassessment (event-driven re-runs).

### 2A. Self-screening and intake

**Adds:** before any case reaches an officer, a citizen or frontline worker runs the same engine as a self-check. Same rules, same authority chain, same effective-value substrate. No PII, no audit trail. Output: a "what you would need to apply" summary.

**Why:**

- Reduces volume of incomplete applications
- Citizens understand qualification before investing effort
- Same engine answering both questions enforces consistency by construction
- Highest-volume use of the system; the workstation use is the highest-stakes

**Scope:**

- New endpoint `POST /api/screen` accepting a stripped-down case bundle, returning recommendation plus missing-evidence list, no persistence
- New Lovable surface: public-facing wizard, mobile-first, six languages, no login
- Output: a downloadable summary the user takes to a service centre or formal application

### 2B. Entitlement calculation

**Adds:** today the engine returns "full" or "partial (33/40)". v2.0 returns an amount, with full formula trace and citation per step.

**Why:**

- Calculation is the next deterministic step after eligibility
- Calculation rules amend frequently (cost-of-living adjustments, formula changes); a strong test of the effective-value architecture
- Cross-jurisdictional formulas are heterogeneous (Brazil's reformed formulas, France's *trimestres*, Germany's *Entgeltpunkte*); proves the substrate handles real complexity

**Scope:**

- New `RuleType.CALCULATION` for arithmetic rules
- Calculation rules use the same `LegalRule` model with parameters resolved via effective-value lookup
- New engine method `calculate(case, recommendation)` returning a `BenefitAmount` with formula, inputs, intermediate values, and per-step citations
- Encode the basic monthly amount calculation across all six jurisdictions
- Calculation output must show its work; no opaque numbers

### 2C. Notification artefact generation

**Adds:** every approved or denied case produces a citizen-facing decision notice with full reasoning, citation chain, and appeal instructions. Templates are themselves `ConfigValue` records with effective dates.

**Why:**

- Closes the loop with the citizen
- Decision notices are legally significant artefacts whose required content is regulated and amended over time
- Forces the system to articulate reasoning in plain language, exposing weakly explained rules
- Provides the artefact appeals bodies actually look at

**Scope:**

- Notice templates as ConfigValues (e.g. `<jur>.notice.template.eligible`, `<jur>.notice.template.ineligible_age`)
- Templates use a structured language with placeholders resolved from the case, recommendation, and calculation
- Output formats: HTML, PDF, plain-text email
- Per-jurisdiction config for outcome, lay-language rationale, citations, calculation breakdown, appeal rights, deadlines, contacts
- Audit trail records exact template version used

### 2D. Life-event reassessment

**Adds:** when an applicant's circumstances change, the system reassesses against rules in effect at the date of the change. Same engine, new `evaluation_date`, updated facts, new recommendation linked to the prior one via `supersedes`.

**Why:**

- Real benefits administration is event-driven, not application-driven
- The temporal architecture handles this naturally
- Demonstrates the effective-value substrate under load
- Makes the system a persistent decision support layer, not a one-shot screener

**Scope:**

- New `Event` model on the case: `{event_type, event_date, new_facts}`
- New endpoint `POST /api/cases/{id}/events` triggering reassessment
- Engine evaluates against rules in effect at `event_date`
- Generates a new recommendation linked to the prior one
- Notification fires automatically using the 2C machinery

## Phase Plan

The plan is sequenced so each phase produces a usable artefact. If work stops after any phase, what shipped is still net-positive. All migrations apply to all six jurisdictions in lockstep.

### Phase 0: Pre-flight (1 day)

| Task | Output |
| ---- | ------ |
| Tag current main as `pre-lawcode-v0.2.0` | Rollback point |
| Run full test suite, record green | 65/65 baseline |
| Audit `jurisdictions.py` and `seed.py` for hidden coupling | Migration risk map |
| Publish current OpenAPI spec; freeze as Lovable contract | Frontend dependency unblocked |
| Lock decisions: YAML over JSON; per-parameter granularity; in-memory store contract | Three approved gates |

### Phase 1: ConfigValue substrate (4 days)

Build the universal config store. In-memory first, schema-validated. Add `resolve()` and integrate with audit trail. Expose `/api/config/*` endpoints from day one so Lovable can be developed in parallel.

### Phase 2: Migrate hardcoded values to config (5 days)

All six jurisdictions in lockstep. Every constant in `seed.py`, `jurisdictions.py`, `i18n.py`, and `encoder.py` becomes a ConfigValue record loaded at startup. Tests stay green throughout.

### Phase 3: Externalize ConfigValues to YAML (3 days)

The store seeds from `lawcode/<jurisdiction>/config/*.yaml`. Replaces the simple "externalize jurisdictions" approach by routing through the config substrate. Domain experts can contribute by editing YAML.

### Phase 4: Promote prompts to ConfigValues (2 days)

Extraction prompt, user template, officer explanation template, audit narrative template all become dated config. Encoding batches record the prompt version that ran. Past extractions become reproducible.

### Phase 5: Schema publish (2 days)

Publish `schema/configvalue-v1.0.json` and `schema/lawcode-v1.0.json` as language-agnostic, public, versioned artefacts. CI fails on any committed YAML that violates the schema.

### Phase 6: Admin UI for configure-without-deploy (4 days, Lovable)

Web UI to draft, review, approve, and schedule new ConfigValue records. Diff view, effective-date scheduling, approval workflow, rationale capture. Replaces the original "Phase 6: build admin UI in Jinja" plan with the Lovable equivalent.

### Phase 7: Reverse index and impact analysis (2 days)

`govops impact-of <citation>` enumerates all rules and prompts dependent on a given statute section, across all six jurisdictions. New API endpoint and Lovable surface. CI law-change drill test.

### Phase 8: Federation and registry (3 days)

`lawcode/REGISTRY.yaml` allowing remote jurisdictions to be referenced. `govops fetch <registry_url>` validates schema and caches. Provenance tracking records source repo and commit hash in audit trail.

### Phase 9: SPRIND alignment artefacts (2 days)

New `docs/design/LAW-AS-CODE.md` mapping GovOps to SPRIND's five elements with code references. README hero update across all six languages. Cross-link in ecosystem documentation.

### Phase 10: Pipeline extensions (21 days)

| Extension | Backend | Lovable | Sequence |
| --------- | ------- | ------- | -------- |
| 2A. Self-screening | 5 days | 5 days (parallel) | First; same engine, no new domain |
| 2B. Calculation | 6 days | 3 days | Second; heaviest backend lift |
| 2C. Notification | 4 days | 3 days | Third; sits on 2A and 2B |
| 2D. Life-event reassessment | 3 days | 2 days | Fourth; smallest scope, requires 2C |

### Cumulative timeline

| Block | Working days | Cumulative |
| ----- | -----------: | ---------: |
| 0. Pre-flight | 1 | 1 |
| 1. ConfigValue substrate | 4 | 5 |
| 2. Migrate hardcoded values | 5 | 10 |
| 3. Externalize to YAML | 3 | 13 |
| 4. Promote prompts | 2 | 15 |
| 5. Schema publish | 2 | 17 |
| 6. Admin UI (Lovable) | 4 | 21 |
| 7. Reverse index | 2 | 23 |
| 8. Federation | 3 | 26 |
| 9. SPRIND alignment | 2 | 28 |
| 10. Pipeline extensions | 21 | 49 |

Approximately 49 working days. At evening and weekend pace, roughly 16 to 18 calendar weeks. Lovable work runs in parallel from Phase 1 onward, distributed across the timeline.

## Non-goals

- **No new jurisdictions during structural work.** Adding a seventh country before externalization completes doubles migration cost. Defer until after Phase 3.
- **No persistence layer.** Database migration is a separate track. Stay in-memory through all 10 phases.
- **No authentication or RBAC.** Production hardening is downstream of Law-as-Code structural work.
- **No new rule types beyond what extensions require.** The current six (`age_threshold`, `residency_minimum`, `residency_partial`, `legal_status`, `evidence_required`, `exclusion`) cover all six jurisdictions today. `RuleType.CALCULATION` is the only addition, and only when 2B reaches it.
- **No language additions beyond the current six.** Six is enough to prove the substrate.

## Success Criteria

The plan is successful if, at completion:

1. Every value the system uses is resolvable through the effective-value substrate; no hardcoded business constants remain in Python.
2. Every jurisdiction is contributable in YAML by a non-Python developer.
3. The schema is published, versioned, and validated in CI.
4. Statute changes are temporal, not destructive; historical evaluations remain reproducible.
5. Citation impact is queryable across all six jurisdictions in one command.
6. The encoding pipeline produces commit-ready YAML, not Python.
7. Prompts are dated configuration; the prompt that ran on date D is reconstructable.
8. A second repository can federate its own jurisdiction into a GovOps deployment.
9. The Lovable UI replaces all Jinja templates and adds the configure-without-deploy admin surface.
10. The pipeline runs end-to-end from self-screening through eligibility, calculation, notification, and life-event reassessment, in all six jurisdictions.
11. The repository's public framing names "Law as Code" explicitly and maps to SPRIND's five foundational elements.

## Decision Gates

Before kickoff, three decisions must be locked.

### Gate 1: YAML over JSON for artefacts

YAML supports comments, which are valuable for legal annotation, and round-trips through editors better. Recommendation: YAML. Lock before Phase 0 ends.

### Gate 2: Per-parameter ConfigValue granularity

Every individual rule parameter is its own ConfigValue (`ca-oas.rule.age-65.min_age = 65`), rather than the whole rule being one ConfigValue with a versioned object payload. Finer granularity, smaller diffs, easier targeted amendments. Recommendation: per-parameter. Lock before Phase 1 ends.

### Gate 3: Storage model

In-memory dictionary in Phase 1, with the contract designed so swapping to SQLite or PostgreSQL is mechanical. The contract is what matters; the store is implementation detail. Recommendation: in-memory through all 10 phases; storage migration is a separate track. Lock before Phase 1 ends.

### Gate 4 (additional): Prompt-as-config policy

Prompts require dual approval: domain expert proposes, maintainer reviews. Treat prompt changes with the same gravity as rule changes, because they have the same effect on outputs. Recommendation: dual approval mandatory. Lock before Phase 4 ends.

## Bottom Line

GovOps v2.0 is the Law-as-Code reference implementation that does not require legislative reform to land. SPRIND wants the state to publish executable law; GovOps proves the encoding can be done by domain experts and civil society, with the state retaining final decision authority. The effective-value substrate makes the system live-configurable; the Lovable UI makes it usable; the pipeline extensions make it complete; the open Apache 2.0 license makes it forkable.

If v2.0 ships in full, GovOps becomes the working answer to the question SPRIND poses. Not a vision document. A working substrate other governments can fork.

That is the product path.
