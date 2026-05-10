# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**GovOps** is a Policy-Driven Service Delivery Machine — an open public-good contribution that turns authoritative governance sources (law, regulation, policy) into executable, traceable, auditable service logic.

Built on **FKTE** (Fractal Knowledge Transformation Engine):
`unstructured knowledge -> structured knowledge -> executable knowledge -> operational action`

**Disclaimer (load-bearing for any docs work)**: This is an independent open-source prototype. It is **not affiliated with, endorsed by, or representing any government, department, or public agency**. Legislative text is publicly available law interpreted by the author for illustrative purposes — not authoritative operational guidance. Preserve this framing in any user-facing changes.

## Active Track

**Program-as-Primitive v3.0** has cut over. Phases A–I all shipped on `main`: manifest substrate, ProgramEngine refactor, EI canonical shape + bounded-benefit primitives, EI rollout to 6 jurisdictions (JP excluded as architectural control), cross-program evaluation API with interaction warnings, government-leader `/compare` surface, citizen `/check` + `/check/life-event`, adoption substrate (`govops init` + `docker compose up` + plain-language sidecars), and Phase I cutover (deprecated `OASEngine` alias removed, demo seed extended for EI cases × 6 jurisdictions). Charter (delivered): [docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md](docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md). Operational plans (internal, in workspace memory): `eva-foundation/plans/PLAN-p61-v3.md` (v3 plan) + `eva-foundation/plans/PLAN-p61-v2.md` (legacy v2 plan retained for §12.x follow-ups). v2.1 (hosted demo) is the parallel agent's lane. ADRs land in [docs/design/ADRs/](docs/design/ADRs/). Plans relocated 2026-04-30 from this repo per the visibility rule -- this repo carries delivered artifacts only (README, ADRs, code, charter, CHANGELOG via tags).

## Current State

7 jurisdictions (CA/BR/ES/FR/DE/UA/JP), 6 languages (en/fr/pt/es/de/uk), **640 backend tests passing**. Two programs canonicalized: Old Age Security (all 7 jurisdictions, encoded from each country's own statutes — not a literal export of Canada's OAS Act) and Employment Insurance (6 jurisdictions — JP excluded as v3 architectural control). Cross-program evaluation API live: `POST /api/cases/{id}/evaluate` accepts an optional `programs: [...]` body and returns `program_evaluations` + interaction `warnings` per ADR-018. Comparison surface live at `/compare/<program-id>` backed by `GET /api/programs/{id}/compare?jurisdictions=...`. Citizen entry surface live at `/check` and `/check/life-event?event=job_loss` backed by `POST /api/check` — same privacy posture as `/api/screen`. Adoption substrate live: `govops init <iso-code>` scaffolds a complete `lawcode/<code>/` skeleton; `docker compose up` (root `docker-compose.yml` + `docker/{api,web}.Dockerfile`, distinct from the v2.1 hosted-demo `Dockerfile`) brings up the two-process demo on any Docker host; every program manifest has a plain-language sidecar rendered by `govops docs <manifest-path>`. Phase I cutover removed the deprecated `OASEngine` alias — all callers now use `ProgramEngine` directly; `GOVOPS_SEED_DEMO=1` populates EI demo cases alongside OAS for visitor-facing surfaces.

**Backend (Python / FastAPI):**
- Deterministic rule engine for pension eligibility (age, residency/contribution, legal status, evidence)
- Full authority chain traceability from Constitution through to service decision
- Human review workflow: approve, modify, reject, request info, escalate
- Complete audit trail with statutory citations
- AI-assisted rule encoding pipeline (legislative text → proposed rules → human review → commit)
- **Phase 1 substrate**: ConfigValue + ConfigStore in `src/govops/config.py`, read-only API at `/api/config/values`, `/resolve`, `/versions`. Per-parameter granularity ([ADR-006](docs/design/ADRs/ADR-006-per-parameter-granularity.md)), in-memory storage ([ADR-007](docs/design/ADRs/ADR-007-in-memory-storage.md))
- One-command demo: `govops-demo`

**Frontend (React / TanStack Start, in `web/`):**
- Modern web UI under `web/`, maintained directly in this repo
- Stack: Vite + React 19 + TanStack Start (SSR) + Tailwind v4 + shadcn/ui + react-intl (ICU MessageFormat) + lucide-react + react-hook-form/zod + CodeMirror + react-diff-viewer-continued
- All Phase 6 surfaces shipped: shell, ConfigValue admin (search/timeline/diff/draft/approvals/prompts), cases, authority, encoder, admin
- 6 locales × ~511 keys; ICU validation runs as `prebuild`
- Ships against the live FastAPI; mock fallback for endpoints not yet in backend

## Running and Testing

### Backend
```bash
pip install -e ".[dev]"
govops-demo                                    # http://127.0.0.1:8000
govops-demo --reload                           # auto-reload for development
govops-demo --port 9000                        # custom port

pytest -q                                      # all 561 tests
pytest tests/test_engine.py -v                 # one file
pytest tests/test_engine.py::test_name -v      # one test
pytest -k "residency" -v                       # by keyword
```

