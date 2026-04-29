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
| 7 | **(added)** Federation trust model (Phase 8) | Signed manifests + checksum pinning in `lawcode/REGISTRY.yaml`; reject unsigned by default | End of Phase 7 | **LOCKED** — ADR-009 (Ed25519 signed packs + publisher allowlist; fail-closed on unsigned/checksum mismatch). Implemented in `src/govops/federation.py`; admin surface at `/api/admin/federation/*`. |

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
| 6 | ~100 | ✅ | admin endpoint tests + Lovable admin/timeline/diff/draft/approvals/prompts surfaces shipped; admin-flow E2E proves substrate boundary |
| 7 | ~105 | ✅ | impact endpoint + 23 tests landed; Lovable `/impact` shipped (govops-014/14a) |
| 8 | ~115 | ✅ | federation pipeline + admin federation HTTP surface; signed packs with Ed25519 (ADR-009) |
| 9 | ✅ docs only | ✅ | `docs/design/LAW-AS-CODE.md` published |
| 10A | ~110 | ✅ | self-screening endpoint + 18 tests landed; Lovable `/screen` shipped (govops-015/15a/15b) |
| 10B | ~120 | ✅ | `RuleType.CALCULATION` + typed-AST formulas + per-step citation; CA OAS calc wired through `screen`, `evaluate`, `audit` |
| 10C | ~130 | ✅ | decision-notice rendering with template-as-ConfigValue + sha256 in audit; `POST /api/screen/notice` |
| 10D | ~145 | ✅ | event-driven reassessment with supersession chain + `POST /api/cases/{id}/events` |
| 11 | — | ✅ | scalar seam closed (ADR-013 addendum) — every parameter honours `evaluation_date` |

**Live count (2026-04-28)**: 375 backend tests passing (`pytest -q`). Delta from 343 → 375 covers the v0.3.0 federation + admin work (343 → 366), the govops-022 backend prelude (366 → 373, +7 in `tests/test_api_jurisdiction_howto.py`), and the 7th-jurisdiction integration (373 → 375, +2 in `tests/test_api.py::TestMultiJurisdiction`).

Tests must stay green at every phase exit. CI matrix stays at Python 3.10/3.11/3.12.

---

## 7. Non-goals (preserved from v2.0 vision)

- ~~No new jurisdictions during Phases 1–3 (doubles migration cost). Defer until Phase 3 exit.~~ **LIFTED 2026-04-28** by the addition of Japan (`jp`) as the 7th jurisdiction. The freeze served its purpose: Phases 1–6 landed without re-encoding seed data per migration step. With the substrate stable from Phase 3 exit and the schema-validated YAML loader doing the load-bearing work, adding `lawcode/jp/config/rules.yaml` + `jurisdiction.yaml` (15 ConfigValue records) and a Japan section in `src/govops/jurisdictions.py` (jurisdiction + authority chain + 5 LegalRules + 4 demo cases) cost zero changes to existing tests and proved success criterion #2 ("contributable in YAML by a non-Python developer") for a country whose statutory text is in a non-Latin script.
- No **production** persistence layer (managed PostgreSQL with HA, backup, ops on-call). The post-Phase-10 "storage track" refers to that. **Embedded SQLite** beside the code is used from Phase 6 onward per [ADR-010](docs/design/ADRs/ADR-010-sqlite-from-phase-6.md) — it is a local file, not infrastructure, and preserves the "clone, install, run" demo principle.
- No authentication or RBAC during structural work.
- No new rule types beyond `RuleType.CALCULATION` (added in Phase 10B).
- No new languages beyond the current 6.

---

## 8. Success criteria (the 11 from the vision doc, restated for tracking)

