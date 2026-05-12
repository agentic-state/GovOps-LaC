# Changelog

All notable changes to GovOps are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The disclaimer at the top of `README.md` applies to every release: this
is an independent open-source prototype, not affiliated with any
government, department, agency, or initiative. Legislative text used in
the demo is publicly available law interpreted by the author for
illustrative purposes only.

## [Unreleased]

_No unreleased changes._

## [3.1.0] -- Lawcode-as-discovery + authoring substrate (2026-05-11)

v3.1 closes the v3.0 adoption gap. The architectural headline is
**lawcode-as-discovery**: `JURISDICTION_REGISTRY` is now built at
startup by walking `lawcode/` (ADR-020). Adding a jurisdiction no
longer requires a Python edit, and the new L7 substrate provides a
draft / approve / commit HTTP API (ADR-022) for in-app authoring of
jurisdictions and program manifests. Five playthrough bugs from the
2026-05-10 review are closed in the process.

### Added

- **ADR-019 - `jurisdiction:` metadata block** in
  `lawcode/<code>/config/jurisdiction.yaml`. Carries identity
  (country, level, localized names, legal tradition, language regime,
  default language) for the discovery loader. The `lawcode-v1.0.json`
  schema gains an optional `jurisdiction` top-level key with inline
  `$defs.jurisdictionMetadata`.
- **ADR-020 - lawcode-as-discovery loader**. New
  `build_registry_from_lawcode(lawcode_root)` walks
  `lawcode/<code>/config/jurisdiction.yaml` +
  `lawcode/<code>/programs/oas.yaml` for each jurisdiction directory;
  federation packs at `lawcode/.federated/<publisher>/` flow the same
  loader. A new `reload_registry()` rebuilds the dict in place for hot
  reload.
- **OAS program manifests for BR / ES / FR / DE / UA / JP** (6 new)
  plus a CA OAS `name.en` tweak. Each manifest carries authority
  chain, legal documents, rules, and demo cases per ADR-014.
  Plain-language sidecars (`oas.md`) are emitted alongside.
- **Jurisdiction picker on `/authority`**. URL-driven
  (`?jurisdiction=ca`); the backend `GET /api/authority-chain` accepts
  an optional `?jurisdiction_id=` and returns `available_jurisdictions`
  + `active_jurisdiction_code` so the picker hydrates from a single
  round trip.
- **`govops init` -> loader round-trip test**
  (`TestInitLoaderRoundTrip`) pins the scaffolder + loader path
  alignment so the v3.0 adoption gap stays closed.

### Changed

- **`JURISDICTION_REGISTRY` is no longer a Python literal.** It is
  built from `lawcode/` at module import. The hand-written
  `dict[str, JurisdictionPack]` at the bottom of
  `src/govops/jurisdictions.py` is gone; the 35+ call sites in
  `api.py` + `screen.py` keep working because the dict shape is
  preserved.
- **`govops init <code>`** now scaffolds the jurisdiction metadata file
  to `lawcode/<code>/config/jurisdiction.yaml` instead of
  `lawcode/<code>/jurisdiction.yaml`. This matches the path the L3
  loader reads, closing a regression where `govops init` produced a
  jurisdiction the running app could not discover.
