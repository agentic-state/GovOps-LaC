# GovOps - Policy-Driven Service Delivery Machine

> **Disclaimer**: This is an independent prototype built as a personal, open-source project. It is **not affiliated with, endorsed by, or representing any government, department, or public agency**. Legislative text used in the demo (including the Old Age Security Act) is publicly available law interpreted by the author for illustrative purposes only — it is **not authoritative operational guidance** and should not be relied upon for actual eligibility determinations.

**Law -> Policy -> Service -> Decision**

GovOps turns authoritative governance sources into coherent, traceable, executable service logic. It is a disciplined construction approach for systems whose true specification lives outside the codebase -- in statutes, regulations, and policy.

**Law-as-Code v2.0** has shipped: every statutory value (thresholds, accepted statuses, calculation coefficients, prompts) lives as a dated `ConfigValue` record. Behaviour changes are configuration writes, not deploys. A case evaluated against 2025 still resolves with 2025's substrate even after the rules change in 2026. A second repo can publish its own jurisdiction with an Ed25519-signed manifest and federate into a GovOps deployment. See [PLAN.md](PLAN.md) for the build, [docs/design/LAW-AS-CODE.md](docs/design/LAW-AS-CODE.md) for the SPRIND-element mapping, and [docs/design/ADRs/](docs/design/ADRs/) for the load-bearing decisions.

This is an open public-good contribution for the global public sector: something governments can study, adapt, and use without vendor capture or hidden decision logic.

