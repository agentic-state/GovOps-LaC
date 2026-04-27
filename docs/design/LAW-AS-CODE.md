# GovOps as a Law-as-Code Reference Implementation

> Mapping GovOps to the SPRIND "Law as Code" framework, with code references.

This document is for SPRIND-literate readers who want to know which file in
this repository implements each foundational element of digital legal
infrastructure. It is an alignment artefact, not a marketing document — every
mapping below points at concrete code, schema, or configuration.

GovOps is **not affiliated with SPRIND, with any government, or with any
public agency**. It is an independent open-source prototype that takes the
SPRIND framing seriously and tries to build a working reference implementation
under Apache 2.0.

---

## The five SPRIND elements (and the sixth GovOps adds)

The SPRIND "Law as Code" initiative articulates five foundational elements
for digital legal infrastructure:

1. A binding schema for executable legal norms
2. Open-source legal-coding editors
3. AI-powered legal-coding processes
4. A central repository of the official legal code
5. Training and capacity building

GovOps v2.0 implements all five. It also adds a sixth element that the
SPRIND articulation does not yet name explicitly:

6. **The interpretive apparatus is itself versioned configuration** — the
   prompts the AI uses to extract rules from statute, the labels used in
   officer-facing UIs, and the engine thresholds applied during evaluation
   are all dated `ConfigValue` records, governed by the same schema and
   approval flow as the rules themselves.

Each section below maps the element to the code paths that implement it.

---

## 1. A binding schema for executable legal norms

**Claim**: GovOps publishes a versioned, machine-validated schema that every
legal-code artefact must conform to. The schema is enforced in CI; malformed
artefacts cannot reach `main`.

| Surface | Path |
| --- | --- |
| `ConfigValue` record schema (one record) | [`schema/configvalue-v1.0.json`](../../schema/configvalue-v1.0.json) |
| `lawcode/*.yaml` file shape (a collection of records) | [`schema/lawcode-v1.0.json`](../../schema/lawcode-v1.0.json) |
| `ConfigValue` Pydantic model (runtime) | [`src/govops/config.py`](../../src/govops/config.py) |
| `LegalRule` Pydantic model + `RuleType` enum | [`src/govops/models.py`](../../src/govops/models.py) |
| CI validation gate | [`scripts/validate_lawcode.py`](../../scripts/validate_lawcode.py) |
| CI workflow that runs the gate | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |

The schema captures effective dates (`effective_from`, `effective_to`),
authority citation, author, approval state, rationale, and a back-pointer
to the superseded version. Six rule types are formalised today
(`age_threshold`, `residency_minimum`, `residency_partial`, `legal_status`,
`evidence_required`, `exclusion`); a seventh (`calculation`) is reserved
for Phase 10B.

The shape is locked at v1.0 ([ADR-003](ADRs/ADR-003-yaml-over-json.md))
and any breaking change must be an ADR.

---

## 2. Open-source legal-coding editors

**Claim**: GovOps ships a working editor surface for the legal code: search,
timeline, diff, draft, approval, and prompt-editing — all under Apache 2.0.

| Surface | Path |
| --- | --- |
| Search & filter `ConfigValue` records | [`web/src/routes/config.tsx`](../../web/src/routes/config.tsx) |
| Per-key effective-value timeline | [`web/src/routes/config.$key.$jurisdictionId.tsx`](../../web/src/routes/config.$key.$jurisdictionId.tsx) |
| Diff between adjacent versions | [`web/src/routes/config.diff.tsx`](../../web/src/routes/config.diff.tsx) |
| Draft a new value | [`web/src/routes/config.draft.tsx`](../../web/src/routes/config.draft.tsx) |
| Approval queue + actions | [`web/src/routes/config.approvals.tsx`](../../web/src/routes/config.approvals.tsx), [`config.approvals.$id.tsx`](../../web/src/routes/config.approvals.$id.tsx) |
| Prompt admin (edit + diff + fixture replay) | [`web/src/routes/config.prompts.tsx`](../../web/src/routes/config.prompts.tsx), [`config.prompts.$key.$jurisdictionId.edit.tsx`](../../web/src/routes/config.prompts.$key.$jurisdictionId.edit.tsx) |
| Encoding pipeline (statute text → proposals → commit) | [`web/src/routes/encode.tsx`](../../web/src/routes/encode.tsx), [`encode.new.tsx`](../../web/src/routes/encode.new.tsx), [`encode.$batchId.tsx`](../../web/src/routes/encode.$batchId.tsx) |
| Citation-based impact search (Phase 7) | [`web/src/routes/impact.tsx`](../../web/src/routes/impact.tsx) *(spec: [`docs/govops-014-citation-impact.md`](../govops-014-citation-impact.md))* |
| Authority chain browser | [`web/src/routes/authority.tsx`](../../web/src/routes/authority.tsx) |