### Frontend (`web/`)
```bash
cd web
npm install                                    # or bun install (lockfile present)
npm run dev                                    # http://localhost:8080
npm run build                                  # vite build (SSR + client)
npm run check:i18n                             # ICU MessageFormat + key parity
npm run lint                                   # eslint + prettier
npm test                                       # vitest unit tests
```

### E2E (Playwright + axe, in `web/`)
```bash
cd web
npm run test:e2e:install                       # one-time: Chromium/Firefox/WebKit (~300 MB)
npm run test:e2e                               # full headless suite, all 3 browsers
npm run test:e2e:headed                        # browser visible (debugging)
npm run test:e2e:ui                            # interactive Playwright UI mode
npm run test:e2e:report                        # open last HTML report
```

`web/playwright.config.ts` auto-orchestrates the backend
(`uvicorn govops.api:app`) and the frontend dev server, seeding demo
drafts via `GOVOPS_SEED_DEMO=1` so the approvals queue is non-empty on
first load. Specs live under `web/e2e/`:

- `smoke.spec.ts` — every primary route renders, screenshot per route
- `admin-flow.spec.ts` — Phase 6 exit-line scenario through the UI
- `approval-actions.spec.ts` — reject + request-changes paths
- `a11y.spec.ts` — axe WCAG 2.1 AA scan on every route (critical violations are hard-fail; others logged unless `E2E_A11Y_STRICT=1`)
- `i18n.spec.ts` — language selector + locale switch

CI runs the full suite cross-browser after Python tests pass; HTML
reports, screenshots, and traces upload as artifacts on every run.

The frontend SSR fetches from `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`); set `VITE_USE_MOCK_API=true` to bypass the backend and use in-app mocks.

CI runs on Python **3.10, 3.11, 3.12** (`.github/workflows/ci.yml`). No lint or typecheck gate is wired in CI; `mypy` is configured in `pyproject.toml` but not enforced.

Other workflows: `codeql.yml` (code scanning), `gitleaks.yml` (secret scanning, config in `.gitleaks.toml`).

## Key Paths

### Backend
| Surface | Path |
| --- | --- |
| Domain model | `src/govops/models.py` |
| Rule engine (v3 `ProgramEngine`; `OASEngine` is a deprecated alias per ADR-016) | `src/govops/engine.py` |
| Residency math (extracted Phase B) | `src/govops/residency.py` |
| Program manifest loader (v3, ADR-014) | `src/govops/programs.py` |
| Shape evaluators (v3, ADR-015) | `src/govops/shapes/` |
| Cross-program interaction registry (v3, ADR-018) | `src/govops/program_interactions.py` |
| `govops init` + plain-language docs (v3 Phase H) | `src/govops/cli_init.py` |
| docker-compose stack (v3 Phase H) | `docker-compose.yml`, `docker/api.Dockerfile`, `docker/web.Dockerfile` |
| Canadian seed data | `src/govops/seed.py` |
| Other jurisdictions | `src/govops/jurisdictions.py` |
| Translations | `src/govops/i18n.py` |
| Rule encoding pipeline | `src/govops/encoder.py` |
| Pre-loaded encoding demo | `src/govops/encoding_example.py` |
| In-memory store | `src/govops/store.py` |
| ConfigValue substrate (Phase 1) | `src/govops/config.py` |
| API (JSON + HTML) | `src/govops/api.py` |
| CLI entry point | `src/govops/cli.py` |
| Jinja templates (legacy, replaced by `web/` from Phase 6) | `src/govops/templates/` |
| Engine tests | `tests/test_engine.py` (14) |
| API tests | `tests/test_api.py` (36) |
| Encoder tests | `tests/test_encoder.py` (15) |
| ConfigStore tests | `tests/test_config.py` (18) |
| Config API tests | `tests/test_api_config.py` (15) |

### Frontend (`web/`)
| Surface | Path |
| --- | --- |
| Routes (TanStack flat dot) | `web/src/routes/` |
| GovOps components | `web/src/components/govops/` |
| shadcn/ui primitives | `web/src/components/ui/` |
| Design tokens (CSS vars) | `web/src/styles.css` |
| API client | `web/src/lib/api.ts` |
| Mock fallbacks | `web/src/lib/api.mock.ts`, `mock-*.ts` |
| TypeScript types | `web/src/lib/types.ts` |
| ICU translations | `web/src/messages/{en,fr,pt-BR,es-MX,de,uk}.json` |
| Prebuild ICU validator | `web/scripts/check-i18n-icu.mjs` |
| Prebuild key-parity validator | `web/scripts/check-i18n-keys.mjs` |
| Brand assets | `web/public/govops-{wordmark,symbol}.png`, `web/brand/` |

