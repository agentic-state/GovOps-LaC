# GovOps -- AI Assistant Instructions

**Project**: GovOps - Policy-Driven Service Delivery Machine
**License**: Apache 2.0 (Open Public Good)
**Status**: Working demo with 6 jurisdictions

---

## What This Project Is

GovOps turns legislation into traceable, deterministic, auditable decision-support services.

Current demo: pension eligibility screening for Canada, Brazil, Spain, France, Germany, and Ukraine -- each with rules encoded from real legislation.

## Architecture

```
src/govops/
  models.py          # Full domain model
  engine.py          # Deterministic rule engine
  seed.py            # Canadian OAS data (authority chain, rules, demo cases)
  jurisdictions.py   # All other jurisdictions
  i18n.py            # Multi-language support
  store.py           # In-memory store
  api.py             # FastAPI (JSON API + HTML UI)
  cli.py             # CLI entry point (govops-demo)
  templates/         # Jinja2 HTML templates
tests/
  test_engine.py     # Rule engine tests
  test_api.py        # API + multi-jurisdiction tests
```

## Key Design Rules

1. **Jurisdiction-first**: every rule traces back through `Jurisdiction -> Constitution -> Act -> Regulation -> Program -> Service -> Decision`
2. **Deterministic**: identical inputs must produce identical outputs
3. **Evidence-first**: missing evidence is flagged, never guessed
4. **Human-in-the-loop**: the system recommends, humans decide
5. **Audit-ready**: every evaluation produces a complete audit package with statutory citations

## When Writing Code

- Every rule must have a `citation` linking to specific legislation
- Every jurisdiction needs `home_countries` in its residency rules
- Templates use the `t()` function for i18n -- all user-visible strings should be translatable
- Use `RuleType` enum for new rule types; extend the engine's `_evaluate_rule` dispatch
- New jurisdictions go in `jurisdictions.py` and register in `JURISDICTION_REGISTRY`

## When Writing Documentation

- No internal workspace references
- No personal names or organizational identifiers
- Keep the narrative self-contained and engineering-grade
- Describe GovOps as decision support with human accountability
- Reference legislation by citation, not by internal department name

## Running

```bash
pip install -e ".[dev]"
govops-demo              # http://127.0.0.1:8000
pytest -v                # all tests
```
