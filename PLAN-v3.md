# GovOps PLAN-v3.md — Program as Primitive

**Status**: In flight — Phase A starting
**Branch**: `feat/program-as-primitive` (created at v3 kickoff)
**Charter**: [docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md](docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md)
**Predecessor**: v2.0 (Law-as-Code) shipped as v0.4.0 on `main`
**Baseline tag**: `v0.4.0` (rollback point)
**License**: Apache 2.0 (preserved)

> This document is the v3 operational plan. The charter is the strategic argument; this doc is what gets executed and tracked. If the two ever conflict, this doc wins for execution and the charter wins for intent — open an ADR to reconcile.

---

## 1. Where we start (baseline truth, 2026-04-29)

| Fact | Value | Source |
| --- | --- | --- |
| Test count | **375** (engine: 14, api: 36, encoder: 15, config: 18, api_config: 15, plus v2 phase tests) | `pytest -q` |
| Jurisdictions | 7 (CA, BR, ES, FR, DE, UA, JP) | `JURISDICTION_REGISTRY` in `src/govops/jurisdictions.py` |
| Active for v3 (in scope for symmetric extension) | 6 (CA, BR, ES, FR, DE, UA) | charter §"The proof" |
| Untouched (architectural control) | 1 (JP) | charter §"The proof" |
| Languages | 6 (en, fr, pt-BR, es-MX, de, uk) | `web/src/messages/` |
| Rule types | 7: `age_threshold`, `residency_minimum`, `residency_partial`, `legal_status`, `evidence_required`, `exclusion`, `calculation` | `RuleType` enum in `src/govops/models.py` |
| Programs modelled | 1 (Old Age Security, CA-shaped across all 7 jurisdictions) | `src/govops/seed.py` + `src/govops/jurisdictions.py` |
| Engine class | `OASEngine` — explicitly Old-Age-Security-shaped | `src/govops/engine.py` |
| Persistence | SQLite from Phase 6 (ADR-010); YAML under `lawcode/` is the authored source-of-truth | `src/govops/config.py` |
| Encoder | Working pipeline: ingest → extract (LLM) → review → commit | `src/govops/encoder.py` |
| Disclaimer | Not gov-affiliated; statutory text used illustratively | [README.md](README.md) |

### Architectural signal worth naming

The ConfigValue substrate already namespaces parameters by `<jurisdiction>-<program>` (e.g. `jurisdiction_id: ca-oas` in `lawcode/ca/config/rules.yaml`). v3 makes that *implicit* program-scoping *explicit* at the manifest layer. The substrate stays exactly as it is; v3 adds a manifest layer above it.

---

## 2. v3 thesis (one paragraph)

`Program` becomes a first-class declarable thing, the way v2 made `jurisdiction` one. A program is a YAML manifest under `lawcode/<jurisdiction>/programs/<program-id>.yaml`; the engine reads it; the substrate resolves its parameters. Adding a program once causes it to appear in every jurisdiction that adopts the manifest. The proof is **Employment Insurance** instantiated symmetrically across the 6 active jurisdictions (CA, BR, ES, FR, DE, UA). **JP stays untouched** — the architectural control. New audiences enter the pipeline: government leaders get a cross-program / cross-jurisdiction comparison surface; citizens get an entry path ("what am I entitled to?") plus one life-event reassessment example (job loss → EI). The "Unix of Public Sector" thesis becomes load-bearing: small composable primitives, universal interface, anyone can fork the shape library and run their own.

---

## 3. Decision gates (lock before the phase begins)

| # | Gate | Recommendation | Lock by | Status |
| --- | --- | --- | --- | --- |
| 1 | Program manifest format | YAML, schema-validated, mirrors v2 lawcode/ pattern | End of Phase A | **LOCKED** — ADR-014 |
| 2 | Canonical program shape library | Published JSON Schemas (`old_age_pension`, `unemployment_insurance`, …) — POSIX-style interface | End of Phase A | **LOCKED** — ADR-015 |
| 3 | Engine refactor scope | Rename `OASEngine` → `ProgramEngine`; decouple pension-shaped outcome logic from program-agnostic dispatch; preserve byte-identical CA OAS output | End of Phase B | Pending ADR-016 |
| 4 | New rule primitives for EI | `BENEFIT_DURATION_BOUNDED`, `ACTIVE_OBLIGATION` (drives bounded-period timeline + obligation surface) | End of Phase C | Pending ADR-017 |
| 5 | Cross-program evaluation API shape | `POST /api/cases/{id}/evaluate` accepts `programs: [oas, ei]`; per-program slot in audit package | End of Phase E | Pending ADR-018 |
| 6 | JP exclusion is permanent for v3 | Reaffirmed: JP stays as architectural control; symmetric extension is opt-in for adopters | Charter (locked 2026-04-29) | **LOCKED** — charter |
| 7 | Citizen surface scoping | Entry path + ONE life-event reassessment example only; account / identity / proactive notifications is v4 | Charter (locked 2026-04-29) | **LOCKED** — charter |

