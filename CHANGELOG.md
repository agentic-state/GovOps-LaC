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

### Added

- L8 test-coverage closure lane: 60-action persona x action grid; per-lane
  PRs (#22-#35); cross-browser Playwright (chromium / firefox / webkit);
  axe a11y sentinels on every mutation surface; visual regression
  baselines (10 routes x 2 locales x 3 browsers, gated behind
  `RUN_VISUAL_REGRESSION=1` until Linux baselines land via
  `update-visual-snapshots.yml` workflow_dispatch).
- Encoder JSON API for the React `/encode` UI:
  `POST /api/encode/batches`, `GET /api/encode/batches`,
  `GET /api/encode/batches/{id}`,
  `POST /api/encode/batches/{id}/proposals/{pid}/review`,
  `POST /api/encode/batches/{id}/bulk-review`,
  `POST /api/encode/batches/{id}/commit`.
- `GET /api/programs/{program_id}/interactions` returning static metadata
  for cross-program rules involving the given program.
- Multi-section manual extraction: `extract_rules_manual` splits on
  `Section N.` heading lines and produces one proposal per section when
  the input text has two or more.
- Federation demo seed: `GOVOPS_SEED_FEDERATION_DEMO=1` +
  `GOVOPS_LAWCODE_DIR=...` writes a synthetic publisher + imported pack
  into a sandbox dir so the federation admin surface is exercisable
  end-to-end without operator input.
- Global jurisdiction switcher in the header, with localStorage
  persistence and auto-route swap on `/screen/{jurisdictionId}`.
- Jurisdiction chip filter on `/compare/{program_id}` wired to
  `?jurisdictions=` query param.
- Program-interactions panel on `/compare/{program_id}` rendered from the
  new interactions endpoint.

### Changed

- `extract_rules_manual` defaults to a single proposal for backward
  compatibility; multi-proposal mode is opt-in via the section-heading
  pattern.
- Prompt editor (`/config/prompts/{key}/{jur}/edit`) hydration mirrors
  `current` continuously when no localStorage draft exists, fixing the
  blank-CodeMirror mount when SSR backend is unreachable.
- API client SSR base reads `VITE_API_BASE_URL` instead of hardcoding
  `http://127.0.0.1:8000`.

### Fixed

- `/admin/federation` route renders correctly: parent admin layout now
  emits an `<Outlet />` and the registry shape is aligned with the
  backend `{ publishers: [...] }` envelope.
- Engine fallback: `dob_types` and `residency_types` resolve to canonical
  defaults when the substrate returns null.
- Validator `KEY_REGEX` permits underscores in segments so seeded prompt
  keys (`extraction_user_template`, etc.) validate.
- Mutation flow: router-loader invalidation + status-gated detail pages
  + 15s `fetcher` timeout applied across 6 mutation surfaces.
- Cookie-aware HTML rewriter for prerendered SPA so the `<title>` and
  `<html lang>` reflect the operator-locale at SSR time.

## [0.5.0] / v3 -- Program-as-Primitive (2026-04-30)

The v3 charter shipped to `main`. The 0.5.0 git tag was created but no
GitHub release was cut at the time. The 3.0.0 release notes consolidate
this work plus the post-v0.5.0 changes captured in `[Unreleased]` above.

### Added

- v3 manifest substrate (ADR-014) and `ProgramEngine` refactor.
- Employment Insurance shape + bounded-benefit primitives (ADR-017).
- EI rolled out to 6 jurisdictions (CA / BR / ES / FR / DE / UA;
  JP excluded as architectural control).
- Cross-program evaluation API (`POST /api/cases/{id}/evaluate` accepts
  `programs: [...]`) returning `program_evaluations` + interaction
  warnings (ADR-018).
- Government-leader surface at `/compare/{program_id}`, backed by
  `GET /api/programs/{id}/compare?jurisdictions=...`.
- Citizen entry surface at `/check` and `/check/life-event?event=...`,
  same privacy posture as `/api/screen`.
- Adoption substrate: `govops init <iso-code>` scaffolds a complete
  `lawcode/<code>/` skeleton; `docker compose up` brings the demo up on
  any Docker host; every program manifest has a plain-language sidecar
  via `govops docs <manifest-path>`.

### Changed

- Phase I cutover: deprecated `OASEngine` alias removed; all callers use
  `ProgramEngine` directly.
- Demo seed extended for EI cases x 6 jurisdictions when
  `GOVOPS_SEED_DEMO=1`.

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

[Unreleased]: https://github.com/agentic-state/GovOps-LaC/compare/v2.0.0...HEAD
[0.5.0]: https://github.com/agentic-state/GovOps-LaC/releases/tag/v0.5.0
[2.0.0]: https://github.com/agentic-state/GovOps-LaC/releases/tag/v2.0.0
