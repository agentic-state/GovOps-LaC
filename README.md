# GovOps - Policy-Driven Service Delivery Machine

> **Disclaimer**: This is an independent prototype built as a personal, open-source project. It is **not affiliated with, endorsed by, or representing any government, department, or public agency**. Legislative text used in the demo (including the Old Age Security Act) is publicly available law interpreted by the author for illustrative purposes only — it is **not authoritative operational guidance** and should not be relied upon for actual eligibility determinations.

**Law -> Policy -> Service -> Decision**

GovOps turns authoritative governance sources into coherent, traceable, executable service logic. It is a disciplined construction approach for systems whose true specification lives outside the codebase -- in statutes, regulations, and policy.

This is an open public-good contribution for the global public sector: something governments can study, adapt, and use without vendor capture or hidden decision logic.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/61-GovOps.git
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

### Technology:

- **Python + FastAPI** backend (no infrastructure dependencies)
- **Jinja2** templates (no JavaScript build step)
- **In-memory store** seeded from statutory data (resets on restart)
- **Pydantic** models for the full domain (jurisdiction, authority chain, rules, cases, evidence, audit)

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
| POST | `/api/jurisdiction/{code}` | Switch jurisdiction (ca, br, es, fr, de, ua) |

### Web UI pages:

| Path | Description |
| --- | --- |
| `/` | About page (what GovOps is, roadmap, honest assessment) |
| `/cases` | Case dashboard |
| `/authority` | Authority chain browser |
| `/encode` | Rule encoding pipeline (legislative text to rules) |
| `/admin` | Glass window (all data behind the scenes) |

Interactive API docs: http://127.0.0.1:8000/docs

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

65 tests covering:
- Rule engine unit tests (all decision paths, edge cases, residency calculation)
- Determinism verification (identical inputs = identical outputs)
- Authority traceability (every rule has a statutory citation)
- Multi-jurisdiction switching and evaluation
- Encoding pipeline (LLM response parsing, proposal review, batch lifecycle)
- API integration tests (full case workflow)
- HTML UI smoke tests

---

## Project Structure

```
src/govops/
  models.py            # Domain model (jurisdiction, rules, cases, evidence, audit)
  engine.py            # Deterministic rule engine
  seed.py              # Canadian OAS data
  jurisdictions.py     # Brazil, Spain, France, Germany, Ukraine
  i18n.py              # Multi-language support (en/fr/pt/es/de/uk)
  encoder.py           # Rule encoding pipeline (AI-assisted + human review)
  encoding_example.py  # Pre-loaded encoding demo
  store.py             # In-memory store
  api.py               # FastAPI (JSON API + HTML UI)
  cli.py               # CLI entry point
  templates/           # Jinja2 templates (about, cases, authority, audit, admin, encode, mvp)
tests/
  test_engine.py       # Rule engine tests
  test_api.py          # API, multi-jurisdiction, and HTML tests
  test_encoder.py      # Encoding pipeline tests
docs/
  index.html           # GitHub Pages landing page (your-org.github.io/61-GovOps)
  screenshots/         # Static HTML snapshots of every screen
  ecosystem/           # Implementation guide, training, certification, RFP, use cases, partner program
  design/              # MVP spec, CDD, architecture baselines, ADRs, compliance
```

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

GovOps was inspired by the [Agentic State](https://agenticstate.org) framework (Ilves & Kilian, 2025), which maps 12 layers of government service delivery where intelligent systems can operate — from service design and workflows through governance, accountability, and public finance.

GovOps is a practical implementation of that vision, starting from Layer 3 (policy and rule making) and Layer 7 (governance and accountability): a working method that any government can adopt to make policy-driven services transparent, traceable, and auditable.

This project is an independent, nights-and-weekends open public-good contribution to support the Agentic State mission. It is not affiliated with or endorsed by the Agentic State authors — it is one builder's answer to the question they posed.

---

## Why This Matters

Public systems drift because legal authority, policy guidance, operational process, and software implementation separate over time.

If one bounded domain can be made coherent again, then modernization becomes a repeatable engineering discipline rather than a bespoke translation exercise.