Record gate decisions as ADRs in `docs/design/ADRs/`.

---

## 4. Phase plan with nested D3PDCA

Outer-loop D3PDCA for v3 as a whole:

- **Discover** ✅ — v2 retrospective ("what didn't v2 prove"); inventory of existing rule shape; substrate already program-namespaced
- **Design** ✅ — charter committed: program-as-primitive, EI proof, JP control, 4 audiences
- **Decide** ✅ — gates 1, 2, 6, 7 locked; gates 3, 4, 5 deferred to phase entry
- **Plan** ⬅ this document
- **Do** — Phases A through I below; each phase has its own nested D3PDCA
- **Check** — per-phase exit gate + final v3 cutover gate
- **Act** — promote reusable primitives (program manifest, shape library, comparison surface, citizen entry) so v4 starts with a richer floor

Each phase below carries its own inner D3PDCA. Tests must stay green at every exit.

### Phase A — Manifest substrate (4 days)

**Discover**: rule shape today is `LegalRule` Pydantic instances built in `seed.py` / `jurisdictions.py`; ConfigValue substrate already program-scoped via `<jur>-<prog>` jurisdiction_id; `lawcode/<jur>/config/` houses dated parameter values; `lawcode/<jur>/jurisdiction.yaml` houses jurisdiction-level metadata.

**Design**: introduce `lawcode/<jur>/programs/<program-id>.yaml` — a program manifest with `program_id`, `shape` (catalog reference), `authority_chain`, `legal_documents`, `rules` (each rule references substrate keys via `param_key_prefix`), `demo_cases`. ConfigValue substrate stays unchanged.

**Decide**: ADR-014 (manifest model + YAML shape), ADR-015 (shape library).

**Plan**: this phase.

**Do**:
- Author `schema/program-manifest-v1.0.json`
- Author `schema/program-shape-v1.0.json` (the meta-schema for shape catalog entries)
- Author canonical shapes: `schema/shapes/old_age_pension-v1.0.yaml`, `schema/shapes/unemployment_insurance-v1.0.yaml` (the latter ships skeleton, fleshed out in Phase C)
- Write `src/govops/programs.py` — `Program` model + `load_program_manifest(path)` loader
- Migrate CA OAS to `lawcode/ca/programs/oas.yaml` as a parallel path; existing `seed.py` import still works
- CI step: validate every `lawcode/*/programs/*.yaml` against the schema

**Check**: 375 tests still green; new tests cover program-manifest round-trip (load → produce LegalRule list → identical to seed.py output for CA OAS); CI YAML validation passes.

**Act**: schema published as `schema/program-manifest-v1.0.json`; `lawcode/CONTRIBUTING.md` updated with "how to add a program".

**Exit**: CA OAS loadable from manifest with byte-identical engine output to current `seed.py`-based path.

**Artefacts**: `schema/program-manifest-v1.0.json`, `schema/shapes/*.yaml`, `src/govops/programs.py`, `tests/test_programs.py` (~15 tests), `lawcode/ca/programs/oas.yaml`, ADR-014, ADR-015.

### Phase B — Engine generalization: `OASEngine` → `ProgramEngine` (3 days)

**Discover**: `OASEngine._determine_outcome` hardcodes pension-type ("full"/"partial") and 40-year ratio; `Recommendation.pension_type` field is OAS terminology; `DemoStore.seed()` takes one rule list.