Stack: Vite + React 19 + TanStack Start (SSR) + Tailwind v4 + shadcn/ui +
react-intl. Six locales (en / fr / pt-BR / es-MX / de / uk).
[ADR-005](ADRs/ADR-005-lovable-repo-location.md) captures why the editor lives
in the same repository as the substrate it edits.

The editor surfaces are deliberately separate from the citizen-facing
self-screening surface ([`docs/govops-015-self-screening.md`](../govops-015-self-screening.md))
so administrative tooling never bleeds into citizen UX.

---

## 3. AI-powered legal-coding processes

**Claim**: GovOps has a working pipeline where AI extracts candidate rules
from raw statutory text, a human reviews each proposal, and accepted
proposals commit as `ConfigValue` records. The prompts the AI uses are
themselves versioned `ConfigValue` records — re-running the pipeline against
a pinned prompt id reproduces the prior extraction exactly.

| Surface | Path |
| --- | --- |
| Encoder runtime (ingest → extract → review → commit) | [`src/govops/encoder.py`](../../src/govops/encoder.py) |
| Pre-loaded encoding example | [`src/govops/encoding_example.py`](../../src/govops/encoding_example.py) |
| Extraction system prompt (as a `ConfigValue`) | [`lawcode/global/prompts.yaml`](../../lawcode/global/prompts.yaml) (key `global.prompt.encoder.extraction_system`) |
| Extraction user-template prompt | same file, key `global.prompt.encoder.extraction_user` |
| Encoder tests | [`tests/test_encoder.py`](../../tests/test_encoder.py) |
| Prompt approval policy | [ADR-008](ADRs/ADR-008-prompt-as-config-dual-approval.md) (dual approval: domain expert + maintainer) |

The pipeline is **decision support, not automation**: every proposal is
human-reviewed before it commits. The LLM provider is pluggable; the
default backend is fixture-based for deterministic tests, and a real provider
can be swapped in via the encoder's extraction interface.

Each batch records the `ConfigValue.id` of the prompt that produced it, so
batches are reproducible. If the prompt changes, prior batches keep
referencing the prompt version that ran when they were extracted.

---

## 4. A central repository of the official legal code

**Claim**: GovOps stores all legal-code artefacts in a single auditable
directory tree under version control, with a defined federation protocol
(Phase 8) for repositories that want to publish their own jurisdiction.

| Surface | Path |
| --- | --- |
| The legal code itself (per-jurisdiction) | [`lawcode/ca/config/`](../../lawcode/ca/config/), `br/`, `es/`, `fr/`, `de/`, `ua/` |
| Cross-jurisdictional values (engine thresholds, UI labels, prompts) | [`lawcode/global/`](../../lawcode/global/) |
| Schema enforcement | [`schema/`](../../schema/) (referenced from §1) |
| CI gate that fails the build on malformed YAML | `validate_lawcode` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| Federation protocol *(Phase 8)* | `lawcode/REGISTRY.yaml` schema + `govops fetch` CLI — signed manifests, checksum pinning ([PLAN.md §4 Phase 8](../../PLAN.md)) |
| OpenAPI contract surface | [`docs/api/openapi-v0.2.0.json`](../api/openapi-v0.2.0.json) (frozen Phase 0), [`openapi-v0.3.0-draft.json`](../api/openapi-v0.3.0-draft.json) (Phase 1+) |

Storage from Phase 6 onward is embedded SQLite hydrated from YAML on
startup ([ADR-010](ADRs/ADR-010-sqlite-from-phase-6.md)). This preserves
the "clone, install, run" demo principle while letting runtime edits
survive process restarts. Production-grade infrastructure (managed
PostgreSQL with HA / backup / on-call) is explicitly a separate track —
the reference implementation is meant to be forkable, not operationally
opinionated.

The repository is **the** repository for this implementation; federation
([PLAN.md §4 Phase 8](../../PLAN.md)) is how a second jurisdiction's
maintainers would publish their own legal code while pinning a verifiable
manifest. Reject-unsigned-by-default is the design posture.

---

## 5. Training and capacity building

**Claim**: GovOps publishes implementation guides, training curricula, a
certification framework, and procurement-ready templates so that other
organisations can adopt or build on the reference implementation without
re-deriving everything.

