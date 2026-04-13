# Contributing to GovOps

GovOps is an open public-good project. Contributions from government practitioners, legal experts, policy analysts, and software engineers are welcome.

## How to Contribute

### Adding a New Jurisdiction

This is the highest-impact contribution. To add a new country's pension (or other benefit) program:

1. Create seed data in `src/govops/jurisdictions.py`:
   - Jurisdiction object (name, country, legal tradition, language)
   - Authority chain (constitution through to service-level decision)
   - Legal documents with the actual statutory text
   - Formalized rules with `home_countries` parameter
   - 4 demo cases (eligible-full, ineligible, partial, insufficient-evidence)
2. Register in `JURISDICTION_REGISTRY` at the bottom of the file
3. Run `pytest` to verify all existing tests still pass
4. Submit a PR with the legislation citation for each rule

### Adding Translations

Translation strings live in `src/govops/i18n.py`. Add your language code to `SUPPORTED_LANGUAGES` and add translations for each key in `_TRANSLATIONS`.

### Improving the Rule Engine

The engine (`src/govops/engine.py`) currently handles these rule types:
- `age_threshold` -- age-based eligibility
- `residency_minimum` -- minimum contribution/residency period
- `residency_partial` -- partial benefit calculation
- `legal_status` -- citizenship/residency status
- `evidence_required` -- document requirements
- `exclusion` -- disqualifying conditions

To add a new rule type: add to the `RuleType` enum in `models.py`, add the evaluation method in `engine.py`, and add test coverage.

### Reporting Issues

Use GitHub Issues. Please include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Which jurisdiction/language you were using

## Development Setup

```bash
git clone https://github.com/eva-foundry/61-GovOps.git
cd 61-GovOps
pip install -e ".[dev]"
pytest -v          # run tests
govops-demo        # start the demo server
```

## Code Standards

- Every rule must have a `citation` linking to specific legislation
- Every new feature needs test coverage
- Templates use the `t()` function for translatable strings
- No personal names, organizational identifiers, or internal references in code or docs

## Pull Request Process

1. Fork the repo and create a branch
2. Make your changes
3. Run `pytest` -- all tests must pass
4. Submit a PR with a clear description of what changed and why

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
