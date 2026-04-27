# GovOps PLAN.md — Law-as-Code v2.0

**Status**: Active — single source of truth for the v2.0 build
**Branch**: `feat/law-as-code-v2`
**Source vision**: [docs/IDEA-GovOps-v2.0-LawAsCode.md](docs/IDEA-GovOps-v2.0-LawAsCode.md)
**SPRIND alignment**: [docs/design/LAW-AS-CODE.md](docs/design/LAW-AS-CODE.md)
**Baseline tag**: `pre-lawcode-v0.2.0` (Phase 0 ✅)
**Latest milestone tag**: `lawcode-v2-phase-6-progress`
**License**: Apache 2.0 (preserved)

> This document is the operational plan. The vision doc is the strategic argument; this doc is what gets executed and tracked. If the two ever conflict, this doc wins for execution and the vision doc wins for intent — open an ADR to reconcile.

---

## 1. Where we start (baseline truth, 2026-04-25)

| Fact | Value | Source |
| --- | --- | --- |
| Test count | **65** (engine: 14, api: 36, encoder: 15) | `pytest --collect-only` |
| Jurisdictions | 6 (CA, BR, ES, FR, DE, UA) | `JURISDICTION_REGISTRY` in `src/govops/jurisdictions.py` |
| Languages | 6 (en, fr, pt, es, de, uk) | `_TRANSLATIONS` in `src/govops/i18n.py` |
| Rule types | 6: `age_threshold`, `residency_minimum`, `residency_partial`, `legal_status`, `evidence_required`, `exclusion` | `RuleType` enum in `src/govops/models.py` |
| Python support | 3.10 / 3.11 / 3.12 | `.github/workflows/ci.yml` |
| CI gates | tests on 3 Python versions, CodeQL, gitleaks | `.github/workflows/` |
| UI | Jinja2 served by FastAPI | `src/govops/api.py` + `src/govops/templates/` |
| Persistence | In-memory only, reseeded on startup | `src/govops/store.py` |
| Encoder | Working pipeline: ingest → extract (LLM) → review → commit | `src/govops/encoder.py` |
| Disclaimer | Not gov-affiliated; statutory text used illustratively | [README.md](README.md) |

### Doc gaps captured during baseline (carry into Phase 0)

These were found during PLAN authoring; they are not v2.0 features but they distort the baseline. Fixed in Phase 0 alongside the rollback tag. Test-count drift is a known recurring issue — the live count lives in §6 (currently 202), CLAUDE.md is updated phase-to-phase.

- [x] [CLAUDE.md](CLAUDE.md) test count updated from "45 tests passing" — accuracy maintained per phase; live count in §6.
- [x] CLAUDE.md mentions `encoder.py` / `encoding_example.py` / `test_encoder.py`.
- [x] CLAUDE.md has single-test commands, `--reload` flag, CI matrix, rule-type list, disclaimer rule.
- [x] CONTRIBUTING.md `RuleType` table mirrored to CLAUDE.md.
- [x] ADR index published at [`docs/design/ADRs/README.md`](docs/design/ADRs/README.md).

---

## 2. v2.0 thesis (one paragraph)

Every value the system uses — thresholds, accepted statuses, evidence types, country lists, UI labels, audit event types, and the LLM prompts themselves — becomes a dated `ConfigValue` record resolved by `(domain, key, evaluation_date, jurisdiction_id)`. Behaviour changes are configuration writes, not deploys. Old evaluations remain reproducible against the substrate that was in effect on their evaluation date. The Jinja UI is replaced by a Lovable app; the pipeline is extended upstream (self-screening) and downstream (calculation, notification, life-event reassessment). Boundaries from v1.0 (decision support, human-in-the-loop, evidence-first, full traceability, Apache 2.0) are preserved and strengthened.

---

## 3. Decision gates (lock before the phase begins)

