# GovOps -- Claude Code Instructions

## What This Project Is

**GovOps** is a Policy-Driven Service Delivery Machine -- an open public-good contribution that turns authoritative governance sources (law, regulation, policy) into executable, traceable, auditable service logic.

Built on **FKTE** (Fractal Knowledge Transformation Engine):
`unstructured knowledge -> structured knowledge -> executable knowledge -> operational action`

## Current State

**Phase**: Working demo -- 6 jurisdictions, 6 languages, 45 tests passing.

- Deterministic rule engine for pension eligibility (age, residency/contribution, legal status, evidence)
- Jurisdictions: Canada, Brazil, Spain, France, Germany, Ukraine
- Languages: English, French, Portuguese, Spanish, German, Ukrainian
- Full authority chain traceability from Constitution through to service decision
- Human review workflow: approve, modify, reject, request info, escalate
- Complete audit trail with statutory citations
- One-command demo: `govops-demo`

## Key Paths

| Surface | Path |
| --- | --- |
| Domain model | `src/govops/models.py` |
| Rule engine | `src/govops/engine.py` |
| Canadian seed data | `src/govops/seed.py` |
| Other jurisdictions | `src/govops/jurisdictions.py` |
| Translations | `src/govops/i18n.py` |
| API (JSON + HTML) | `src/govops/api.py` |
| CLI entry point | `src/govops/cli.py` |
| Templates | `src/govops/templates/` |
| Engine tests | `tests/test_engine.py` |
| API tests | `tests/test_api.py` |
| Compliance | `docs/design/COMPLIANCE.md` |
| MVP spec | `docs/design/IDEA-GovOps-v1.0-MVP.md` |
| Ecosystem docs | `docs/ecosystem/` |
| GitHub Pages site | `docs/index.html` |

## Design Rules

- **Jurisdiction-first**: `jurisdiction -> constitution -> authority -> law -> regulation -> program -> service -> decision`
- **Deterministic**: identical inputs = identical outputs
- **Evidence-first**: no guessing, flag what is missing
- **Human-in-the-loop**: system recommends, humans decide
- **Audit-ready**: every evaluation produces a complete traceable package
- **Open and inspectable**: Apache 2.0, no vendor lock-in

## Adding a New Jurisdiction

1. Add seed data in `src/govops/jurisdictions.py`: jurisdiction, authority chain, legal documents, rules (with `home_countries` parameter), demo cases
2. Register in `JURISDICTION_REGISTRY` at the bottom of that file
3. Run `pytest` to verify

## Running

```bash
pip install -e ".[dev]"
govops-demo              # http://127.0.0.1:8000
pytest -v                # 45 tests
```