- [x] 1. Every value resolvable through effective-value substrate; no hardcoded business constants in Python *(Phase 2 + grep gate)*
- [x] 2. Every jurisdiction contributable in YAML by a non-Python developer *(Phase 3 — `lawcode/{ca,br,es,fr,de,ua}/config/`)*
- [x] 3. Schema published, versioned, validated in CI *(Phase 5 — `schema/configvalue-v1.0.json`, `schema/lawcode-v1.0.json`, CI gate)*
- [x] 4. Statute changes are temporal, not destructive; historical evaluations reproducible *(`ConfigStore.resolve()` + supersession + tests; **scalar seam closed 2026-04-28** — `LegalRule.param_key_prefix` + `OASEngine._param()` re-resolve every scalar parameter through the substrate at the case's `evaluation_date`. See ADR-013 *Addendum (2026-04-28): scalar seam closed*. Proven by `tests/test_engine.py::TestScalarParameterDatedSupersession`.)*
- [x] 5. Citation impact queryable across all 6 jurisdictions in one command *(Phase 7 — `GET /api/impact?citation=…` + `govops impact-of`)*
- [x] 6. Encoding pipeline produces commit-ready YAML, not Python *(closed 2026-04-28 — `src/govops/yaml_emitter.py` + `POST /api/encode/batches/{id}/emit-yaml`. Approved batches emit `lawcode/.proposed/<batch_id>/<prefix>-rules.yaml` that passes the schema gate and round-trips through `ConfigStore.load_from_yaml`.)*
- [x] 7. Prompts are dated configuration; the prompt that ran on date D is reconstructable *(Phase 4 — `lawcode/global/prompts.yaml`, ADR-008 dual approval)*
- [x] 8. A second repository can federate its own jurisdiction into a GovOps deployment *(Phase 8 — ADR-009, `src/govops/federation.py`, `govops fetch <publisher>` CLI, admin federation HTTP surface, signed-pack pipeline with Ed25519)*
- [x] 9. Lovable UI replaces all Jinja templates and adds the configure-without-deploy admin surface *(closed 2026-04-28 — surfaces shipped in user-insights-hub; admin-flow E2E proves substrate boundary; configure-without-deploy E2E proves citizen-side temporal correctness via the dated `ca.calc.oas.base_monthly_amount` supersession; engine's formula `ref` resolution is date-aware per ADR-013 §"the seam".)*
- [x] 10. Pipeline runs end-to-end from self-screening through eligibility, calculation, notification, life-event reassessment, in all 6 jurisdictions *(closed 2026-04-28 — 10A self-screening, 10B benefit_amount via formula AST, 10C decision notice with sha256 audit, 10D event-driven reassessment with supersession chain. CA-OAS fully wired; the other 5 share the same generic notice template via per-jurisdiction supersession when translators need divergent copy.)*
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
| 7.x.1 | Client-side pagination on `/impact` (`limit` / `page` / `page_count` on `ImpactResponse`, `ImpactPaginationBar` top + bottom, page-size selector 10/25/50/100, URL-persisted, resets to page 1 on new query) | ✅ closed (2026-04-28) — backend now honours `limit` (default 50, floor 1, cap 200) and `page` (1-indexed, floor 1) on `GET /api/impact`. Response shape extended with `limit` / `page` / `page_count`; `total` and `jurisdiction_count` describe the FULL match set so the summary copy stays meaningful across pages; `results` carries only sections containing values on the requested page; out-of-range pages return `results=[]` (not 404). 9 new tests landed in `tests/test_api_impact.py` (page math, last-page remainder, out-of-range guard, limit cap, limit/page floors, stable jurisdiction_count, page-size resize). govops-014 §"Out of scope" amended to remove the defer-clause; §"Tokens / data" `ImpactResponse` interface updated. OpenAPI snapshot regenerated. | None |
| 7.x.2 | Nav i18n key renamed `impact.nav` → `nav.impact` (matches sibling `nav.*` convention) | ✅ closed (2026-04-28) — govops-014 §i18n updated; the actual shipped key (`nav.impact`) is now recorded in the spec with a brief rationale so the next reviewer doesn't read it as missing. | None |
| 7.x.3 | Inline row layout instead of importing `ConfigValueRow` from govops-003 | Refactor specced — see [docs/govops-014a-row-reuse.md](docs/govops-014a-row-reuse.md) | **Lovable**: extend `ConfigValueRow` with two optional props (`highlightQuery`, `showJurisdictionChip`) and refactor `ImpactSection` to import it. Queued behind Phase 10A. Spec includes reference TSX; no UX change, no copy change, no new tokens. |
| 7.x.4 | Nav placement: order is Authority → Impact → Cases → Encode (Cases interposed) | Shipped | Decide whether to keep Cases between Impact and Encode, or move Impact to sit directly before Encode as the spec literal had it. Cosmetic. |
| 7.x.5 | A11y polish: `aria-label` on `<mark>`, `role="alert"` on error banner, `aria-atomic="true"` + `role="region"` on count summary | ✅ closed (2026-04-28) — govops-014 §a11y now records the upgraded baseline (`aria_live_atomic: true`, `role='region'` on the count summary, `role='alert'` on the error banner, per-`<mark>` `aria-label`). | None |
| 7.x.6 | `<form onSubmit>` wrapper around the search input (Enter-to-submit bypasses debounce) | Shipped | None — strict UX improvement. |
| 7.x.7 | `ProvenanceRibbon` on the page header + per result row (hybrid provenance) | Shipped | None — consistent with the project's design-system rule that every authored surface declares provenance. |
| 7.x.8 | TanStack Start `head()` meta (title + description) on `/impact` for SSR | Shipped | Apply the same pattern to other Phase 6 routes that lack it (config, authority, encode) — track separately as a small UI hygiene pass. |
| 7.x.9 | `data-testid` attributes on Impact components for E2E hooks | Shipped | None — picked up automatically by the cross-browser Playwright harness landed in commit `3583002`. |

**Cumulative test-budget impact**: 9 additional backend tests landed (pagination math, last-page remainder, out-of-range guard, limit cap, limit/page floors, stable jurisdiction_count, page-size resize). The Lovable-side Playwright cases (page-size change, URL persistence, empty-page guardrail) remain a follow-up on the UI side and are tracked separately. Backend test count rolled into §6 (340 total post-7.x.1).

### Phase 10A — Lovable extras + post-flight findings from `eva-foundry/user-insights-hub` (2026-04-26)

Originating spec: [docs/govops-015-self-screening.md](docs/govops-015-self-screening.md). Two Lovable post-flight passes shipped: the first added the bonuses listed below; the second introduced a privacy regression (10A.x.0) that must be corrected before the citizen-facing surface goes live.

| # | Item | Status | Follow-up |
| --- | --- | --- | --- |
| 10A.x.0 | **Privacy regression**: `src/lib/screenDraft.ts` writes the full form state (DOB, residency, legal status, evidence) to `sessionStorage` on every keystroke; restored on mount. The `screen.lede` copy ("nothing is saved") is now factually false. Violates the load-bearing privacy invariant in govops-015 ("All state is in-memory React state. The only browser storage allowed is the existing locale cookie"). | ✅ closed (2026-04-28) — `screenDraft.ts` deleted in `eva-foundry/user-insights-hub@main`; only `screenValidation.ts` + `mock-screen.ts` remain in `src/lib/`. The `screen.draft.*` keys were dropped from all 6 locales and `screen.lede` is truthful again. | None — invariant held. Backend privacy tests in `tests/test_screen.py` already assert no PII echoed; complementary Playwright assertion `expect(screenKeys).toEqual([])` shipped via 015b. |
| 10A.x.1 | Polish gap: inline `role="alert"` validation messages with `aria-describedby` + `aria-invalid` + top-of-form summary with focus-jump links. Pure validator extracted to `src/lib/screenValidation.ts`. | ✅ closed (post-flight) | None |
| 10A.x.2 | Polish gap: program name + lede still hardcoded in `PROGRAM_LABELS` table inside `screen.$jurisdictionId.tsx`. `fetchJurisdiction()` exists in `api.ts` but is not called by this route. Spec required live fetch from `/api/jurisdiction/{code}`. | ✅ closed (2026-04-28) — `screen.$jurisdictionId.tsx` route loader now calls `fetchJurisdiction(code)` with try/catch fallback to `PROGRAM_LABELS`; preview-mode badge on fallback. | None |
| 10A.x.3 | Polish gap: mojibake in `en.json` (em-dash + middle-dot were `â€”` / `Â·`). Re-encoded to U+2014 / U+00B7. | ✅ closed (post-flight) | None |
| 10A.x.4 | `LanguageSwitcher` in citizen shell header (`ScreenShell.tsx`) | Shipped | None |
| 10A.x.5 | Esc on the result card returns focus to the first form field (`#screen-dob`) | Shipped | None |
| 10A.x.6 | Backspace on empty country field deletes the residency row (`ResidencyPeriodRows.tsx`) | Shipped | None |
| 10A.x.7 | "Rerun" button on the stale result card (instead of the spec's "rerun overlay") | ✅ closed (2026-04-28) — govops-015 §Acceptance now records the inline-button UX shape with the rationale (keyboard-reachable in tab order, no absolute-positioning math). | None |
| 10A.x.8 | Translatable 404 copy via `screen.unknown_jurisdiction` for unknown jurisdiction codes | Shipped | None |
| 10A.x.9 | Hardcoded `HOWTO_URLS` per jurisdiction (real government URLs in `ScreenResult.tsx`) | Shipped — spec-compliant | Future: move to backend ConfigValue (`jurisdiction.<code>.howto_url`) once Phase 10C notification artefacts land. Track here, no immediate action. |
| 10A.x.10 | Per-rule `detail` text rendered above citation in result rows | Shipped | None — already in the contract |
| 10A.x.11 | Per-row "Remove" button on residency periods with `aria-label` | Shipped — accessibility upgrade | None |
| 10A.x.12 | Validation summary panel at form top (post-flight) — ICU plural heading (`screen.errors.summary.heading`), clickable links that scroll+focus the offending field, trims to 5 with "and N more" | Shipped (post-flight) | None — strict improvement |
| 10A.x.13 | ~~Reset confirmation `<Dialog>` with i18n keys `screen.reset.{title,body,keep,discard}` (post-flight)~~ | ✅ closed (2026-04-28) — moot after 10A.x.0; with no draft persistence there is nothing to confirm-discard. The `screen.reset.*` keys were dropped from all 6 locales as part of 015b. | None |
| 10A.x.14 | ~~Versioned snapshot + migration pipeline in `screenDraft.ts` (v1→v2) with retry-on-quota-failure backoff (post-flight)~~ | ✅ closed (2026-04-28) — deleted as part of 015b. The privacy invariant doesn't need a migration pipeline. | None |
| 10A.x.15 | Route-loader `pendingComponent` skeleton (`ScreenFormSkeleton`) with `prefers-reduced-motion` respect (no shimmer when reduced-motion is set). Shipped alongside 015a's `fetchJurisdiction()` wiring. | Shipped (2026-04-28) | None — strict UX improvement |
| 10A.x.16 | `RouteError` boundary on screen routes — graceful degradation when `fetchJurisdiction()` fails or the route loader throws. | Shipped (2026-04-28) | None |
| 10A.x.17 | Focus management on validation: clickable summary links scroll-and-focus the offending field; submit-with-errors moves focus to the summary heading. | Shipped (2026-04-28) | None — accessibility upgrade |
| 10A.x.18 | Playwright assertion that `Object.keys(sessionStorage).filter(k => k.startsWith("screen.draft")).length === 0` after a form submission (privacy invariant test). | Shipped (2026-04-28) — assertion exceeds spec by checking the strong-empty form `expect(screenKeys).toEqual([])`. | None |

**Cumulative test-budget impact for Phase 10A**: backend has 18 privacy + happy-path tests in `tests/test_screen.py`, plus 7 benefit-amount tests added in Phase 10B. Lovable post-flight pass added unit tests for the pure validator + the privacy-invariant Playwright case from 10A.x.18. All originally-blocking items closed.

### Phase 9 — About-rebuild + REPO_BASE finalization (2026-04-26 → 2026-04-28)

Originating specs: [docs/govops-016-about-rebuild.md](docs/govops-016-about-rebuild.md), [docs/govops-016a-repo-base-finalization.md](docs/govops-016a-repo-base-finalization.md). The about page is GovOps's peer-grade artefact: SPRIND framing, Agentic State citation, Law-as-Code five-element mapping, jurisdiction-first authority chain, FKTE pipeline, operating principles, "what this is not", and the read-deeper block linking back to in-repo artefacts.

| # | Item | Status | Follow-up |
| --- | --- | --- | --- |
| 9.x.1 | Page-local `InRepoAnchor` and `ExternalAnchor` helpers in `about.tsx` (instead of importing a shared component) — keeps the page self-contained, makes it easy to read end-to-end. | Shipped (2026-04-26) | If a third route needs the same affordance, hoist to `src/components/govops/`. Cosmetic until then. |
| 9.x.2 | Curly typographic quotes (U+2018 / U+2019 / U+201C / U+201D) in body copy across all 6 locales. | Shipped (2026-04-26) | None — strict polish |
| 9.x.3 | Localized dates in attribution lines (e.g. "Tallinn 2025") use locale-aware formatting via `Intl.DateTimeFormat` rather than hardcoded year strings. | Shipped (2026-04-26) | None |
| 9.x.4 | All in-repo links open in a new tab (`target="_blank" rel="noopener"`) so a SPRIND-network reader following one reference doesn't lose the about page. | Shipped (2026-04-26) | None |
| 9.x.5 | govops-016a — `REPO_BASE` defaulted to `https://github.com/eva-foundry/61-GovOps/blob/main`, new `PROJECT_HOME` constant defaulted to `https://eva-foundry.github.io/61-GovOps/`, both env-overridable; §10 prepends a "Project home" `ReferenceCard` opening in a new tab; §1 masthead exposes a "GitHub Pages" CTA next to the existing GitHub repo CTA. Three new i18n keys × 6 locales. | Shipped (2026-04-28) | None — every in-repo §10 link now resolves to a real file in `eva-foundry/61-GovOps@main`. |

### Phase 10B — Lovable extras accepted (2026-04-28)

Originating spec: [docs/govops-017-benefit-amount-card.md](docs/govops-017-benefit-amount-card.md). The card is a passive renderer over the backend's `benefit_amount` shape — no client-side rendering, no estimation, no override UI.

| # | Item | Status | Follow-up |
| --- | --- | --- | --- |
| 10B.x.1 | `BenefitAmountCard` component renders the projected amount + currency + period + i18n-aware "How is this calculated?" disclosure walking the formula trace step-by-step with citations. | Shipped (2026-04-28) — present in `src/components/govops/screen/BenefitAmountCard.tsx`, consumed inside `ScreenResult.tsx` for `/screen/$jurisdictionId` and inside `cases.$caseId.tsx` for the case-detail panel. | None — the component is read-only over the existing API, no contract surface to maintain. |
| 10B.x.2 | 20 new i18n keys × 6 locales (operator labels for every formula op + period/type/heading text). Parity verified: 116 entries match the new key prefixes per locale. | Shipped (2026-04-28) | None |

### Phase 10C — Lovable extras accepted (2026-04-28)

Originating spec: [docs/govops-018-download-decision-notice.md](docs/govops-018-download-decision-notice.md). The "Download decision" CTA opens the rendered HTML in a new tab — no Blob URLs, no client-side rendering, no localStorage; citizens use their browser's print-to-PDF for portable storage.

| # | Item | Status | Follow-up |
| --- | --- | --- | --- |
| 10C.x.1 | `DownloadDecisionButton` component with `mode="case"` and `mode="screen"` driving the existing `GET /api/cases/{id}/notice` and `POST /api/screen/notice` endpoints respectively. | Shipped (2026-04-28) — present in `src/components/govops/notices/DownloadDecisionButton.tsx`, consumed in both `screen.$jurisdictionId.tsx` and `cases.$caseId.tsx`. | None |
| 10C.x.2 | Four new i18n keys × 6 locales (`screen.download.cta` / `.in_progress` / `.error` / `.tooltip`). | Shipped (2026-04-28) | None |
| 10C.x.3 | PDF rendering deferred per ADR-012. The HTML notice is the load-bearing artefact; PDF binding choice (WeasyPrint, xhtml2pdf, headless Chrome) gets its own ADR when the demand surfaces. | Deferred by design — not a follow-up | When ready: separate ADR + dependency call (Windows pain on WeasyPrint is a real factor). |

### Phase 10D — Lovable extras accepted (2026-04-28)

Originating spec: [docs/govops-019-case-event-timeline.md](docs/govops-019-case-event-timeline.md). The case-detail surface gains an event timeline + new-event form; the supersession chain renders as a stack of decisions tied to the events that triggered them.

| # | Item | Status | Follow-up |
| --- | --- | --- | --- |
| 10D.x.1 | `EventTimeline` component renders one row per event in chronological order with type badge, payload summary, and a chip linking to the recommendation it triggered. | Shipped (2026-04-28) — present in `src/components/govops/cases/EventTimeline.tsx`, wired into `cases.$caseId.tsx`. | None |
| 10D.x.2 | `NewEventForm` component (admin-gated `<Dialog>` with field set varying by `event_type`, react-hook-form + zod validation, error toasts on `4xx` / `5xx`). | Shipped (2026-04-28) — present in `src/components/govops/cases/NewEventForm.tsx`, wired into `cases.$caseId.tsx` via `<NewEventForm caseId={caseId} onCreated={handleEventCreated} />`. | None |
| 10D.x.3 | Bonus: `PreviousDecisions` component renders the supersession chain as a stack of `<Collapsible>` sections — beyond the spec's "render the chip on each event" requirement. | ✅ closed (2026-04-28) — govops-019 §"Supersession chain rendering" now records the named component (`src/components/govops/cases/PreviousDecisions.tsx`) as part of the shipped surface, with the rationale that a named component keeps the case-detail route readable. | None |
| 10D.x.4 | 14 new i18n keys × 6 locales (`events.heading`, `events.type.*`, `events.summary.*`, `events.history.previous_decision`, `events.form.*`). | Shipped (2026-04-28) | None |

### Phase 6/7/8/9/10/11 — Lovable artefact import truthfully recorded (2026-04-28)

Earlier §12 entries marking govops-016a / 017 / 018 / 019 / 020 as "Shipped (2026-04-28)" referred to user-insights-hub state — the Lovable repo where the artefacts were authored. The **import-into-`web/` step was skipped** for that whole batch and only surfaced when CI's E2E job started exercising `web/about.spec.ts` and `web/configure-without-deploy.spec.ts` (specs that assumed the post-016a state).

The full re-import landed at commit `8a8ecde` (`phase-11: import Lovable artefacts (govops-016a/017/018/019/020) from user-insights-hub`), bringing user-insights-hub@58c529c into `web/` with surgical preservation of local-only additions:

- **Imported (229 files copied, 51 net diff after preservation)**: src/, scripts/, public/, brand/, components.json, eslint.config.js, tsconfig.json, vite.config.ts, vitest.config.ts, wrangler.jsonc, bunfig.toml, e2e/screen.spec.ts (upstream is strict superset adding govops-019 event-timeline test). All 6 locale files merged: 782 upstream keys + 304 local-only keys (walkthrough/help/runbook/dataflow/breadcrumb/home) = 843 keys per locale.
- **Preserved (local versions kept verbatim)**: package.json (govops-web name + axe + e2e scripts), playwright.config.ts (Python backend orchestration), .gitignore / .prettierignore / .prettierrc (cosmetic), web/e2e/* (9 local specs + fixtures), web/src/components/govops/{Breadcrumb,DataFlowDiagram,HelpDrawer,PageBreadcrumb,Runbook}.tsx (local features), web/src/routes/walkthrough.tsx (local route), web/src/components/govops/Masthead.tsx (Console dropdown + HelpDrawer + Walkthrough nav), web/src/routes/__root.tsx (PageBreadcrumb), web/src/components/govops/encode/ProposalCard.tsx (lock-on-terminal-state), web/src/routes/{index,cases,encode,config,config.approvals,config.prompts,admin}.tsx (Runbook + modules-section integrations).
- **Bug fixes shipped alongside**: TimelineCard date arg coerced to Date object (was passing string into `{date, date, medium}` ICU placeholder, causing RangeError on every render); about.spec.ts gotoAbout() now sets the `govops-locale` cookie before navigation (i18n provider reads cookie not query param); about.spec.ts:81 uses `.first()` on the Agentic State citation locator (page intentionally renders the citation in two places); configure-without-deploy.spec.ts uses the `BACKEND` env var (was hitting the frontend Vite dev server which doesn't have /api/screen).
- **CI fix**: ConfigStore auto-creates the parent dir of `db_path` (prior commit 2257eb7 — needed for fresh CI runners where `var/` isn't tracked).

**Verified locally before push**: Playwright chromium 76/76 green; pytest 343/343 green; OpenAPI drift gate green; Phase 2 regression guard green; schema validator clean (552 records).

**Status of the affected §12 entries**: each row that previously claimed "Shipped (2026-04-28)" was a true statement about user-insights-hub state but a **false statement about this repo until this commit landed**. The rows are kept here as provenance for the next reviewer; the failure mode they encode (PLAN claim outpacing the import) is the one this entry exists to prevent.

### Phase 12 — v0.4.0 follow-up specs queued for next Lovable batch (2026-04-28)

Three Lovable specs landed in `docs/` to seed the next Lovable cycle. Two of the three (021 + 023) shipped in user-insights-hub@4d9af640 and were re-imported here. govops-022 ships in two halves (backend prelude here, Lovable side queued).

| # | Spec | Backend | Lovable | Follow-up |
| --- | --- | --- | --- | --- |
| 12.1 | [docs/govops-021-mock-federation-cleanup.md](docs/govops-021-mock-federation-cleanup.md) — drop `mock-federation.ts` since the backend ships real `/api/admin/federation/*` endpoints | n/a (PLAN §12 8.x.3 backend already shipped) | ✅ Shipped (Lovable@4d9af640, imported) | None |
| 12.2 | [docs/govops-022-howto-url-as-configvalue.md](docs/govops-022-howto-url-as-configvalue.md) — move `HOWTO_URLS` from a hardcoded map to per-jurisdiction ConfigValue records | ✅ Shipped at commit `eec2ce0` — `jurisdiction.<code>.howto_url` ConfigValue × 6 jurisdictions, `GET /api/jurisdiction/{code}.howto_url` field, +7 tests | ⬜ Queued for next Lovable batch — read from `JurisdictionResponse.howto_url`, fall back to renamed `HOWTO_URLS_FALLBACK` | None on backend; Lovable side stays as a spec for the next batch |
| 12.3 | [docs/govops-023-ssr-head-coverage.md](docs/govops-023-ssr-head-coverage.md) — i18n the route `head()` hooks for SSR `<title>` + `<meta name="description">` | n/a | ⚠️ Partial (Lovable@4d9af640, imported) — see below | See 12.3.x.1 below |

#### 12.3.x — known limitations on the imported govops-023 surface

| # | Limitation | Status | Follow-up |
| --- | --- | --- | --- |
| 12.3.x.1 | **SSR locale wiring** — closed 2026-04-29. The original framing ("route-match context doesn't carry request cookies") was a misdiagnosis. The real failure was in `web/src/lib/ssrLocaleSync.ts` line 47: a CommonJS `require("@tanstack/react-start/server")` used to delay the server-only import threw `ReferenceError: require is not defined` in Vite's ESM SSR environment. TanStack swallowed the synchronous exception inside `executeHead`, dropped every child route's `head()` from the rendered SSR HTML stream (only the root's static head reached the wire), and the cookie path was never even attempted. Replacing the `require()` with a static top-of-file ESM import (createIsomorphicFn's transform strips the server branch from the client bundle, so the static import is the supported shape) restored child `head()` execution and the cookie path now resolves end-to-end. While here: `admin.federation.tsx` route's `head()` was missing the `({ matches })` param + `localeFromMatches(matches)` call, which would have produced an EN-only title even after the underlying fix; that was patched in the same commit. | ✅ closed (2026-04-29) — `web/e2e/ssr-head.spec.ts:52` cookie-on-SSR assertion flipped from `test.fixme` to `test`, all 9 ssr-head tests pass against the running dev server (`fr` cookie → "À propos de GovOps", `de` → "Über GovOps", `en` → "About GovOps"; `admin/federation` `fr` → "Fédération"). | None — `nav.authority` is the same word in EN and FR catalogs, so `/authority` SSR title reads "Authority" under both locales; that's a translator decision (or future content gap), not an SSR bug. |
| 12.3.x.2 | TimelineCard date-arg bug pre-exists in Lovable upstream (passes string into ICU `{date, date, medium}` placeholder, throws `RangeError: Invalid time value` on every render of /config timeline). Re-fix re-applied at the same Lovable-import boundary that re-introduced it. | ✅ Re-fixed in this import (TimelineCard.tsx:48 — `from` Date object passed in, fallback to `now` for unparseable timestamps) | When this bug re-appears in a future Lovable batch (which it will until the spec author flags it upstream): same one-line fix. Or send a Lovable spec to fix it once at source. |

**Cumulative test-budget impact for Phase 12**: backend +7 (`tests/test_api_jurisdiction_howto.py`); web vitest 51 → 53 (+2 new tests imported with the artefact); Playwright +9 SSR-head tests, all green (8 per-route + the cookie-on-SSR assertion that was previously `test.fixme` and is now active per the 2026-04-29 fix above).

#### 12.4 — i18n translation round (2026-04-29) reviewer follow-ups

The i18n translation round merged in commit `6b63caa` (PR #7) — 1,351 cells × 5 locales (fr / de / es-MX / pt-BR / uk), 0 brand-token violations, 0 empties, 0 placeholder-name mismatches. Round documentation: [docs/i18n-rounds/2026-04-29/i18n-translation-notes.md](docs/i18n-rounds/2026-04-29/i18n-translation-notes.md). Five cells are flagged in §4 of that note for native-speaker re-look — each is shipped and self-consistent, but the local register is one a native reviewer might want to nudge. Tracking here so they don't decay into invisible debt.

| # | Cell(s) | Question for native reviewer | Status |
| --- | --- | --- | --- |
| 12.4.x.1 | `home.eyebrow` (all 5 locales) | Currently kept verbatim as the literal spec string `spec govops-002 · law-as-code` (developer-only reference). Should `spec` / `law-as-code` localise, or stay verbatim? | ⬜ Open — non-blocking |
| 12.4.x.2 | `screen.benefit.op.*` (all 5 locales) | Operator/trace verb tags are lowercase verbs in fr/es/pt/uk and capitalised nouns in de (German noun convention). Confirm whether the calculation-trace UI prefers verbs (e.g. fr `ajouter`) or nominalisations (fr `Addition`). Cross-locale consistency is the lever. | ⬜ Open — non-blocking |
| 12.4.x.3 | `events.summary.add_evidence` (`+ {evidence_type}`), `events.summary.move_country` (`{from} → {to}`) | Translations are pure-placeholder by design (identical across locales). If the runtime values for `evidence_type` are EN-only, the visible string will be EN regardless of locale. Upstream concern (event-summary content), not a translation gap; tracked here so the reviewer sees the intentional choice. | ⬜ Open — upstream concern |
| 12.4.x.4 | `cases.detail.heading` fr (`Dossier {id}`) | French currently uses `Dossier {id}` to align with `nav.cases = Dossiers`. Product-team preference may be `Cas {id}` (literal cognate). This row is the single source of truth to flip. | ⬜ Open — non-blocking |
| 12.4.x.5 | `admin.federation.col.{actions [fr], name [de], status [de/pt-BR], version [fr/de]}` | Column headers re-emitted as loanwords/cognates because the source EN words are loans/cognates in those locales. Worth confirming the existing locale JSON did not intend a deeper localisation. | ⬜ Open — non-blocking |

These are explicitly **shipped, not blocking** — they're tracked so the next round of native review (or community contribution) has a concrete checklist to land against.

### Phase 8 — Lovable extras + admin federation surface (2026-04-28)

Originating spec: [docs/govops-020-admin-federation.md](docs/govops-020-admin-federation.md). The admin federation route exposes registry + imported packs + fetch form. Trust-decision authoring stays as a YAML PR per ADR-009's stance.

| # | Item | Status | Follow-up |
| --- | --- | --- | --- |
| 8.x.1 | `/admin/federation` route (`src/routes/admin.federation.tsx`, ~7.5 KB) with three sections: registered publishers, imported packs, fetch form. Trust chip per row from a `trust_state` field; signed/unsigned chip per imported pack; per-pack `Re-fetch` / `Disable` / `Enable` actions; allow-unsigned + dry-run flags on the fetch form. | Shipped (2026-04-28) | None |
| 8.x.2 | i18n keys for the federation surface — 21 new keys × 6 locales covering section headings, trust states, signed states, action labels, form labels, allow-unsigned warning. | Shipped (2026-04-28) | None |
| 8.x.3 | Backend admin endpoints powering the page: `GET /api/admin/federation/registry` (publishers + trust state), `GET /api/admin/federation/packs` (provenance + enabled), `POST /api/admin/federation/fetch/{publisher_id}?dry_run=&allow_unsigned=` (wraps `fetch_pack`, fail-closed errors → 4xx), `POST /api/admin/federation/packs/{publisher_id}/enabled` (toggle the `.disabled` sentinel). | Shipped (2026-04-28) — 14 new tests in `tests/test_api_federation.py`. | The Lovable-side mocks in `mock-federation.ts` can be removed in a follow-up commit; the page can drive directly against the real endpoints. |

**Cumulative test-budget impact for Phase 8**: 17 federation-substrate tests (`test_federation.py`) + 14 admin-HTTP tests (`test_api_federation.py`) = 31 tests for the federation pipeline end-to-end.

### Phase 12 — follow-up specs queued (2026-04-28)

Three small Lovable specs queued behind the v0.3.0 → v0.4.0 cut. Each
addresses a previously-tracked follow-up row above (PLAN §12 7.x.8 /
8.x.3 / 10A.x.9) — written now so the next Lovable batch can pick them
up without context reconstruction. None are ship-blockers; all three
are hygiene/consistency improvements over surfaces already in main.

| # | Spec | Originating row | Status |
| --- | --- | --- | --- |
| 12.x.1 | [docs/govops-021-mock-federation-cleanup.md](docs/govops-021-mock-federation-cleanup.md) — drop `web/src/lib/mock-federation.ts` and the four `try { fetcher } catch { mockX }` fallback branches in `web/src/lib/api.ts` now that `/api/admin/federation/*` is live. Pure cleanup; no UX change | 8.x.3 | Spec written, awaiting Lovable batch |
| 12.x.2 | [docs/govops-022-howto-url-as-configvalue.md](docs/govops-022-howto-url-as-configvalue.md) — move per-jurisdiction "How to apply" URL out of `HOWTO_URLS` in `ScreenResult.tsx` and into the substrate as `jurisdiction.<code>.howto_url` ConfigValues. Backend prelude (GET `/api/jurisdiction/{code}` exposing `howto_url`, six seed records, 7 tests) ships separately as a non-Lovable commit; the Lovable side reads the field with a fallback to today's table for preview parity | 10A.x.9 | Spec written; backend prelude ships in a separate commit |
| 12.x.3 | [docs/govops-023-ssr-head-coverage.md](docs/govops-023-ssr-head-coverage.md) — convert hardcoded English `head()` titles + descriptions on `/config`, `/authority`, `/encode` (and any sibling Phase 6 route still emitting hardcoded English) to use the same i18n catalog the page bodies use, via a small `web/src/lib/head-i18n.ts` helper that reads `govops-locale`. Adds a non-empty `<title>` smoke assertion per route. **No new i18n keys**; if audit shows a needed key is missing, the Lovable agent stops and requests it | 7.x.8 | Spec written, awaiting Lovable batch |

These three specs are intentionally small. The cumulative work is
~1 day of Lovable bandwidth across all three. Backend test-budget
impact: +7 tests for the govops-022 prelude (`tests/test_api_jurisdiction_howto.py`).

### Convention going forward

When Lovable (or any contributor) ships beyond a spec and the addition is accepted on merit:
1. The originating spec stays frozen as the historical contract.
2. A new row goes here under `Phase <N> — extras accepted` listing what shipped, current status, and remaining follow-up.
3. When the follow-up lands, mark the row `✅ closed` and leave the entry in place as provenance for the next reviewer.