| # | Gate | Recommendation | Lock by | Status |
| --- | --- | --- | --- | --- |
| 1 | YAML over JSON for artefacts | YAML (comments, editor round-trip) | End of Phase 0 | **LOCKED** — ADR-003 |
| 2 | ConfigValue granularity | Per-parameter (`ca-oas.rule.age-65.min_age`) | End of Phase 1 | **LOCKED** — ADR-006 |
| 3 | Storage model for Phases 1–10 | In-memory through Phase 5; embedded SQLite from Phase 6 | End of Phase 1 | **LOCKED** — ADR-007 (in-memory) + ADR-010 (SQLite from Phase 6) |
| 4 | Prompt-as-config approval policy | Dual approval (domain expert + maintainer) | End of Phase 4 | **LOCKED** — ADR-008 |
| 5 | **(added)** Lovable code repo location | Same repo, `web/` folder; Lovable authors upstream, artefact brought in | End of Phase 0 | **LOCKED** — ADR-005 |
| 6 | **(added)** Backwards-compat strategy during Phase 1–2 | `resolve()` falls back to current Python constants until Phase 2 cuts each domain over; tests stay green throughout | End of Phase 1 | **LOCKED** — ADR-004 |
| 7 | **(added)** Federation trust model (Phase 8) | Signed manifests + checksum pinning in `lawcode/REGISTRY.yaml`; reject unsigned by default | End of Phase 7 | OPEN |

Record gate decisions as ADRs in `docs/design/ADRs/`.

---

## 4. Phase plan with entry/exit criteria

Format: each phase has **entry**, **work**, **exit**, **artefacts**. Tests must stay green at every exit.

### Phase 0 — Pre-flight (1 day)

**Entry**: clean main, 65/65 green.
**Work**:
- Tag `pre-lawcode-v0.2.0` on main (rollback point)
- Apply CLAUDE.md gap fixes from §1 (test count, encoder, single-test, rule-type table, disclaimer)
- Audit `seed.py` and `jurisdictions.py` for hidden coupling; record findings in `docs/design/ADRs/ADR-002-coupling-audit.md` (ADR-001 was a v1.0-era proposal that was never adopted; preserved as Superseded for history)
- Publish `openapi.json` snapshot under `docs/api/openapi-v0.2.0.json` and freeze as the contract surface for Phase 6 (Lovable)
- Lock Gates 1, 5, 6 as ADRs (ADR-003 YAML over JSON, ADR-005 Lovable in `web/`, ADR-004 backcompat strategy)
- Lovable authors upstream in its own environment; built artefact lands in `web/` via PR (ADR-005)

**Exit**: tag exists; CLAUDE.md accurate; ADR-002/003/004/005 merged; OpenAPI snapshot present.
**Artefacts**: `pre-lawcode-v0.2.0` tag, updated `CLAUDE.md`, `docs/api/openapi-v0.2.0.json`, ADR-002/003/004/005.

### Phase 1 — ConfigValue substrate (4 days)

**Entry**: Gates 1, 5, 6 locked.
**Work**:
- Add `ConfigValue` Pydantic model per the v2.0 spec (`id`, `domain`, `key`, `jurisdiction_id`, `value`, `value_type`, `effective_from`, `effective_to`, `citation`, `author`, `approved_by`, `rationale`, `supersedes`, `created_at`)
- In-memory `ConfigStore` with `resolve(key, evaluation_date, jurisdiction_id=None)` and `list_versions(key)`
- `/api/config/values` (GET list/filter), `/api/config/values/{id}` (GET), `/api/config/resolve` (GET; query by key + date)
- Engine integration: `OASEngine.evaluation_date` already exists; thread it through any call that resolves
- Audit: every `resolve()` call inside an evaluation appends a `ConfigResolution` entry to the audit package
- Lock Gates 2, 3 (granularity, storage) as ADRs