**Design**: rename engine; pension-type computation becomes a *shape-specific* post-processor (the OAS shape's contribution), not a property of the engine; `Recommendation` keeps `pension_type` for backwards-compat but adds `program_id` and `program_outcome_detail: dict` for shape-specific output.

**Decide**: ADR-016 (engine refactor scope).

**Plan**: this phase.

**Do**:
- Rename `OASEngine` → `ProgramEngine` (keep `OASEngine` as deprecated alias for one cycle)
- Move pension-type logic into `src/govops/shapes/old_age_pension.py`
- Add `Program` model to `models.py`; `DemoStore` accepts list of programs; legacy `seed()` still works
- Recommendation gets `program_id`, `program_outcome_detail`
- All existing OAS tests pass byte-identically

**Check**: 375 tests + new program-engine tests; deprecation warnings emit but don't fail; old `OASEngine(rules=…)` still works.

**Act**: deprecation note in `CLAUDE.md`; one-cycle removal scheduled for v3.1.

**Exit**: `ProgramEngine(program=ca_oas).evaluate(case)` produces identical recommendation to today's `OASEngine(rules=oas_rules).evaluate(case)`.

**Artefacts**: refactored `engine.py`, new `src/govops/shapes/old_age_pension.py`, `tests/test_program_engine.py` (~10 tests), ADR-016.

### Phase C — EI canonical shape + new primitives (5 days)

**Discover**: EI requires bounded benefit duration (weeks of benefit, not lifetime status), active job-search obligation, contribution-period qualifying rules. None exist as engine primitives today.

**Design**:
- New `RuleType.BENEFIT_DURATION_BOUNDED` — produces a `BenefitPeriod` (start, end, weeks_remaining) when the case is eligible
- New `RuleType.ACTIVE_OBLIGATION` — surfaces an obligation list on the recommendation; doesn't gate eligibility, but populates `Recommendation.active_obligations: list[ActiveObligation]`
- `BenefitPeriod` model (replaces single-shot `BenefitAmount` for time-bounded programs; the two coexist)
- Canonical `unemployment_insurance` shape published in `schema/shapes/unemployment_insurance-v1.0.yaml`

**Decide**: ADR-017 (new rule primitives).

**Plan**: this phase.

**Do**:
- Add `BENEFIT_DURATION_BOUNDED`, `ACTIVE_OBLIGATION` to `RuleType` enum
- Add `BenefitPeriod`, `ActiveObligation` models
- Engine dispatch for the two new types
- Shape: `src/govops/shapes/unemployment_insurance.py`
- Hermetic tests for the new types (no jurisdiction yet)

**Check**: 385+ tests green; new types covered with isolation tests; OAS path untouched.

**Act**: shape published.

**Exit**: a synthetic test program built from the unemployment_insurance shape evaluates against a synthetic case and produces a `BenefitPeriod` of N weeks plus an obligation list.

**Artefacts**: extended `models.py` + `engine.py`, `src/govops/shapes/unemployment_insurance.py`, `tests/test_shape_unemployment_insurance.py` (~20 tests), ADR-017.

### Phase D — EI rollout to 6 jurisdictions (5 days)

**Discover**: each jurisdiction has its own EI authority chain, statutory text, parameter values, and language. §12.4 native-speaker review backlog (5 cells) overlaps with the EN/FR/DE/ES/PT/UK authoring path; folding the review into the EI rollout is cheaper than a separate pass.

**Design**: parallel manifest authoring across 6 jurisdictions; substrate values per jurisdiction; i18n keys for EI in all 6 locales authored from authoritative sources.

**Decide**: no ADR — all decisions are content-level, not architectural.

**Plan**: 6 jurisdictional packages, authored in parallel where possible.

**Do** (per jurisdiction × 6):
- `lawcode/<jur>/programs/ei.yaml` — manifest (authority chain, legal documents, rules referencing the EI shape, demo cases)
- `lawcode/<jur>/config/ei-rules.yaml` — ConfigValue records for EI parameters (`<jur>-ei.rule.<rule-id>.<param>`)
- i18n keys: program name, eligibility decision strings, obligation labels, week-count formats — in all 6 locales
- §12.4 native-speaker review pass folded into the EI rollout (closing the backlog)
- 4 demo cases per jurisdiction (eligible, ineligible, partial duration, insufficient evidence) — 24 total
- JP explicitly excluded — no `lawcode/jp/programs/ei.yaml`

**Check**: 415+ tests green; YAML schema validation passes; ICU MessageFormat validation passes for new EI keys; cross-jurisdiction parity test confirms each of the 6 has a complete EI manifest.

**Act**: §12.4 backlog closed.

**Exit**: a CA-EI demo case, a BR-Seguro-Desemprego demo case, an ES-Prestación demo case, a FR-Allocations demo case, a DE-Arbeitslosengeld demo case, and a UA-Допомога demo case all evaluate cleanly through the engine and return a BenefitPeriod + obligation list.

**Artefacts**: 6 × (program manifest + config YAML + i18n keys + demo cases); CI parity test.

### Phase E — Cross-program evaluation (3 days)

**Discover**: today `POST /api/cases/{id}/evaluate` is implicit-OAS; one rec per case. v2's `recommendation_history` already supports a chain.

**Design**: API accepts `programs: [oas, ei]`; engine evaluates each program against the case; audit package returns `program_evaluations: list[Recommendation]`; program-interaction warnings surface when two programs conflict (e.g. EI + OAS for same claimant — locale-specific rules).

**Decide**: ADR-018 (cross-program evaluation API shape).

**Plan**: this phase.

**Do**:
- API: `POST /api/cases/{id}/evaluate` body grows `programs: list[str]` (default: all programs registered for the case's jurisdiction)
- `AuditPackage.program_evaluations: list[Recommendation]`
- `ProgramInteractionWarning` model — emitted when two programs' rules conflict
- Tests: a case eligible for both OAS and EI in CA, with the program-interaction warning surfaced

**Check**: 425+ tests green.

**Act**: ADR-018 lands.

**Exit**: one case, one POST, returns per-program eligibility + warnings if any.

**Artefacts**: API extension, `tests/test_cross_program.py` (~10 tests), ADR-018.

### Phase F — Government-leader comparison surface (4 days)

**Discover**: no cross-jurisdiction comparison surface exists today.

**Design**: new web route `/compare/<program-id>` shows EI side-by-side across the 6 jurisdictions. Parameter diffs (contribution period, max weeks, replacement rate) rendered as a table. Authority comparison surface. Government-leader audience entry point.

**Decide**: no ADR — UI-only.

**Plan**: this phase.

**Do**:
- New TanStack route `web/src/routes/compare.$programId.tsx`
- New backend endpoint `GET /api/programs/<id>/compare?jurisdictions=ca,br,es,fr,de,ua`
- Returns aligned parameter table + authority chain
- Empty state for JP ("excluded by design — see charter")

**Check**: a11y axe AA pass; Playwright E2E spec; 6 locales of i18n keys.

**Act**: comparison surface enters the included-by-default floor for any future program.

**Exit**: `http://localhost:8080/compare/ei` renders the 6-jurisdiction comparison with parameter diffs.

**Artefacts**: web route, backend endpoint, Playwright spec, i18n keys.

### Phase G — Citizen entry + life-event reassessment (4 days)

**Discover**: v2 has no citizen-facing surface; existing UI is officer-facing.

**Design**: new web route `/check` ("what am I entitled to?") — entry surface that asks the citizen jurisdiction + a small set of facts (age, employment status, residency years) and returns the program list with eligibility per program. One life-event example: "I just lost my job" → EI reassessment with bounded-duration timeline visualization.

**Decide**: no ADR — UI surfaces v3 citizen scope cap.

**Plan**: this phase.

**Do**:
- TanStack routes `web/src/routes/check.tsx` and `web/src/routes/check.life-event.tsx`
- Bounded-duration timeline component (reusable for any time-bounded program)
- Backend: hits existing `POST /api/screen` (Phase 10A from v2) extended for multi-program; uses `POST /api/cases/{id}/events` (Phase 10D) for the life-event flow
- Strict scoping: ONE life-event example (job loss → EI). No account, no identity, no notifications. Anything else = v4.

**Check**: a11y axe AA pass; Playwright E2E for entry path + life-event path; 6 locales.

**Act**: bounded-duration timeline component promoted to shared library.

**Exit**: a citizen can land on `/check`, declare facts, see "you may be eligible for OAS and/or EI in CA," click "I just lost my job," and see EI reassessment with a 35-week timeline.

**Artefacts**: web routes + components, backend extensions, Playwright specs, i18n keys.

### Phase H — Adoption substrate (the Unix bit, 3 days)

**Discover**: today running GovOps requires Python + Node + Bun + manual venv. Adoption barrier is real for non-engineers.

**Design**: `govops init <country-code>` CLI scaffolds a new jurisdiction from the canonical shape catalog; `docker compose up` brings up the demo without language-runtime ceremony; plain-language doc beside each YAML lets a non-coder program leader review encoded rules.

**Decide**: no ADR (substrate-only).

**Plan**: this phase.

**Do**:
- CLI: `govops init <iso-country-code> --shapes oas,ei` writes `lawcode/<code>/jurisdiction.yaml` + `programs/oas.yaml` + `programs/ei.yaml` from shape templates with `TODO` markers
- `docker-compose.yml` at repo root: `api` (FastAPI) + `web` (Next.js dev server) + volume mount for `lawcode/`
- Plain-language doc convention: each `lawcode/<jur>/programs/<id>.yaml` has a sibling `<id>.md` with the same content rendered for non-coders
- README hero updated: "Add your country in 5 minutes"

**Check**: end-to-end test: a contributor with neither Python nor Node installed runs `docker compose up` and sees the running demo; `govops init` produces a schema-valid skeleton.

**Act**: shape library + init CLI become the adoption story.

**Exit**: `docker compose up` brings up the live demo on a clean machine with only Docker installed.

**Artefacts**: `src/govops/cli_init.py`, `docker-compose.yml`, `Dockerfile`, plain-language docs alongside YAMLs, README updates.

### Phase I — Floor + cutover (2 days)

**Discover**: v3 needs the same enterprise floor v2 has; some pieces (a11y, E2E, security) are interleaved into earlier phases — this phase is the closure check.

**Design**: floor checklist is absolute; cutover replaces v0.4.0 as `latest`.

**Decide**: no ADR.

**Plan**: this phase.

**Do**:
- Demo seed extended: `GOVOPS_SEED_DEMO=1` includes EI demo cases for all 6 jurisdictions
- a11y full sweep across new surfaces (`/compare`, `/check`, `/check/life-event`)
- E2E suite: 3 browsers × all new flows
- gitleaks + CodeQL coverage extended
- Drop deprecated `OASEngine` alias from Phase B
- Tag `v0.5.0`; update `CLAUDE.md`, `README.md`, GitHub Pages
- §12.4 native-speaker review backlog confirmed closed

**Check**: full suite green; a11y zero criticals; security scans clean.

**Act**: v0.5.0 release; charter "test sentence" review pass — does the one-sentence pitch read "obvious and useful" to a fresh program leader?

**Exit**: v3 ships as v0.5.0 on `main`.

**Artefacts**: release tag, updated docs, retired deprecated symbols.

---

## 5. Cumulative timeline

| Block | Days | Cumulative |
| --- | ---: | ---: |
| A. Manifest substrate | 4 | 4 |
| B. ProgramEngine generalization | 3 | 7 |
| C. EI shape + new primitives | 5 | 12 |
| D. EI rollout × 6 jurisdictions | 5 | 17 |
| E. Cross-program evaluation | 3 | 20 |
| F. Comparison surface | 4 | 24 |
| G. Citizen entry + life-event | 4 | 28 |
| H. Adoption substrate | 3 | 31 |
| I. Floor + cutover | 2 | 33 |

~33 working days. At evening/weekend pace: ~10–12 calendar weeks.

---

## 6. Test budget per phase (non-regression target)

| Phase | Target test count | Notes |
| ---: | ---: | --- |
| Start | 375 | baseline at v0.4.0 |
| A | ~390 | + manifest loader, schema validation, CA OAS round-trip |
| B | ~400 | + ProgramEngine, multi-program store, deprecation tests |
| C | ~420 | + new rule types in isolation, unemployment_insurance shape |
| D | ~450 | + 6 EI demo flows × eligibility paths; ICU parity |
| E | ~460 | + cross-program eval + interaction warnings |
| F | ~470 | + Playwright comparison-surface specs |
| G | ~480 | + citizen entry + life-event Playwright specs |
| H | ~485 | + CLI init tests; docker-compose smoke |
| I | ~485 | regression-only, cutover gate |

Tests must stay green at every phase exit. CI matrix stays at Python 3.10/3.11/3.12.

---

## 7. Non-goals (preserved from charter)

- **Sub-national jurisdictions** (provinces, Länder, régions) — v4 axis. Same symmetry rule will apply, but stacking it on v3 doubles the surface.
- **Ed25519 federation between running instances** — defer until a real peer instance signs up to run.
- **Adjacent domains** (immigration eligibility, occupational licensing, tax credits) — each is a new shape, each its own v3-sized bet.
- **Citizen account / identity / proactive notifications** — v4 citizen track.
- **Production hardening** (managed Postgres, multi-tenant, AuthN/AuthZ at scale, full observability stack) — GovOps remains an MVP demo for contributors to clone and run.
- **JP extension** — JP stays as the architectural control. Adding `lawcode/jp/programs/ei.yaml` requires explicit re-approval.
- **Citizen-surface sophistication beyond v3 cap** — entry path + ONE life-event example only. Anything else = v4.

---

## 8. Success criteria

Mapped from the charter:

- [ ] 1. A program is a YAML manifest under `lawcode/<jur>/programs/<id>.yaml` and the engine reads it
- [ ] 2. Adding a program once causes it to appear in every jurisdiction that adopts the manifest (proven by EI × 6)
- [ ] 3. Canonical shape library published — `schema/shapes/old_age_pension.yaml`, `schema/shapes/unemployment_insurance.yaml` — and anyone can fork it
- [ ] 4. Bounded-duration timeline + active-obligation surface land as reusable primitives, not EI-specific code
- [ ] 5. Cross-program evaluation API returns per-program slots in one POST
- [ ] 6. Government-leader comparison surface renders EI side-by-side across the 6 jurisdictions with parameter diffs
- [ ] 7. Citizen entry path ("what am I entitled to?") + one life-event reassessment example (job loss → EI) lands
- [ ] 8. Adoption substrate: `govops init <country>` + `docker compose up` brings up a demo on a clean machine
- [ ] 9. §12.4 native-speaker review backlog folded into EI rollout, not standalone after-work
- [ ] 10. JP untouched — architectural control intact
- [ ] 11. v3 charter "test sentence" reads "obvious and useful" to a fresh Public Sector Program Leader

---

## 9. Risk register (kept live; update as phases progress)

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Phase B engine refactor breaks subtle OAS behavior (timezone, partial-ratio, formula AST) | Medium | High | Byte-identical regression test against current 375 tests as Phase B exit gate; deprecated alias for one cycle |
| EI rollout to 6 jurisdictions runs into translation/citation gaps | Medium | Medium | Author EN authoritative pass first, then per-locale; §12.4 native-speaker review folded in |
| Bounded-duration primitive reveals modeling gaps under contribution-period interactions | Medium | Medium | Phase C ships isolation tests before Phase D rollout; spike during Phase A schema authoring |
| Citizen-surface scope creep | High | Medium | Charter explicitly caps; reject any "while we're there" additions; push to v4 |
| Comparison surface UX gets too dense (6 columns × N parameters) | Medium | Low | Default-collapse less-critical params; expandable diff cells |
| Docker-compose adoption substrate adds host-platform heisenbugs | Medium | Medium | Test on fresh Windows/macOS/Linux; document fallbacks |
| `OASEngine` deprecation breaks downstream consumers | Low | Low | Keep alias for one cycle; emit warning; document removal in v3.1 |
| §12.4 review backlog stays open (nobody available to do native pass) | Medium | Low | Acceptable to ship Phase D with backlog flagged; closure target is Phase I; not a hard blocker |
| JP scope leaks into v3 ("just add EI for JP, it's easy") | Low | Medium | Charter is explicit; reject without re-approval; the architectural control is itself a feature |

---

## 10. Branch and commit strategy

- All v3 work lands on `feat/program-as-primitive` until Phase F exit, then evaluate squash-vs-merge into `main` (v0.5.0).
- Per-phase tags: `v3-phase-<letter>-complete` after each phase exit.
- Every ADR is a separate commit in `docs/design/ADRs/` referencing the gate or decision it captures.
- Commit message convention: `phase-<letter>(v3): <imperative>` (e.g. `phase-a(v3): add Program manifest loader`).
- Conventional Commits preserved.
- Tests must stay green at every commit — pre-commit pytest hook stays in force (project `.claude/settings.json`).

---

## 11. Out-of-scope items (do not let these creep in)

Restated from charter §"Out of scope for v3":

- Sub-national jurisdictions → v4
- Ed25519 federation → defer until real peer commits
- Adjacent domains (immigration, licensing, tax) → each is its own v3-sized bet
- Citizen account / identity / proactive notifications → v4 citizen track
- Production hardening → not a goal
- JP extension → architectural control, requires explicit re-approval
- Citizen-surface sophistication beyond entry + 1 life-event → v4

---

## 12. Open follow-ups (non-blocking)

Will be populated as phases progress.

---

## 13. Predecessor reference

v2.0 plan: [PLAN.md](PLAN.md). Phases 0–10 + §11 scalar-seam closure all shipped as v0.4.0. v3 builds on top — substrate, calculation engine, formula AST, federation, decision-notice rendering, life-event reassessment all stay as-is.