- **`/admin` Operator runbook** "Onboard a new jurisdiction" panel
  rewritten across all 6 locales (en / fr / pt-BR / es-MX / de / uk):
  step 1 now points at `govops init`; step 2 describes filling TODO
  markers in the scaffolded YAML and notes that demo cases live in the
  program manifest. The pre-v3.1 step 2 ("Register the jurisdiction
  in src/govops/jurisdictions.py") is gone.
- **`docs/runbooks/add-jurisdiction.md`** and **`add-program.md`**
  rewritten for the lawcode-only flow. Demo cases live in
  `programs/<id>.yaml demo_cases:`, not in
  `src/govops/jurisdictions.py`.

### Fixed

- **`/cases` review action no longer silently disabled.** Pre-v3.1 the
  submit button was disabled whenever the rationale was under 20
  characters; the form looked broken with no hint. Now the button is
  always enabled, and submitting with a too-short rationale surfaces an
  inline i18n hint below the textarea.
- **`/encode` "Commit to engine" is idempotent.** Pre-v3.1 the JSON
  commit endpoint had no guard; re-clicking re-invoked the endpoint
  and a fresh `committed_rule_ids` response came back, suggesting the
  commit happened a second time. `EncodingBatch.committed_at` is now
  set on first success and subsequent attempts return `409 Conflict`.
- **`/about` "Read deeper" dead links.** Dropped the relocated
  `PLAN.md` entry (moved to `eva-foundation/plans/` under the
  visibility rule on 2026-04-30); fixed `docs/adr/` ->
  `docs/design/ADRs/`.

### Added (v3.1 L5 / L7 / L13 / L14 closeouts)

- **ADR-021 -- `/impact` groups by country.** Search across config
  records that share a citation now reports "N records across M
  countries" instead of "N jurisdictions"; the response shape carries
  `country_count` and per-result `country_code` / `country_label`.
  Each ConfigValue inside a country section preserves its
  program-scoped `jurisdiction_id` (`es-jub` vs `es-ei`) via a
  per-row chip. ADR-021 flags the forward-looking structured
  `cited_authority` URI for v4 (no code yet).
- **ADR-022 -- authoring substrate** for non-ConfigValue records.
  `DraftStore` mirrors `ConfigStore`'s draft / approve / commit
  pattern but for `jurisdiction.yaml` + program manifests. Drafts
  live in memory + file-per-draft persistence under
  `lawcode/.drafts/` (survive restart). New endpoints under
  `/api/authoring/`: `POST /drafts`, `GET /drafts`,
  `GET /drafts/{id}`, `POST /drafts/{id}/{approve,reject}`,
  `DELETE /drafts/{id}`, `POST /commit`. `commit` writes approved
  drafts to `lawcode/<code>/...` and calls `reload_registry()` +
  `clear_compare_program_cache()` so the new content is immediately
  visible on `/api/authority-chain`, `/screen`, `/compare`.
- **Operator runbook** at `/admin` gains a fourth panel "Author
  changes through the substrate API (v3.1 L7)" across all 6 locales
  describing the draft / approve / commit flow.
- **Adoption walkthrough** at `docs/adoption/HOW-TO-ADD-A-JURISDICTION.md`
  documents both paths (CLI + file edit, and substrate API).
- **Adoption E2E** at `web/e2e/adoption.spec.ts` exercises the full
  substrate flow against a fictional `xx` jurisdiction and asserts it
  becomes visible at `/authority?jurisdiction=xx` in the live UI.
- **Vitest now runs in CI** as a step in the E2E job. PR #46 (truth
  alignment) silently shipped ICU `UNCLOSED_TAG` breakage in 6 locales
  because vitest wasn't wired -- vitest catches this in 0.8s but
  Playwright doesn't because the broken keys live in surfaces the
  journey suite doesn't walk. Class-fix landed in #47 along with the
  ICU breakage repair.

### Changed

- **`govops init <code>`** scaffolds metadata to
  `lawcode/<code>/config/jurisdiction.yaml` (was top-level
  `lawcode/<code>/jurisdiction.yaml`). This closes a regression where
  a fresh scaffold produced a jurisdiction the L3 loader could not
  see. New test `TestInitLoaderRoundTrip` pins the scaffolder +
  loader path alignment.

### Not yet shipped (v3.1.x backlog)

- **L8-L12 in-app authoring UIs** (Onboard wizard, authority chain
  editor, legal documents editor, demo cases editor, program manifest
  creator). The L7 substrate API is the v3.1 surface; the wizards
  drive it in v3.1.x.
- **v3.2 substrate hardening**: per-path conflict refusal when two
  drafts target the same `target_path`, author / approver role
  separation + RBAC, structural-aware YAML emission preserving
  comments + ordering, git-commit-diff projection.

## [3.0.0] -- Program-as-Primitive (2026-05-10)

The v3 release. Consolidates the v3-charter work that shipped to `main`
on 2026-04-30 (git tag `v0.5.0`, no GitHub release at the time) plus the
post-v0.5.0 work: hosted demo deployment, mutation-flow hardening, the
M02 SSR locale fix, and the L8 test-coverage closure lane that delivers
a UI-driven Playwright suite across every persona surface.

### Added

#### v3 charter (Phases A-I, originally tagged `v0.5.0` on 2026-04-30)

- Manifest substrate (ADR-014) and `ProgramEngine` refactor.
- Employment Insurance shape + bounded-benefit primitives (ADR-017).
- EI rolled out to 6 jurisdictions (CA / BR / ES / FR / DE / UA;
  JP excluded as architectural control).
- Cross-program evaluation API: `POST /api/cases/{id}/evaluate` accepts
  `programs: [...]` and returns `program_evaluations` + interaction
  warnings (ADR-018).
- Government-leader comparison surface: `/compare/{program_id}` UI
  backed by `GET /api/programs/{id}/compare?jurisdictions=...`.
- Citizen entry surface: `/check` and `/check/life-event?event=...`,
  same privacy posture as `/api/screen`.
- Adoption substrate: `govops init <iso-code>` scaffolds a complete
  `lawcode/<code>/` skeleton; `docker compose up` brings the demo up on
  any Docker host; every program manifest has a plain-language sidecar
  via `govops docs <manifest-path>`.

#### Hosted demo + ops layer

- Single-container HF Space deployment serving the FastAPI backend +
  built React SPA + LLM proxy, with multi-provider failover
  (Groq -> OpenRouter -> Gemini -> Mistral) and daily age-based GC.
- Cookie-aware HTML rewriter for the prerendered SPA so the `<title>`
  and `<html lang>` reflect the operator-locale at SSR time (M02
  closeout).
- 55-journey HF-targeted test bench at `docs/test-bench/` with
  comparable run records and a build-artifact sanity gate.
- 10 operational runbooks at `docs/runbooks/` covering rollback,
  draft-ADR, add-jurisdiction, add-program, encoder-batch,
  federation-publish, and data-validity flows.

