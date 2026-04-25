# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**GovOps** is a Policy-Driven Service Delivery Machine — an open public-good contribution that turns authoritative governance sources (law, regulation, policy) into executable, traceable, auditable service logic.

Built on **FKTE** (Fractal Knowledge Transformation Engine):
`unstructured knowledge -> structured knowledge -> executable knowledge -> operational action`

**Disclaimer (load-bearing for any docs work)**: This is an independent open-source prototype. It is **not affiliated with, endorsed by, or representing the Government of Canada, Service Canada, ESDC, or any government entity**. Legislative text is publicly available law interpreted by the author for illustrative purposes — not authoritative operational guidance. Preserve this framing in any user-facing changes.

## Active Track

**Law-as-Code v2.0** is in flight on branch `feat/law-as-code-v2`. The single source of truth for execution is [PLAN.md](PLAN.md). The strategic vision is [docs/IDEA-GovOps-v2.0-LawAsCode.md](docs/IDEA-GovOps-v2.0-LawAsCode.md). ADRs land in [docs/design/ADRs/](docs/design/ADRs/). Rollback point: tag `pre-lawcode-v0.2.0`.

## Current State

Working demo — 6 jurisdictions (CA/BR/ES/FR/DE/UA), 6 languages (en/fr/pt/es/de/uk), **65 tests passing**.

- Deterministic rule engine for pension eligibility (age, residency/contribution, legal status, evidence)
- Full authority chain traceability from Constitution through to service decision
- Human review workflow: approve, modify, reject, request info, escalate
- Complete audit trail with statutory citations
- AI-assisted rule encoding pipeline (legislative text → proposed rules → human review → commit)
- One-command demo: `govops-demo`

## Running and Testing

```bash
pip install -e ".[dev]"
govops-demo                                    # http://127.0.0.1:8000
govops-demo --reload                           # auto-reload for development
govops-demo --port 9000                        # custom port

pytest -q                                      # all 65 tests
pytest tests/test_engine.py -v                 # one file
pytest tests/test_engine.py::test_name -v      # one test
pytest -k "residency" -v                       # by keyword
```

CI runs on Python **3.10, 3.11, 3.12** (`.github/workflows/ci.yml`). No lint or typecheck gate is wired in CI; `mypy` is configured in `pyproject.toml` but not enforced.

Other workflows: `codeql.yml` (code scanning), `gitleaks.yml` (secret scanning, config in `.gitleaks.toml`).

## Key Paths

| Surface | Path |
| --- | --- |
| Domain model | `src/govops/models.py` |
| Rule engine | `src/govops/engine.py` |
| Canadian seed data | `src/govops/seed.py` |
| Other jurisdictions | `src/govops/jurisdictions.py` |
| Translations | `src/govops/i18n.py` |
| Rule encoding pipeline | `src/govops/encoder.py` |
| Pre-loaded encoding demo | `src/govops/encoding_example.py` |
| In-memory store | `src/govops/store.py` |
| API (JSON + HTML) | `src/govops/api.py` |
| CLI entry point | `src/govops/cli.py` |
| Templates | `src/govops/templates/` (about, cases, authority, audit, admin, encode, mvp) |
| Engine tests | `tests/test_engine.py` (14) |
| API tests | `tests/test_api.py` (36) |
| Encoder tests | `tests/test_encoder.py` (15) |
| Compliance | `docs/design/COMPLIANCE.md` |
| MVP spec | `docs/design/IDEA-GovOps-v1.0-MVP.md` |
| Architecture / ADRs | `docs/design/architecture/`, `docs/design/ADRs/` |
| Ecosystem docs | `docs/ecosystem/` |
| GitHub Pages site | `docs/index.html` |
| Copilot rules | `.github/copilot-instructions.md` |
| OpenAPI snapshot (frozen Phase 0) | `docs/api/openapi-v0.2.0.json` |

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

## Documentation Conventions

From `.github/copilot-instructions.md` — preserve when editing docs:

- No internal workspace references, no personal names, no organizational identifiers
- Keep narrative self-contained and engineering-grade
- Describe GovOps as decision support with human accountability
- Reference legislation by citation, not by internal department name
- Templates use the `t()` function for translatable strings
- Every rule must have a `citation` linking to specific legislation