| Audience | Document |
| --- | --- |
| Consulting firms deploying GovOps | [`docs/ecosystem/implementation-guide.md`](../ecosystem/implementation-guide.md) |
| Training organisations | [`docs/ecosystem/training-curriculum.md`](../ecosystem/training-curriculum.md) |
| Individuals and organisations seeking certification | [`docs/ecosystem/certification-program.md`](../ecosystem/certification-program.md) |
| Government decision-makers building a business case | [`docs/ecosystem/business-case-template.md`](../ecosystem/business-case-template.md) |
| Procurement teams | [`docs/ecosystem/rfp-template.md`](../ecosystem/rfp-template.md) |
| Anyone exploring applications | [`docs/ecosystem/use-case-library.md`](../ecosystem/use-case-library.md) |
| Firms building a GovOps practice | [`docs/ecosystem/partner-program.md`](../ecosystem/partner-program.md) |

These documents are explicitly framed as starting points — the project
expects them to be adapted by anyone forking the codebase. They carry the
same Apache 2.0 license as the runtime.

---

## 6. The interpretive apparatus is configuration (GovOps's addition)

**Claim**: SPRIND's five elements name the rules, the editor, the AI, the
repository, and the training. They do not yet name the **interpretive
apparatus** — the prompts the AI uses to read the statute, the labels the
officer sees in the UI, the country code lists the engine compares against,
the evidence type vocabulary, the engine's resolution-day threshold logic.
These are all judgments about how the rules should be read and enforced,
and changing any of them changes the system's behaviour.

GovOps treats every one of these as a dated `ConfigValue`, governed by the
same schema, approval flow, and effective-date semantics as the rules
themselves.

| Apparatus | Where it lives in `lawcode/` |
| --- | --- |
| AI extraction prompts | [`lawcode/global/prompts.yaml`](../../lawcode/global/prompts.yaml) |
| Officer-facing UI labels (every translatable string) | [`lawcode/global/ui-labels.yaml`](../../lawcode/global/ui-labels.yaml) |
| Engine vocabularies (evidence types, country lists) | [`lawcode/global/engine.yaml`](../../lawcode/global/engine.yaml) |
| Cross-cutting global config (default language, etc.) | [`lawcode/global/config.yaml`](../../lawcode/global/config.yaml) |
| Per-jurisdiction rule parameters | [`lawcode/{ca,br,es,fr,de,ua}/config/rules.yaml`](../../lawcode/) |

The substrate that resolves all of these is the same one that resolves
the rules: [`src/govops/config.py`](../../src/govops/config.py). The
guarantee — that an evaluation on date D produces identical output to a
re-run of the same evaluation on date D — extends to every interpretive
choice the system made along the way.

This matters because Law-as-Code is otherwise vulnerable to the same drift
it claims to eliminate: if rules are versioned but prompts are not, then
the AI extracting tomorrow's rules from tomorrow's statute is operating
under different instructions than the AI that extracted today's rules
from today's statute, and the substrate quietly diverges.

GovOps fixes this by making the interpretive apparatus first-class
configuration. [ADR-008](ADRs/ADR-008-prompt-as-config-dual-approval.md)
locks the dual-approval policy for prompts: a prompt change requires both
a domain expert and a project maintainer to approve, just like a rule
change does.

---

## Cross-cutting properties preserved from v1.0

These boundaries are baked into every element above:

- **Decision support, not autonomous adjudication.** Humans remain final
  decision authorities; every recommendation routes through a review action.
- **Evidence-first.** The system flags missing evidence rather than guessing.
- **Full traceability.** Every recommendation links Decision → Rule →
  ConfigValue → Citation → Authority → Jurisdiction.
- **Reproducibility.** An evaluation on date D against jurisdiction J
  produces identical output to a re-run with the same inputs, because the
  substrate is dated.
- **Open and forkable.** Apache 2.0; no vendor lock-in; no proprietary
  extensions.

---

## What GovOps does not claim

- It is not a complete digital legal infrastructure for any jurisdiction.
  It is a working reference implementation around one bounded case type
  (pension eligibility) across six jurisdictions.
- It is not an authoritative interpretation of any statute. The
  publicly-available legislation it references is interpreted by the author
  for illustrative purposes only.
- It is not endorsed by SPRIND or any government. It is an independent
  open-source prototype that takes the SPRIND framing seriously.
- It is not a replacement for legal authority, policy expertise, or
  political judgment. It is decision support — explicit, reviewable, and
  traceable — that those authorities can use as one input among many.

---

## Where to look next

- The execution plan: [PLAN.md](../../PLAN.md)
- The strategic argument: [docs/IDEA-GovOps-v2.0-LawAsCode.md](../IDEA-GovOps-v2.0-LawAsCode.md)
- Architecture & ADRs: [docs/design/ADRs/](ADRs/)
- The repo's framing for newcomers: [README.md](../../README.md)