**Exit**: 65/65 still green; new tests cover `ConfigStore` (round-trip, effective-date semantics, supersession chain, jurisdiction scoping); `/api/config/resolve` returns answers for a hand-seeded fixture key.
**Artefacts**: `src/govops/config.py`, `tests/test_config.py` (~15 new tests), ADR-004/005.

### Phase 2 — Migrate hardcoded values to ConfigValue (5 days)

**Entry**: Phase 1 exit met. Backwards-compat strategy (Gate 6) in effect: `resolve()` falls back to current Python constants for any key not yet seeded.
**Work**: lockstep across all 6 jurisdictions, migrate domain by domain.
- `rule.parameter` — every `parameters` dict in seed/jurisdictions
- `enum.legal_status` — accepted statuses per rule
- `engine.threshold` — `home_countries` lists, evidence keys
- `ui.label` — every `_TRANSLATIONS` entry (one ConfigValue per key per language)
- `global.config.default_language` and similar globals

After each domain migrates: drop the Python constant, leave the call site reading via `resolve()`.

**Exit**: 65/65 green; no business constants left in `seed.py`, `jurisdictions.py`, or `i18n.py`; grep gate added in CI to prevent regression (`scripts/check_no_hardcoded_constants.py`).
**Artefacts**: rewritten `seed.py`/`jurisdictions.py`/`i18n.py`, new CI grep gate.

### Phase 3 — Externalize ConfigValues to YAML (3 days)

**Entry**: Phase 2 exit met.
**Work**:
- New `lawcode/<jurisdiction>/config/*.yaml` tree (one file per domain, e.g. `rules.yaml`, `enums.yaml`, `ui-labels.yaml`)
- `ConfigStore.load_from_yaml(path)` at startup; legacy seed code retired
- Add `lawcode/global/` for non-jurisdictional values
- Validate against schema-in-progress (Phase 5 publishes the formal schema)

**Exit**: server starts cleanly with empty Python seeds; all 65 tests still green; a non-Python contributor can edit `lawcode/ca/config/rules.yaml` and see the change without touching code.
**Artefacts**: `lawcode/` directory, `ConfigStore.load_from_yaml`, contributor guide section.

### Phase 4 — Promote prompts to ConfigValues (2 days)

**Entry**: Phase 3 exit met. Gate 4 locked.
**Work**:
- Migrate `EXTRACTION_SYSTEM_PROMPT`, `EXTRACTION_USER_TEMPLATE`, officer-explanation, audit-summary prompts to `ConfigValue` records (`value_type=prompt`)
- Encoder records the prompt `ConfigValue.id` used per batch into the batch audit
- Test: re-running extraction with a fixture batch + pinned prompt id produces identical output

**Exit**: all prompts in `lawcode/global/prompts.yaml`; batch audit pins prompt id; new test verifies prompt reproducibility.
**Artefacts**: `lawcode/global/prompts.yaml`, encoder changes, ~3 new tests.

### Phase 5 — Schema publish (2 days)

**Entry**: Phase 4 exit met.
**Work**:
- `schema/configvalue-v1.0.json` (JSON Schema for `ConfigValue` records)
- `schema/lawcode-v1.0.json` (JSON Schema for the YAML file shape)
- CI step that validates every YAML file under `lawcode/` against the schema; fails the build on violation
- Publish under `docs/api/` with a link from README

**Exit**: CI fails on a deliberately malformed YAML test; schema versioned and linked publicly.
**Artefacts**: `schema/*.json`, new CI job.

### Phase 6 — Admin UI (4 days, Lovable)