### Cross-cutting
| Surface | Path |
| --- | --- |
| Brand tokens (canonical) | `web/src/styles.css` |
| Compliance | `docs/design/COMPLIANCE.md` |
| MVP spec | `docs/design/IDEA-GovOps-v1.0-MVP.md` |
| Architecture / ADRs | `docs/design/architecture/`, `docs/design/ADRs/` |
| Ecosystem docs | `docs/ecosystem/` |
| GitHub Pages site | `docs/index.html` |
| Copilot rules | `.github/copilot-instructions.md` |
| OpenAPI snapshot (Phase 0, frozen) | `docs/api/openapi-v0.2.0.json` |
| OpenAPI snapshot (Phase 1, draft) | `docs/api/openapi-v0.3.0-draft.json` |

## Design Rules

- **Jurisdiction-first**: `jurisdiction -> constitution -> authority -> law -> regulation -> program -> service -> decision`
- **Deterministic**: identical inputs = identical outputs
- **Evidence-first**: no guessing, flag what is missing
- **Human-in-the-loop**: system recommends, humans decide
- **Audit-ready**: every evaluation produces a complete traceable package
- **Open and inspectable**: Apache 2.0, no vendor lock-in

## Rule Types (engine dispatch)

The engine in `engine.py` dispatches on `RuleType` (defined in `models.py`):

| Type | Purpose |
| --- | --- |
| `age_threshold` | Age-based eligibility (e.g. `age >= 65`) |
| `residency_minimum` | Minimum contribution/residency period |
| `residency_partial` | Partial benefit pro-ration (e.g. years/40) |
| `legal_status` | Citizenship / permanent residency check |
| `evidence_required` | Required document presence |
| `exclusion` | Disqualifying conditions |
| `calculation` | Typed-AST formula for benefit amount (ADR-011) |
| `benefit_duration_bounded` | Weeks of eligibility for time-bounded programs (ADR-017) |
| `active_obligation` | Forward-looking conditions surfaced on the recommendation (ADR-017) |

To add a new rule type: extend the `RuleType` enum in `models.py`, add the evaluation method in `engine.py`, add test coverage in `test_engine.py`. **Note**: `RuleType.CALCULATION` is the only addition planned during v2.0 (Phase 10B).

## Adding a New Jurisdiction

1. In `src/govops/jurisdictions.py` add: jurisdiction, authority chain, legal documents (with statutory text), formalized rules (with `home_countries`), 4 demo cases (eligible-full, ineligible, partial, insufficient-evidence)
2. Register in `JURISDICTION_REGISTRY` at the bottom of the file
3. Add translations to `i18n.py` if introducing a new language
4. Run `pytest -q`

**Phase-1–3 freeze**: the v2.0 PLAN defers new jurisdictions until after the YAML externalization (Phase 3 exit). Adding a seventh country during structural work doubles migration cost.

## Web UI Pages and JSON API

- UI: `/` (about), `/cases`, `/authority`, `/encode`, `/admin`, `/mvp`
- JSON API: `/api/health`, `/api/authority-chain`, `/api/rules`, `/api/legal-documents`, `/api/cases`, `/api/cases/{id}`, `POST /api/cases/{id}/evaluate`, `POST /api/cases/{id}/review`, `/api/cases/{id}/audit`, `POST /api/jurisdiction/{code}`
- Interactive API docs: `/docs`
- Frozen contract: `docs/api/openapi-v0.2.0.json` (Phase 0 snapshot, 27 routes)

## Dev Environment

- **VS Code**: `.vscode/settings.json` pins the venv interpreter (Windows path; macOS/Linux contributors should swap `Scripts` → `bin`), enables pytest, sets file nesting (source ↔ tests). `.vscode/extensions.json` recommends the install set (Python/Pylance, Ruff, Red Hat YAML, Even Better TOML, Markdown All in One, GitLens, REST Client, Conventional Commits, Claude Code).
- **Project-level Claude hooks** in `.claude/settings.json` (only active when a Claude session is anchored at this directory or below):
  - **PreToolUse → Bash**: when a `git commit` is about to run, executes `pytest -q` and **blocks** the commit (exit 2) on failure. Script: `scripts/claude-hooks/pre-commit-pytest.sh`.
  - **PostToolUse → Edit/Write**: after a `.py` file inside this project is edited, runs `pytest --collect-only -q` and warns on import/syntax breaks (does not block). Script: `scripts/claude-hooks/post-edit-pycollect.sh`.
  - The hooks autodetect `.venv/Scripts/activate` (Windows) or `.venv/bin/activate` (macOS/Linux).
- **Conventional Commits** adopted from Phase 0. Format: `type(scope): subject`. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `phase-N` (for v2.0 phase work).

## Documentation Conventions

From `.github/copilot-instructions.md` — preserve when editing docs:

- No internal workspace references, no personal names, no organizational identifiers
- Keep narrative self-contained and engineering-grade
- Describe GovOps as decision support with human accountability
- Reference legislation by citation, not by internal department name
- Templates use the `t()` function for translatable strings
- Every rule must have a `citation` linking to specific legislation