#### L8 test-coverage closure lane (PRs #22-#35)

- 60-action persona x action grid covering every UI-driven flow.
- Cross-browser Playwright suite (chromium / firefox / webkit), all
  green in CI.
- Form-fill fixture helpers (`web/e2e/fixtures/forms.ts`) for
  NewEventForm, ScreenForm, CheckForm.
- Federation demo seed: `GOVOPS_SEED_FEDERATION_DEMO=1` +
  `GOVOPS_LAWCODE_DIR=...` writes a synthetic publisher + imported pack
  into a sandbox dir so the federation admin surface is exercisable
  end-to-end without operator input.
- Multi-section manual extraction: `extract_rules_manual` splits on
  `Section N.` heading lines and produces one proposal per section when
  the input text has two or more (single-section input still produces
  one proposal -- backward compatible).
- Encoder JSON API for the React `/encode` UI:
  `POST /api/encode/batches`, `GET /api/encode/batches`,
  `GET /api/encode/batches/{id}`,
  `POST /api/encode/batches/{id}/proposals/{pid}/review`,
  `POST /api/encode/batches/{id}/bulk-review`,
  `POST /api/encode/batches/{id}/commit`.
- `GET /api/programs/{program_id}/interactions` returning static
  metadata for cross-program rules involving the given program.
- Global jurisdiction switcher in the header, with localStorage
  persistence and auto-route swap on `/screen/{jurisdictionId}`.
- Jurisdiction chip filter on `/compare/{program_id}` wired to
  `?jurisdictions=` query param.
- Program-interactions panel on `/compare/{program_id}` rendered from
  the new interactions endpoint.
- Post-mutation a11y sentinels (`expectNoCriticalAxeViolations`)
  propagated to every mutation spec.
- Visual regression baselines: 10 routes x 2 locales (en, fr) x 3
  browsers = 60 PNGs. Spec is gated behind `RUN_VISUAL_REGRESSION=1`
  in CI; Linux baselines via `update-visual-snapshots.yml`
  workflow_dispatch.

### Changed

- Phase I cutover: deprecated `OASEngine` alias removed; all callers use
  `ProgramEngine` directly.
- Demo seed extended for EI cases x 6 jurisdictions when
  `GOVOPS_SEED_DEMO=1`.
- Prompt editor (`/config/prompts/{key}/{jur}/edit`) hydration mirrors
  `current` continuously when no localStorage draft exists, fixing the
  blank-CodeMirror mount when SSR backend is unreachable.
- API client SSR base reads `VITE_API_BASE_URL` instead of hardcoding
  `http://127.0.0.1:8000`.
- Test count: 678 backend tests on Python 3.10 / 3.11 / 3.12.

### Fixed

- `/admin/federation` route renders correctly: parent admin layout now
  emits an `<Outlet />` and the registry shape is aligned with the
  backend `{ publishers: [...] }` envelope.
- Engine fallback: `dob_types` and `residency_types` resolve to
  canonical defaults when the substrate returns null.
- Validator `KEY_REGEX` permits underscores in segments so seeded
  prompt keys (`extraction_user_template`, etc.) validate.
- Mutation flow: router-loader invalidation + status-gated detail
  pages + 15 s `fetcher` timeout applied across 6 mutation surfaces.

### Removed

- `OASEngine` alias (deprecated in v2.0, removed at Phase I cutover).

## [2.0.0] -- Law as Code reference implementation (2026-04-29)

Initial public release. The build narrative (Phases 0-12) was squashed
at launch; `PLAN.md` (later relocated to
`eva-foundation/plans/PLAN-p61-v2.md`) carried the entry/exit criteria
for each phase.

### Added

- 7 jurisdictions (CA / BR / ES / FR / DE / UA / JP) and 6 locales
  (en / fr / pt-BR / es-MX / de / uk).
- Dated `ConfigValue` substrate: every parameter the engine resolves
  (thresholds, accepted statuses, calculation coefficients, prompts)
  lives as a dated record under `lawcode/`.
- Deterministic rule engine with seven rule types, including typed-AST
  `calculation`. Embedded SQLite persistence; YAML is the source of
  truth.
- Citizen self-screening (`/screen`), case dashboard with event timeline
  and benefit-amount card, citation impact search (`/impact`),
  decision-notice rendering, life-event reassessment.
- Federation pipeline: Ed25519-signed lawcode packs (ADR-009).
- AI-assisted encoding pipeline (statute text -> candidate rules ->
  human review -> commit-ready YAML).
- ConfigValue admin UI: search, timeline, diff, draft, dual approval,
  prompt admin at `/config` and `/admin/federation`.
- 423 backend tests (Python 3.10 / 3.11 / 3.12), 53 web vitest tests,
  cross-browser Playwright + axe E2E.

[Unreleased]: https://github.com/agentic-state/GovOps-LaC/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/agentic-state/GovOps-LaC/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/agentic-state/GovOps-LaC/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/agentic-state/GovOps-LaC/releases/tag/v2.0.0
