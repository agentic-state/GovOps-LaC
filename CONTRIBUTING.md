# Contributing to GovOps

GovOps is an open public-good Apache-2.0 project. It's a working demo of **Law as Code** — turning legislation into traceable, deterministic, auditable government decision-support services. Contributions from public-sector practitioners, legal experts, policy analysts, translators, and engineers are welcome.

This guide covers the contribution paths in order of return on effort: jurisdiction additions land the most value for the least code; native-speaker translation review is the most accessible to non-developers; the engine is the deepest commitment.

## What's worth contributing

| Path | Effort | Skills needed | Where to start |
| --- | --- | --- | --- |
| **Add a jurisdiction** (new country) | ~1 day | Domain knowledge of one country's benefit law | [Add a jurisdiction](#add-a-jurisdiction-the-30-minute-starter) |
| **Add a second program** in an existing jurisdiction | ~1 week | Domain knowledge of a non-pension benefit | [issue template](.github/ISSUE_TEMPLATE/second_program.md) |
| **Native-speaker i18n review** | ~1 hour per locale | Native or near-native fluency in fr / pt-BR / es-MX / de / uk | [issue template](.github/ISSUE_TEMPLATE/native_speaker_review.md) |
| **Add a rule type** to the engine | ~1 day | Python + tests | [Engine rule types](#extending-the-engine) |
| **Federate a peer repo** with its own jurisdiction | ~1 week | Python + Ed25519 signing | [`docs/design/ADRs/ADR-009-federation-trust-model.md`](docs/design/ADRs/ADR-009-federation-trust-model.md) |
| **Bug fix or polish** | varies | varies | [issue templates](.github/ISSUE_TEMPLATE/) |

## Add a jurisdiction (the 30-minute starter)

A jurisdiction in GovOps is a country (or sub-national authority) that publishes its own pension or income-support program. The contribution surface is intentionally small: one YAML tree, one Python registration, four demo cases. Tests verify the rest.

**Step 1 — Set up locally**

```bash
git clone https://github.com/agentic-state/GovOps-LaC.git
cd 61-GovOps
pip install -e ".[dev]"
pytest -q                  # 375 tests should pass before you change anything
```

**Step 2 — Pick an existing jurisdiction as your template**

Browse [`lawcode/`](lawcode/) for the country closest to yours — most contributors start from `lawcode/ca/` (Canada / OAS) because it's the most documented. Each jurisdiction directory contains:

```
lawcode/<code>/
  config/
    rules.yaml          # ConfigValue records: thresholds, accepted statuses, calc params
    jurisdiction.yaml   # jurisdiction-level metadata + howto_url
```

These YAML files are the substrate (Phase 1–3 of the [PLAN](PLAN.md)). They're the load-bearing artefact: changing a value here changes runtime behaviour without a deploy.

**Step 3 — Add your jurisdiction's data**

1. Create `lawcode/<your-code>/config/{rules,jurisdiction}.yaml` modelled after the closest existing example.
2. In [`src/govops/jurisdictions.py`](src/govops/jurisdictions.py), add: jurisdiction object (name, country, legal tradition, language), authority chain (constitution → act → regulation → service decision), legal documents with statutory text, formalized rules with `home_countries`, and 4 demo cases (eligible-full, ineligible, partial, insufficient-evidence).
3. Register your code in `JURISDICTION_REGISTRY` at the bottom of the same file.

**Step 4 — Verify**

```bash
pytest -q                                         # all 375 + your new tests should pass
python scripts/validate_lawcode.py                # YAML schema gate
govops-demo                                       # http://127.0.0.1:8000 — see your jurisdiction live
```

**Step 5 — PR**

Open a PR with: the legislative citation for each rule, a one-paragraph "what was hard" note (this helps the next contributor), and the country code + program name in the title.

That's it. The Japan addition (commit history, PLAN §7) is a reference implementation: 15 ConfigValue records + a Python section with 4 demo cases, zero changes to existing tests, zero changes to the engine.

## Extending the engine

The rule engine ([`src/govops/engine.py`](src/govops/engine.py)) dispatches on `RuleType` (defined in [`src/govops/models.py`](src/govops/models.py)):

| Type | Purpose |
| --- | --- |
| `age_threshold` | Age-based eligibility (e.g. `age >= 65`) |
| `residency_minimum` | Minimum contribution / residency period |
| `residency_partial` | Partial benefit pro-ration |
| `legal_status` | Citizenship / permanent residency check |
| `evidence_required` | Required document presence |
| `exclusion` | Disqualifying conditions |
| `calculation` | Benefit amount via typed-AST formula (Phase 10B, [ADR-011](docs/design/ADRs/ADR-011-calculation-rule-type.md)) |

To add a new rule type:
1. Extend the `RuleType` enum in [`src/govops/models.py`](src/govops/models.py).
2. Add the evaluation method in [`src/govops/engine.py`](src/govops/engine.py).
3. Add test coverage in [`tests/test_engine.py`](tests/test_engine.py) — at minimum: satisfied, not-satisfied, insufficient-evidence, and a date-aware case.
4. If the new type holds a value the substrate should resolve (vs hardcoded), wire it through `ConfigStore.resolve()` per [ADR-013](docs/design/ADRs/ADR-013-substrate-resolution-seam.md).

Open an ADR for the new type if it changes the engine's contract or persistence shape.

## i18n contributions

Translations live in two places, distinct by audience:

- **UI strings** (operator + citizen surfaces) — [`web/src/messages/{en,fr,pt-BR,es-MX,de,uk}.json`](web/src/messages/). Validated in `prebuild` via [`web/scripts/check-i18n-keys.mjs`](web/scripts/check-i18n-keys.mjs) (key parity), [`check-i18n-icu.mjs`](web/scripts/check-i18n-icu.mjs) (ICU MessageFormat well-formedness), and [`check-i18n-translation.mjs`](web/scripts/check-i18n-translation.mjs) (no copy-paste from EN).
- **Backend strings** — migrated to ConfigValue records during Phase 2 ([PLAN §4](PLAN.md#4-phase-plan-with-entryexit-criteria)). Edit the YAML under `lawcode/global/` (cross-locale) or `lawcode/<jur>/config/` (jurisdiction-specific).

For UI strings, native-speaker review is gold. The current parity check passes, but a few cells are flagged for human re-look — see PLAN §12.4 and use the [native-speaker review issue template](.github/ISSUE_TEMPLATE/native_speaker_review.md).

## Reporting bugs and proposing features

Use the issue templates in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/). Open-ended questions go to [Discussions](https://github.com/agentic-state/GovOps-LaC/discussions) so the issue tracker stays actionable.

## Development setup

```bash
# Backend
pip install -e ".[dev]"
govops-demo                    # http://127.0.0.1:8000 (Jinja UI + JSON API)
govops-demo --reload           # auto-reload during development
pytest -q                      # 375 tests
pytest -k residency -v         # filter by keyword

# Premium web UI (Vite + TanStack + shadcn)
cd web
npm install                    # or bun install
npm run dev                    # http://localhost:8080
npm run check:i18n             # ICU + key parity + translation parity
npm test -- --run              # vitest unit tests
npm run lint                   # eslint + prettier

# E2E (Playwright + axe, cross-browser)
npm run test:e2e:install       # one-time, ~300 MB
npm run test:e2e               # Chromium + Firefox + WebKit
```

## Code standards

- **Citations are mandatory**: every formalized rule references a specific statute or regulation section.
- **Tests must stay green** at every PR. CI runs Python 3.10/3.11/3.12 + cross-browser Playwright.
- **Conventional Commits** ([adopted Phase 0](PLAN.md)): `type(scope): subject`. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `phase-N`.
- **No personal names, organizational identifiers, or internal references** in code or docs (preserves the framing in the disclaimer).
- **No hidden reasoning**: every recommendation traces back through `Decision → Rule → Policy → Regulation → Act → Jurisdiction`.
- **Human-in-the-loop**: the system recommends; humans decide.
- **Deterministic** in rule-driven paths: identical inputs produce identical outputs.

## Pull request process

1. Fork the repo, create a branch (`git checkout -b feat/<short-name>`).
2. Make your changes; keep the diff scoped to one concern.
3. Run `pytest -q` (backend) and `cd web && npm run check:i18n && npm test -- --run` (web) — all must pass.
4. If you touched `lawcode/`, run `python scripts/validate_lawcode.py`.
5. Open a PR with a clear "what changed and why". CI will run the full matrix (Python 3.10/3.11/3.12 + cross-browser E2E + CodeQL + secret scan).
6. PR template will prompt for the rest.

## License

By contributing, you agree your contributions are licensed under the Apache License 2.0. This is a public-good project; the license preserves that posture for everyone who comes after you.
