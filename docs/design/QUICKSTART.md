# GovOps Developer Quickstart

## What GovOps Is

GovOps is a policy-aware, human-accountable decision-support system for government services.

It transforms authority-backed source material into reviewable service logic through a bounded chain:

```text
Legal text -> structured rules -> formal model -> decision-support system
```

It is an open public-good contribution that governments can inspect, adapt, and use without surrendering judgment to a black box.

## Quick Start

```bash
git clone https://github.com/eva-foundry/61-GovOps.git
cd 61-GovOps
pip install -e ".[dev]"
govops-demo
```

Open http://127.0.0.1:8000 in your browser.

## Run Tests

```bash
pytest -v
```

## Project Structure

```
src/govops/
  models.py            # Domain model (jurisdiction, rules, cases, evidence, audit)
  engine.py            # Deterministic rule engine
  seed.py              # Canadian OAS authority chain + demo cases
  jurisdictions.py     # Brazil, Spain, France, Germany, Ukraine data
  i18n.py              # Multi-language support (en/fr/pt/es/de/uk)
  store.py             # In-memory store
  api.py               # FastAPI app (JSON API + HTML UI)
  cli.py               # CLI entry point
  templates/           # Jinja2 HTML templates
tests/
  test_engine.py       # Rule engine tests
  test_api.py          # API and multi-jurisdiction tests
docs/
  COMPLIANCE.md        # Governance and compliance alignment
  IDEA-GovOps-v1.0-MVP.md    # MVP specification
  IDEA-GovOps-v1.0-CDD.md    # Conceptual design document
  ADRs/                # Architecture decision records
  architecture/        # Architecture baselines
```

## Core Model

GovOps operates on this governing chain:

```text
Jurisdiction -> Constitution -> Authority -> Law -> Regulation -> Program -> Service -> Decision
```

## Governance Requirements

GovOps is high-impact by design. Governance is a core requirement, not a later hardening activity.

Mandatory properties:

- evidence-first operation
- human-in-the-loop review
- traceability from decision to authority and evidence
- explicit handling of missing or contradictory information
- deterministic workflow controls where applicable
- audit-ready outputs

## Contribution Focus

Useful contributions are most likely to focus on:

- additional jurisdiction data (new countries, new programs)
- rule extraction and formalization
- evidence and audit design
- explainability methods
- persistence layer (database backend)
- production hardening (auth, roles, case management)