**Project home**: [eva-foundry.github.io/61-GovOps](https://eva-foundry.github.io/61-GovOps/) · **Source**: [github.com/eva-foundry/61-GovOps](https://github.com/eva-foundry/61-GovOps)

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/eva-foundry/61-GovOps.git
cd 61-GovOps
pip install -e ".[dev]"

# Launch the demo
govops-demo
```

Open http://127.0.0.1:8000 in your browser. No database, no cloud, no API keys needed.

---

## What the Demo Does

The demo implements a complete **Old Age Security (OAS) initial eligibility determination** for Canada -- a real federal benefit program with real statutory rules.

### The workflow:

1. **View** a case -- see the applicant profile, evidence, and residency history
2. **Evaluate** -- the rule engine checks each statutory condition deterministically
3. **Review** -- approve, reject, escalate, or request more information (human-in-the-loop)
4. **Audit** -- every rule evaluation traces back to its legal citation

### Four demo cases cover all decision paths:

| Case | Applicant | Expected Outcome |
| --- | --- | --- |
| demo-case-001 | Margaret Chen | Eligible - Full pension (40/40) |
| demo-case-002 | David Park | Ineligible - Under age 65 |
| demo-case-003 | Amara Osei | Eligible - Partial pension (33/40) |
| demo-case-004 | Jean-Pierre Tremblay | Insufficient evidence |

### Rules encoded from the Old Age Security Act:

| Rule | Citation | Logic |
| --- | --- | --- |
| Age threshold | OAS Act, s. 3(1) | `age >= 65` |
| Minimum residency | OAS Act, s. 3(1) | `canadian_residency_after_18 >= 10 years` |
| Pension calculation | OAS Act, s. 3(2) | `min(years, 40) / 40` |
| Legal status | OAS Act, s. 3(1) | citizen or permanent resident |
| Evidence of age | OAS Regulations, s. 21(1) | birth certificate required |

---

## Architecture

```
                          +------------------+
                          |   Jurisdiction   |
                          | (country, level) |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |   Constitution   |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |              |              |
              +-----v----+  +-----v----+  +-----v------+
              |   Act    |  |Regulation|  |  Policy    |
              |(statute) |  |          |  | (guidance) |
              +-----+----+  +-----+----+  +-----+------+
                    |              |              |
                    +--------------+--------------+
                                   |
                          +--------v---------+
                          | Formalized Rules |-----> Rule Engine
                          |  (parameters,    |     (deterministic
                          |   citations)     |      evaluation)
                          +--------+---------+         |
                                   |                   |
              +--------------------+-------------------+
              |                    |                    |
        +-----v------+    +-------v-------+    +------v-------+
        |    Case    |    |Recommendation |    | Audit Package|
        | (applicant,|--->| (outcome,     |--->| (full trace, |
        |  evidence) |    |  rule-by-rule)|    |  immutable)  |
        +------------+    +-------+-------+    +--------------+
                                  |
                          +-------v-------+
                          | Human Review  |
                          | (approve,     |
                          |  reject, etc) |
                          +---------------+
```

### Key design properties:

- **Traceability**: every recommendation links to `Decision -> Rule -> Policy -> Regulation -> Act -> Jurisdiction`
- **Determinism**: identical inputs produce identical outputs in rule-driven paths
- **Evidence awareness**: the system knows what information is needed and what is missing
- **Explicit uncertainty**: missing or contradictory inputs trigger review, not false certainty
- **Human accountability**: humans remain the final decision authorities

### v2.0 substrate

Law-as-Code v2.0 inserts a **dated `ConfigValue` substrate** between the formalized rules and the engine. Every parameter the engine touches — age thresholds, residency minima, accepted legal statuses, calculation coefficients, prompts, UI labels — is resolved through `ConfigStore.resolve(key, evaluation_date, jurisdiction_id)` rather than a hardcoded constant. A case evaluated against 2025 still resolves with 2025's substrate even after the rules change in 2026; the supersession chain is durable.

```
                                                        Federation (Phase 8)
                                                     +--------------------------+
                                                     | Ed25519 signed packs     |
                                                     | publisher allowlist      |
                                                     | lawcode/REGISTRY.yaml    |
                                                     +-----------+--------------+
                                                                 | (verified merge)
                                                                 v
+------------------------+        +------------------------------+-----+
| Formalized Rules       |  ref   |         ConfigValue Substrate      |
| (param_key_prefix +    +------->+   (dated, citation, supersedes,   |
|  citation only)        |        |    rationale, approved_by)        |
+-----------+------------+        +-----------+------------------------+
            |                                 ^
            | engine.evaluate(                | resolve(key,
            |   case, evaluation_date)        |  evaluation_date)
            v                                 |
+------------------------+        +-----------+------------------------+
| Deterministic engine   +------->+ Audit package (full ConfigResolution
| (rule + calculation)   |        | trace per rule, sha256 of notice  |
+------------------------+        | template, supersession chain)     |
                                  +------------------------------------+
```

YAML lives under [lawcode/](lawcode/), validated against [schema/lawcode-v1.0.json](schema/lawcode-v1.0.json) on every push. The encoding pipeline (`govops encode`) emits commit-ready YAML, not Python.

### Technology:

**Backend** (`src/govops/`):
- **Python + FastAPI** with **Pydantic** models for the full domain (jurisdiction, authority chain, rules, cases, evidence, audit, ConfigValue)
- **Embedded SQLite** at `var/govops.db` for `ConfigStore` persistence (Phase 6+ per [ADR-010](docs/design/ADRs/ADR-010-sqlite-from-phase-6.md)); legacy in-memory store retained for the case fixtures
- **Schema-validated YAML** for every business value under [lawcode/](lawcode/) — 21 files, 564 records, validated in CI
- **Ed25519** for federation (Phase 8) — signed lawcode packs with publisher allowlist per [ADR-009](docs/design/ADRs/)
- **Jinja2** templates retained as a fallback rendering surface; the primary UI is the `web/` SPA below

**Frontend** (`web/`):
- **TanStack Start** (SSR + flat-route conventions) on **Vite** + **React 19** + **TypeScript**
- **Tailwind v4** + **shadcn/ui** for design-system primitives
- **react-intl** with ICU MessageFormat for 6 locales × ~498 keys; ICU + key-parity validators run as `prebuild`
- **CodeMirror** + **react-diff-viewer-continued** for the ConfigValue admin surface; **react-hook-form** + **zod** for forms
- **Playwright + axe** cross-browser E2E suite covering smoke, admin flow, approval actions, a11y (WCAG 2.1 AA), i18n, and SSR head coverage

---

## API

The demo exposes both a web UI and a JSON API.

### JSON endpoints:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/authority-chain` | Browse the full authority chain |
| GET | `/api/rules` | List all formalized rules |
| GET | `/api/legal-documents` | Browse source legislation |
| GET | `/api/cases` | List all cases |
| GET | `/api/cases/{id}` | Get case with recommendation |
| POST | `/api/cases/{id}/evaluate` | Run the rule engine |
| POST | `/api/cases/{id}/review` | Submit human review action |
| GET | `/api/cases/{id}/audit` | Full audit package |
| GET | `/api/cases/{id}/notice` | Render decision notice (Phase 10C) |
| POST | `/api/cases/{id}/events` | Post a life event for reassessment (Phase 10D) |
| GET | `/api/cases/{id}/events` | List life events for a case |
| GET | `/api/jurisdiction/{code}` | Get jurisdiction metadata + `howto_url` |
| POST | `/api/jurisdiction/{code}` | Switch jurisdiction (ca, br, es, fr, de, ua, jp) |
| GET | `/api/impact` | Citation impact across all jurisdictions (Phase 7) |
| POST | `/api/screen` | Citizen self-screening, no PII echo (Phase 10A) |
| POST | `/api/screen/notice` | Self-screen decision notice (Phase 10C) |
| GET | `/api/config/values` | Browse `ConfigValue` records (Law-as-Code v2.0) |
| GET | `/api/config/resolve` | Resolve a key at an `evaluation_date` |
| GET | `/api/config/versions` | Supersession chain for a key |
| POST | `/api/config/values` | Draft a new `ConfigValue` |
| POST | `/api/config/values/{id}/approve` | Approve a draft (dual approval per ADR-008) |
| POST | `/api/config/values/{id}/request-changes` | Send a draft back |
| POST | `/api/config/values/{id}/reject` | Reject a draft |
| POST | `/api/encode/batches/{id}/emit-yaml` | Encoder commits approved batch to lawcode YAML |
| GET | `/api/admin/federation/registry` | Federation publisher allowlist (Phase 8) |
| GET | `/api/admin/federation/packs` | Fetched lawcode packs |
| POST | `/api/admin/federation/fetch/{publisher_id}` | Pull a signed pack |
| POST | `/api/admin/federation/packs/{publisher_id}/enable` | Enable a verified pack |
| POST | `/api/admin/federation/packs/{publisher_id}/disable` | Disable a pack |

### Web UI pages (TanStack Start SPA in `web/`, served at http://localhost:8080):

| Path | Description |
| --- | --- |
| `/` | Landing — Law-as-Code v2.0 hero, console dropdown into the operator surfaces |
| `/about` | What GovOps is, SPRIND framing, FKTE pipeline, authority chain, "what this is not" |
| `/cases` | Case dashboard with event timeline + benefit-amount card on case detail |
| `/authority` | Authority chain browser |
| `/encode` | Rule encoding pipeline (legislative text → proposals → review → YAML emission) |
| `/impact` | Citation impact across all jurisdictions (Phase 7) |
| `/screen`, `/screen/:jurisdiction` | Citizen self-screening — no PII storage, no case row (Phase 10A) |
| `/config` (+ `/timeline`, `/diff`, `/draft`, `/approvals`, `/prompts`) | ConfigValue admin (search, supersession, draft, dual approval, prompt management) |
| `/admin` | Operator surface — seeded data, federation registry, runbook |
| `/admin/federation` | Federation registry + signed pack management (Phase 8) |
| `/walkthrough` | Guided tour of the substrate-as-truth flow |
| `/policies` | Privacy + data handling notice |

The legacy Jinja UI (served at http://127.0.0.1:8000) is preserved as a no-build-step fallback covering `/`, `/cases`, `/authority`, `/encode`, `/admin`, `/mvp`. Interactive API docs: http://127.0.0.1:8000/docs

---

## Conceptual Foundation

### FKTE - Fractal Knowledge Transformation Engine

```
Unstructured knowledge -> Structured knowledge -> Executable knowledge -> Operational action
```

GovOps is the governance-domain instantiation of FKTE.

### Jurisdiction-First Rule

A policy-driven service machine does not start at Acts alone. It starts with the authority context that determines which legal universe applies.

```
Jurisdiction -> Constitution -> Authority -> Law -> Regulation -> Program -> Service -> Decision
```

### Build Order

```
FKTE -> Decision engine -> Service -> Program -> Platform -> GovOps
```

This demo proves step 1: one decision engine for one bounded case type.

---

## Tests

```bash
pip install -e ".[dev]"
pytest -v
```

375 backend tests covering (all green on Python 3.10/3.11/3.12):
- Rule engine unit tests (all decision paths, edge cases, residency calculation)
- Determinism verification (identical inputs = identical outputs)
- Authority traceability (every rule has a statutory citation)
- Multi-jurisdiction switching and evaluation across 7 jurisdictions
- Encoding pipeline (LLM response parsing, proposal review, batch lifecycle, YAML emission)
- API integration tests (full case workflow + Phase 7 impact + Phase 8 federation)
- ConfigValue substrate (round-trip, effective-date semantics, supersession chain)
- Calculation rules (typed-AST formula evaluation, per-step citations)
- Self-screening (citizen-facing, no PII echo, no audit row)
- Notice rendering (template-as-ConfigValue, sha256 in audit)
- Event-driven reassessment (supersession chain, life-event replay)
- Federation (Ed25519 signing, manifest verification, fail-closed pipeline)
- Date-aware substrate resolution (scalar + formula `ref` honour `evaluation_date`)

Plus a Playwright + axe E2E suite under `web/e2e/` covering the citizen and operator surfaces.

---

## Project Structure

```
src/govops/
  models.py            # Domain model (jurisdiction, rules, cases, evidence, audit)
  engine.py            # Deterministic rule engine
  seed.py              # Canadian OAS data
  jurisdictions.py     # Brazil, Spain, France, Germany, Ukraine, Japan
  i18n.py              # Multi-language support (en/fr/pt/es/de/uk)
  encoder.py           # Rule encoding pipeline (AI-assisted + human review)
  encoding_example.py  # Pre-loaded encoding demo
  store.py             # In-memory store
  api.py               # FastAPI (JSON API + HTML UI)
  cli.py               # CLI entry point
  templates/           # Jinja2 templates (about, cases, authority, audit, admin, encode, mvp)
  config.py            # ConfigValue substrate (Law-as-Code v2.0)
lawcode/               # Effective-dated ConfigValue records (YAML, schema-validated)
  global/              # Cross-jurisdictional values (engine thresholds, UI labels, prompts)
  {ca,br,es,fr,de,ua,jp}/config/  # Per-jurisdiction rule parameters
schema/
  configvalue-v1.0.json  # JSON Schema for a single ConfigValue record
  lawcode-v1.0.json      # JSON Schema for the lawcode/*.yaml file shape
tests/
  test_engine.py       # Rule engine tests
  test_api.py          # API, multi-jurisdiction, and HTML tests
  test_encoder.py      # Encoding pipeline tests
docs/
  index.html           # GitHub Pages landing page (eva-foundry.github.io/61-GovOps)
  screenshots/         # Static HTML snapshots of every screen
  ecosystem/           # Implementation guide, training, certification, RFP, use cases, partner program
  design/              # MVP spec, CDD, architecture baselines, ADRs, compliance
```

### Law-as-Code v2.0

Every business value (thresholds, accepted statuses, UI labels, LLM prompts) lives as a dated `ConfigValue` record under [lawcode/](lawcode/). The on-disk shape is locked by [schema/lawcode-v1.0.json](schema/lawcode-v1.0.json); each merged record satisfies [schema/configvalue-v1.0.json](schema/configvalue-v1.0.json). CI runs `python scripts/validate_lawcode.py` on every push, so a malformed YAML breaks the build before merge. Track the live execution plan in [PLAN.md](PLAN.md).

---

## What This Project Is Not

- Not autonomous decision-making
- Not a replacement for legal or policy authority
- Not a hidden-reasoning AI assistant
- Not a claim to automate political judgment

The aim is disciplined decision support: explicit, reviewable, and traceable.

---

## Ecosystem

GovOps is designed to create an ecosystem of implementers, trainers, and domain experts.

| Document | Audience |
| --- | --- |
| [Implementation Guide](docs/ecosystem/implementation-guide.md) | Consulting firms deploying GovOps |
| [Training Curriculum](docs/ecosystem/training-curriculum.md) | Training organizations |
| [Certification Program](docs/ecosystem/certification-program.md) | Individuals and organizations |
| [Business Case Template](docs/ecosystem/business-case-template.md) | Government decision-makers |
| [RFP Template](docs/ecosystem/rfp-template.md) | Government procurement teams |
| [Use Case Library](docs/ecosystem/use-case-library.md) | Anyone exploring GovOps applications |
| [Partner Program](docs/ecosystem/partner-program.md) | Firms building a GovOps practice |

---

## License

Apache 2.0 -- an open public-good contribution for the global public sector.

---

## Origin and Lineage

GovOps was inspired by [The Agentic State — Vision Paper](https://agenticstate.org/paper.html) (Ilves, Kilian, Parazzoli, Peixoto & Velsberg, 2025; v1.0.1, launched at the Tallinn Digital Summit, 09 October 2025), which maps 12 layers of government service delivery where intelligent systems can operate — from service design and workflows through governance, accountability, and public finance.

GovOps is a practical implementation of that vision, starting from Layer 3 (Policy & Rule-Making) and Layer 7 (Agent Governance): a working method that any government can study and adapt to make policy-driven services transparent, traceable, and auditable.

The project also takes [SPRIND's Law as Code initiative](https://www.sprind.org/en/law-as-code) (Germany, headed by Dr. Hakke Hansen, LL.M. and Jörg Resch) seriously and tries to be a working open-source reference implementation against the five foundational elements SPRIND articulates. The element-by-element mapping with code references lives in [docs/design/LAW-AS-CODE.md](docs/design/LAW-AS-CODE.md).

This project is an independent, nights-and-weekends open public-good contribution. It is not affiliated with, endorsed by, or representing the Agentic State authors, SPRIND, or any government — it is one builder's answer to the questions those initiatives pose.

---

## Why This Matters

Public systems drift because legal authority, policy guidance, operational process, and software implementation separate over time.

If one bounded domain can be made coherent again, then modernization becomes a repeatable engineering discipline rather than a bespoke translation exercise.