**Entry**: Phase 5 exit met. OpenAPI snapshot from Phase 0 still aligned with current API (revalidate).
**Work** (separate Lovable surface; backend exposes only what's needed):
- ConfigValue search by key prefix, jurisdiction filter
- Effective-value timeline view per key
- Draft new value: form with `value`, `effective_from`, `citation`, `rationale`
- Approval flow: draft → review → approved (state transitions logged)
- Diff view between adjacent versions
- Prompt admin: markdown editor, diff, "test this prompt against fixture X"

**Exit**: a maintainer can change `ca-oas.rule.age-65.min_age` from 65 to 67 effective 2027-01-01 entirely through the UI, and a case evaluated on 2027-01-02 picks up the new value.
**Artefacts**: Lovable app pages, backend endpoints `POST /api/config/values`, `POST /api/config/values/{id}/approve`.

### Phase 7 — Reverse index and impact analysis (2 days)

**Entry**: Phase 6 exit met.
**Work**:
- New endpoint `GET /api/impact?citation=<citation>` returning all rules and prompts referencing that citation across all jurisdictions
- CLI: `govops impact-of <citation>`
- Lovable surface: search by citation, see all dependent ConfigValues

**Exit**: `govops impact-of "OAS Act, s. 3(1)"` lists the age-threshold rule for CA plus any other citation-linked records.
**Artefacts**: new endpoint, CLI command, ~5 new tests.

### Phase 8 — Federation and registry (3 days)

**Entry**: Phase 7 exit met. Gate 7 (federation trust) locked.
**Work**:
- `lawcode/REGISTRY.yaml` schema: per-entry `name`, `source_url`, `commit_hash`, `signed_manifest_url`, `trusted_keys`
- `govops fetch <registry_url>` validates checksum + signature, caches under `lawcode/.federated/`
- Provenance: every fetched ConfigValue records `source_repo`, `source_commit`, `fetched_at` in audit
- Reject unsigned by default; require `--allow-unsigned` flag for trial fetches

**Exit**: a second demo repo can publish a jurisdiction; the main repo can fetch it and evaluate cases against it; audit shows source_repo + commit.
**Artefacts**: `govops fetch` command, REGISTRY schema, federation tests.

### Phase 9 — SPRIND alignment artefacts (2 days)

**Entry**: Phase 8 exit met.
**Work**:
- `docs/design/LAW-AS-CODE.md` mapping GovOps to SPRIND's 5 elements with code references
- README hero update across all 6 languages naming "Law as Code" explicitly
- Cross-link from ecosystem docs

**Exit**: a SPRIND-literate reader can identify which file in this repo implements each of the five elements.
**Artefacts**: `LAW-AS-CODE.md`, README updates.

### Phase 10 — Pipeline extensions (21 days)

Sequenced; each sub-phase ships independently.

| # | Extension | Backend | Lovable | Depends on |
| --- | --- | --- | --- | --- |
| 10A | Self-screening (`POST /api/screen`, no PII, no audit) | 5 d | 5 d (parallel) | Phase 6 |
| 10B | Entitlement calculation (`RuleType.CALCULATION`, `engine.calculate()`) | 6 d | 3 d | 10A |
| 10C | Notification artefact generation (templates as ConfigValue, HTML/PDF/email) | 4 d | 3 d | 10A + 10B |
| 10D | Life-event reassessment (`Event` model, `POST /api/cases/{id}/events`) | 3 d | 2 d | 10C |

**Per-extension exit criteria**:

- **10A**: a citizen can self-screen for OAS without creating a case; output matches what the officer engine would produce for the same facts; no row added to the case store.
- **10B**: an eligible CA case returns a `BenefitAmount` with formula trace and per-step citation; calculation parameters resolve via Phase-1 substrate; cost-of-living adjustment can be made via configure-without-deploy.
- **10C**: an approved case produces an HTML + PDF notice; template version is recorded in audit; changing the template via admin UI reflects in next case.
- **10D**: posting an event with a future date triggers reassessment using rules in effect on that date; new recommendation links to the prior via `supersedes`; notification fires automatically.

---

## 5. Cumulative timeline

| Block | Days | Cumulative |
| --- | ---: | ---: |
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

~49 working days. At evening/weekend pace: ~16–18 calendar weeks. Lovable work runs in parallel from Phase 1 onward.

---

## 6. Test budget per phase (non-regression target)

| Phase | Target test count | Status | Notes |
| ---: | ---: | --- | --- |
| 0 (start) | 65 | ✅ baseline | tag `pre-lawcode-v0.2.0` |
| 1 | ~80 | ✅ | + ConfigStore tests |
| 2 | ~80 | ✅ | migration, no behaviour change |
| 3 | ~85 | ✅ | + YAML loader tests |
| 4 | ~88 | ✅ | + prompt reproducibility tests |
| 5 | ~90 | ✅ | + schema validation tests |
| 6 | ~100 | 🟡 in progress | + admin endpoint tests; UI surfaces shipped, full E2E exit-line proof pending |
| 7 | ~105 | 🟡 backend done | impact endpoint + 23 tests landed; Lovable surface tracked as `docs/govops-014-citation-impact.md` |
| 8 | ~115 | ⬜ | + federation tests |
| 9 | ✅ docs only | ✅ | `docs/design/LAW-AS-CODE.md` published |
| 10A | ~110 | 🟡 backend done | self-screening endpoint + 18 tests landed; Lovable surface tracked as `docs/govops-015-self-screening.md` |
| 10B | ~120 | ⬜ | calculation rule type + engine.calculate() |
| 10C | ~130 | ⬜ | notification artefact templating |
| 10D | ~145 | ⬜ | life-event reassessment |

**Live count (2026-04-26)**: 202 backend tests passing (`pytest -q`).

Tests must stay green at every phase exit. CI matrix stays at Python 3.10/3.11/3.12.

---

## 7. Non-goals (preserved from v2.0 vision)

- No new jurisdictions during Phases 1–3 (doubles migration cost). Defer until Phase 3 exit.
- No **production** persistence layer (managed PostgreSQL with HA, backup, ops on-call). The post-Phase-10 "storage track" refers to that. **Embedded SQLite** beside the code is used from Phase 6 onward per [ADR-010](docs/design/ADRs/ADR-010-sqlite-from-phase-6.md) — it is a local file, not infrastructure, and preserves the "clone, install, run" demo principle.
- No authentication or RBAC during structural work.
- No new rule types beyond `RuleType.CALCULATION` (added in Phase 10B).
- No new languages beyond the current 6.

---

## 8. Success criteria (the 11 from the vision doc, restated for tracking)

- [x] 1. Every value resolvable through effective-value substrate; no hardcoded business constants in Python *(Phase 2 + grep gate)*
- [x] 2. Every jurisdiction contributable in YAML by a non-Python developer *(Phase 3 — `lawcode/{ca,br,es,fr,de,ua}/config/`)*
- [x] 3. Schema published, versioned, validated in CI *(Phase 5 — `schema/configvalue-v1.0.json`, `schema/lawcode-v1.0.json`, CI gate)*
- [x] 4. Statute changes are temporal, not destructive; historical evaluations reproducible *(`ConfigStore.resolve()` + supersession + tests)*
- [x] 5. Citation impact queryable across all 6 jurisdictions in one command *(Phase 7 — `GET /api/impact?citation=…` + `govops impact-of`)*
- [ ] 6. Encoding pipeline produces commit-ready YAML, not Python *(encoder commits to ConfigStore; YAML emission still pending)*
- [x] 7. Prompts are dated configuration; the prompt that ran on date D is reconstructable *(Phase 4 — `lawcode/global/prompts.yaml`, ADR-008 dual approval)*
- [ ] 8. A second repository can federate its own jurisdiction into a GovOps deployment *(Phase 8)*
- [ ] 9. Lovable UI replaces all Jinja templates and adds the configure-without-deploy admin surface *(Phase 6 — surfaces shipped; full UI-driven exit-line E2E proof pending)*
- [ ] 10. Pipeline runs end-to-end from self-screening through eligibility, calculation, notification, life-event reassessment, in all 6 jurisdictions *(10A backend done; 10B–10D pending)*
- [x] 11. Repo's public framing names "Law as Code" explicitly and maps to SPRIND's 5 foundational elements *(Phase 9 — [`docs/design/LAW-AS-CODE.md`](docs/design/LAW-AS-CODE.md))*

---

## 9. Risk register (kept live; update as phases progress)

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Phase 2 migration breaks tests in subtle ways (timezone, type coercion) | Medium | High | Per-domain cutover with green-tests gate; backwards-compat fallback (Gate 6) lets us revert one domain at a time |
| Lovable contract drifts from backend OpenAPI | Medium | Medium | OpenAPI frozen at Phase 0; CI diff gate on `openapi.json` after Phase 6 |
| Effective-date semantics surprise users (timezone, midnight cutover) | Medium | High | All `effective_from` are UTC midnight; document explicitly; add edge-case tests |
| Federation pulls in malicious or wrong jurisdiction data | Low | High | Gate 7 (signed manifests, checksum pinning); reject unsigned by default |
| Calculation rules (Phase 10B) reveal modeling gaps in `LegalRule` | Medium | Medium | Spike `RuleType.CALCULATION` schema during Phase 1 to avoid late rework |
| Lovable surface scope creeps | High | Medium | Lock Phase 6 scope to ConfigValue admin + replacing Jinja; pipeline-extension UIs are Phase 10 |
| Prompt changes affect outputs without anyone noticing | Medium | High | Gate 4 dual-approval policy; encoder pins prompt id per batch; CI diff gate on `lawcode/global/prompts.yaml` |
| Doc gaps (CLAUDE.md staleness) reappear | Low | Low | Phase 0 cleanup + add a periodic "doc-freshness" CI check (compare test count assertion in CLAUDE.md to `pytest --collect-only`) |

---

## 10. Branch and commit strategy

- All v2.0 work lands on `feat/law-as-code-v2` until Phase 5 exit, then we evaluate squash-vs-merge into `main`.
- Per-phase tags: `lawcode-v2-phase-<N>-complete` after each phase exit.
- Every ADR is a separate commit in `docs/design/ADRs/` referencing the gate or decision it captures.
- Commit message convention: `phase-<N>: <imperative>` (e.g. `phase-1: add ConfigStore.resolve()`).
- Conventional Commits adopted from Phase 0 (`type(scope): subject` — types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `phase-N`). CI enforcement revisit at Phase 5.

---

## 11. Out-of-scope items captured for later (do not let these creep in)

- Persistence layer (SQLite / PostgreSQL) — separate track after Phase 10
- AuthN / AuthZ — separate track
- Multi-tenant deployment — out of scope for reference implementation
- Real LLM provider integration in encoder (currently pluggable backend) — separate track
- Production hardening (rate limits, observability, secrets management) — separate track
- Cross-program rules within a jurisdiction (today: pension only) — defer until federation proves out

---

## 12. Accepted backlog — post-spec additions (in scope, awaiting follow-up)

Items here were shipped beyond the originating spec, evaluated on merit, and **accepted** by the maintainer. They are in scope but tracked separately from the phase plan because most carry small follow-up work — typically backend plumbing to honour fields the UI now expects, or spec/doc reconciliation so the next reviewer doesn't read them as drift.

### Phase 7 — Lovable extras accepted from `eva-foundry/user-insights-hub` (2026-04-26)

Originating spec: [docs/govops-014-citation-impact.md](docs/govops-014-citation-impact.md). Accepted because the cost is near-zero, value shows up the moment a single statute affects more than ~25 records, and federation (Phase 8) will multiply hit counts.

| # | Addition | Status | Follow-up |
| --- | --- | --- | --- |
| 7.x.1 | Client-side pagination on `/impact` (`limit` / `page` / `page_count` on `ImpactResponse`, `ImpactPaginationBar` top + bottom, page-size selector 10/25/50/100, URL-persisted, resets to page 1 on new query) | Shipped UI-side; backend currently ignores `limit` / `page` query params and returns the full set, which the UI tolerates via `??` defaults | **Backend**: extend `GET /api/impact` to honour `limit` (default e.g. 50, max 200) and `page` (1-indexed) query params, return `limit` / `page` / `page_count` in the response shape. **Spec**: amend govops-014 §"Out of scope" to remove the pagination defer-clause, or add a new govops-014a addendum recording the change. **Tests**: add ~3 cases covering page math, empty page, page-size change. |
| 7.x.2 | Nav i18n key renamed `impact.nav` → `nav.impact` (matches sibling `nav.*` convention) | Shipped | Update govops-014 §i18n to record the actual key, so the next spec reviewer doesn't read this as a missing key. |
| 7.x.3 | Inline row layout instead of importing `ConfigValueRow` from govops-003 | Refactor specced — see [docs/govops-014a-row-reuse.md](docs/govops-014a-row-reuse.md) | **Lovable**: extend `ConfigValueRow` with two optional props (`highlightQuery`, `showJurisdictionChip`) and refactor `ImpactSection` to import it. Queued behind Phase 10A. Spec includes reference TSX; no UX change, no copy change, no new tokens. |
| 7.x.4 | Nav placement: order is Authority → Impact → Cases → Encode (Cases interposed) | Shipped | Decide whether to keep Cases between Impact and Encode, or move Impact to sit directly before Encode as the spec literal had it. Cosmetic. |
| 7.x.5 | A11y polish: `aria-label` on `<mark>`, `role="alert"` on error banner, `aria-atomic="true"` + `role="region"` on count summary | Shipped | None — strict improvements over the spec's a11y minimum. Update the a11y section of govops-014 to record the upgraded baseline. |
| 7.x.6 | `<form onSubmit>` wrapper around the search input (Enter-to-submit bypasses debounce) | Shipped | None — strict UX improvement. |
| 7.x.7 | `ProvenanceRibbon` on the page header + per result row (hybrid provenance) | Shipped | None — consistent with the project's design-system rule that every authored surface declares provenance. |
| 7.x.8 | TanStack Start `head()` meta (title + description) on `/impact` for SSR | Shipped | Apply the same pattern to other Phase 6 routes that lack it (config, authority, encode) — track separately as a small UI hygiene pass. |
| 7.x.9 | `data-testid` attributes on Impact components for E2E hooks | Shipped | None — picked up automatically by the cross-browser Playwright harness landed in commit `3583002`. |

**Cumulative test-budget impact**: ~3 additional backend tests (pagination math + edge cases) + ~5 additional Playwright cases (page-size change, URL persistence on pagination, empty-page guardrail). Roll into the Phase 7 line in §6 once landed.

### Phase 10A — Lovable extras + post-flight findings from `eva-foundry/user-insights-hub` (2026-04-26)

Originating spec: [docs/govops-015-self-screening.md](docs/govops-015-self-screening.md). Two Lovable post-flight passes shipped: the first added the bonuses listed below; the second introduced a privacy regression (10A.x.0) that must be corrected before the citizen-facing surface goes live.

| # | Item | Status | Follow-up |
| --- | --- | --- | --- |
| 10A.x.0 | **Privacy regression**: `src/lib/screenDraft.ts` writes the full form state (DOB, residency, legal status, evidence) to `sessionStorage` on every keystroke; restored on mount. The `screen.lede` copy ("nothing is saved") is now factually false. Violates the load-bearing privacy invariant in govops-015 ("All state is in-memory React state. The only browser storage allowed is the existing locale cookie"). | **🚫 BLOCKING** — must ship before any SPRIND-facing surface | **Lovable**: see [docs/govops-015b-screen-privacy-fix.md](docs/govops-015b-screen-privacy-fix.md). Delete `screenDraft.ts` + the `useEffect` calls in `ScreenForm.tsx`; drop the `screen.draft.*` and `screen.reset.*` keys (or repurpose the dialog as in-memory clear). Keep the validation summary, dialog component, pure validator. |
| 10A.x.1 | Polish gap: inline `role="alert"` validation messages with `aria-describedby` + `aria-invalid` + top-of-form summary with focus-jump links. Pure validator extracted to `src/lib/screenValidation.ts`. | ✅ closed (post-flight) | None |
| 10A.x.2 | Polish gap: program name + lede still hardcoded in `PROGRAM_LABELS` table inside `screen.$jurisdictionId.tsx`. `fetchJurisdiction()` exists in `api.ts` but is not called by this route. Spec required live fetch from `/api/jurisdiction/{code}`. | 🟡 still open | **Lovable**: see [docs/govops-015a-self-screening-polish.md](docs/govops-015a-self-screening-polish.md). Wire `fetchJurisdiction()` into the route loader; fall back to the existing hardcoded labels on network failure (preview-mode parity). |
| 10A.x.3 | Polish gap: mojibake in `en.json` (em-dash + middle-dot were `â€”` / `Â·`). Re-encoded to U+2014 / U+00B7. | ✅ closed (post-flight) | None |
| 10A.x.4 | `LanguageSwitcher` in citizen shell header (`ScreenShell.tsx`) | Shipped | None |
| 10A.x.5 | Esc on the result card returns focus to the first form field (`#screen-dob`) | Shipped | None |
| 10A.x.6 | Backspace on empty country field deletes the residency row (`ResidencyPeriodRows.tsx`) | Shipped | None |
| 10A.x.7 | "Rerun" button on the stale result card (instead of the spec's "rerun overlay") | Shipped | Update govops-015 §Acceptance to record the actual UX shape. |
| 10A.x.8 | Translatable 404 copy via `screen.unknown_jurisdiction` for unknown jurisdiction codes | Shipped | None |
| 10A.x.9 | Hardcoded `HOWTO_URLS` per jurisdiction (real government URLs in `ScreenResult.tsx`) | Shipped — spec-compliant | Future: move to backend ConfigValue (`jurisdiction.<code>.howto_url`) once Phase 10C notification artefacts land. Track here, no immediate action. |
| 10A.x.10 | Per-rule `detail` text rendered above citation in result rows | Shipped | None — already in the contract |
| 10A.x.11 | Per-row "Remove" button on residency periods with `aria-label` | Shipped — accessibility upgrade | None |
| 10A.x.12 | Validation summary panel at form top (post-flight) — ICU plural heading (`screen.errors.summary.heading`), clickable links that scroll+focus the offending field, trims to 5 with "and N more" | Shipped (post-flight) | None — strict improvement |
| 10A.x.13 | Reset confirmation `<Dialog>` with i18n keys `screen.reset.{title,body,keep,discard}` (post-flight) | Shipped, **but tied to draft persistence** | After 10A.x.0 fix: repurpose as plain in-memory clear (drop `screen.reset.*` if dialog goes too) |
| 10A.x.14 | Versioned snapshot + migration pipeline in `screenDraft.ts` (v1→v2) with retry-on-quota-failure backoff (post-flight) | **🚫 will be deleted** as part of 10A.x.0 | Removed when `screenDraft.ts` is dropped |

**Cumulative test-budget impact for Phase 10A**: backend already has 18 privacy + happy-path tests (landed in this session). Lovable post-flight pass added unit tests for the pure validator (count TBD). Once 10A.x.0 lands, the privacy invariants will need explicit Playwright cases asserting `sessionStorage.getItem("govops:screen-draft") === null` after a form submission.

### Convention going forward

When Lovable (or any contributor) ships beyond a spec and the addition is accepted on merit:
1. The originating spec stays frozen as the historical contract.
2. A new row goes here under `Phase <N> — extras accepted` listing what shipped, current status, and remaining follow-up.
3. When the follow-up lands, mark the row `✅ closed` and leave the entry in place as provenance for the next reviewer.
