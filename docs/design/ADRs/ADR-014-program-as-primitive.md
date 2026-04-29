# ADR-014 — Program-as-Primitive (Manifest Model)

**Status**: Accepted
**Date**: 2026-04-29
**Track / Gate**: GovOps v3.0 — Phase A (Manifest Substrate). Locks v3 Decision Gate 1.

## Context

v2 (Law-as-Code) made *jurisdiction* a first-class declarable thing: the ConfigValue substrate (ADR-006, ADR-010) stores parameter values keyed by `<jurisdiction>-<program>.<domain>.<scope>.<param>`, and `lawcode/<jur>/config/*.yaml` is the authored source-of-truth. The substrate already namespaces by program (e.g. `jurisdiction_id: ca-oas` in `lawcode/ca/config/rules.yaml`) — but the *structure* of a program (its rules, authority chain, legal documents, demo cases) lives in Python under `seed.py` / `jurisdictions.py`. Adding a new program today means editing Python; adding a new jurisdiction means editing Python.

The v3 charter (`docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md`) names this as the load-bearing v3 bet: *Program* should become a first-class declarable manifest the way *jurisdiction* is. Add a program once, drop a manifest in a directory, the engine picks it up — for every jurisdiction that adopts the manifest. The proof is **Employment Insurance** instantiated symmetrically across the 6 active jurisdictions (CA, BR, ES, FR, DE, UA), with JP staying as the architectural control.

Three design questions need a load-bearing answer:

1. **Where does a program manifest live, and what is its file shape?**
2. **What does the manifest declare directly vs. what does it reference into the substrate?**
3. **How does the manifest relate to the canonical shape library (ADR-015)?**

## Decision

### A program is a YAML manifest under `lawcode/<jur>/programs/<program-id>.yaml`

The directory layout mirrors the v2 lawcode/ pattern:

```
lawcode/
├── REGISTRY.yaml
├── ca/
│   ├── jurisdiction.yaml          # v2 — unchanged
│   ├── config/                    # v2 — ConfigValue substrate, unchanged
│   │   ├── rules.yaml             # OAS parameter values
│   │   └── ei-rules.yaml          # NEW (Phase D) — EI parameter values
│   └── programs/                  # NEW (Phase A)
│       ├── oas.yaml               # NEW — CA Old Age Security manifest
│       └── ei.yaml                # NEW (Phase D) — CA Employment Insurance manifest
├── br/
│   └── programs/
│       ├── oas.yaml
│       └── ei.yaml
…
└── jp/
    └── programs/
        └── oas.yaml               # JP gets OAS only — architectural control
                                    # (no ei.yaml — symmetric extension is opt-in)
```

The manifest is YAML, schema-validated by `schema/program-manifest-v1.0.json`, loaded by `src/govops/programs.py::load_program_manifest(path)`. Symmetry with `lawcode/<jur>/jurisdiction.yaml` is intentional — same directory ergonomics, same loader pattern, same CI validation gate.

### The manifest declares structure; the substrate stores values

A program manifest declares the **shape** of the program: what rules exist, what they cite, which substrate keys they read from. It does **not** declare the *values* of those parameters — those are ConfigValue records in `lawcode/<jur>/config/<program>-rules.yaml`, dated and supersedable per ADR-010 / ADR-013.

```yaml
# lawcode/ca/programs/oas.yaml
schema_version: "1.0"
program_id: oas
jurisdiction_id: ca
shape: old_age_pension                     # references schema/shapes/old_age_pension-v1.0.yaml
status: active

name:
  en: "Old Age Security"
  fr: "Sécurité de la vieillesse"

description:
  en: "Federal monthly pension for residents of Canada aged 65 and over."
  fr: "Pension mensuelle fédérale pour les résidents du Canada âgés de 65 ans et plus."

authority_chain:
  - id: auth-constitution
    layer: constitution
    title: "Constitution Act, 1867"
    citation: "30 & 31 Vict., c. 3 (U.K.), s. 91(2A)"
    effective_date: 1867-07-01
    url: "https://laws-lois.justice.gc.ca/eng/const/page-1.html"
  - id: auth-oas-act
    layer: act
    title: "Old Age Security Act"
    citation: "R.S.C., 1985, c. O-9"
    effective_date: 1985-01-01
    parent: auth-constitution
    url: "https://laws-lois.justice.gc.ca/eng/acts/o-9/"
  # … (full chain elided for brevity)

legal_documents:
  - id: doc-oas-act
    type: statute
    title: "Old Age Security Act"
    citation: "R.S.C., 1985, c. O-9"
    effective_date: 1985-01-01
    sections:
      - ref: "s. 3(1)"
        heading: "Payment of pension"
        text: |
          Subject to this Act and the regulations, a monthly pension may be paid to
          every person who, being sixty-five years of age or over, has resided in Canada
          after reaching eighteen years of age and after July 1, 1977 for periods the
          aggregate of which is not less than ten years.

rules:
  - id: rule-age-65
    rule_type: age_threshold
    description: "Applicant must be 65 years of age or older"
    formal_expression: "applicant.age >= 65"
    citation: "Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(1)"
    source_document_id: doc-oas-act
    source_section_ref: "s. 3(1)"
    param_key_prefix: ca.rule.age-65
    parameters:
      min_age: { ref: "ca.rule.age-65.min_age" }   # resolved through ConfigStore
  # … (other rules elided)
  - id: rule-calc-oas-amount
    rule_type: calculation
    citation: "Old Age Security Act, R.S.C. 1985, c. O-9, ss. 7-8"
    parameters:
      currency: { ref: "ca.calc.oas.currency" }
      period: { ref: "ca.calc.oas.period" }
      formula: { include: "formulas/oas-amount.yaml" }   # AST tree in a sibling file

demo_cases:
  - id: demo-case-001
    applicant:
      date_of_birth: 1955-03-15
      legal_name: "Margaret Chen"
      legal_status: citizen
      country_of_birth: CA
    residency_periods:
      - country: Canada
        start_date: 1955-03-15
        verified: true
    evidence_items:
      - type: birth_certificate
        provided: true
        verified: true
      - type: tax_record
        provided: true
        verified: true
```

**Key design points**:

- `shape: old_age_pension` references the canonical shape library (ADR-015). The shape defines what rule types are valid for this kind of program, what fields the manifest must include, and what evaluator runs.
- `parameters: { min_age: { ref: "ca.rule.age-65.min_age" } }` — substrate reference, not literal value. Quarterly indexation of `min_age` happens via ConfigValue supersession, not by editing the manifest.
- `formula: { include: "formulas/oas-amount.yaml" }` — formula AST trees (ADR-011) live in sibling files for readability; the loader resolves the include.
- `authority_chain`, `legal_documents`, `demo_cases` are **declared in the manifest** — they're the structure-of-the-program, not parameters. Editing them is a code-review-grade change.

### One manifest = one program in one jurisdiction

`lawcode/ca/programs/oas.yaml` is CA's OAS. `lawcode/br/programs/oas.yaml` is Brazil's BPC-LOAS or equivalent old-age program. The two manifests are independent — they share the *shape* (`old_age_pension`) but their authority chains, legal documents, demo cases, and parameter substrate keys are jurisdiction-specific.

This is the **symmetry rule** in mechanical form: adding `ei` as a program means authoring 6 manifests (one per active jurisdiction) plus 6 ConfigValue files plus i18n keys in 6 locales. JP is excluded by the absence of `lawcode/jp/programs/ei.yaml` — that absence is the architectural control.

### The loader produces existing model objects

`load_program_manifest(path) -> Program` returns a `Program` Pydantic model that wraps the existing `LegalRule`, `LegalDocument`, `AuthorityReference`, `CaseBundle` objects from `src/govops/models.py`. Engine code below the loader stays unchanged in Phase A — `OASEngine(rules=program.rules).evaluate(case)` works byte-identically. Phase B then renames `OASEngine` to `ProgramEngine` and decouples the pension-shaped outcome logic into a shape-specific post-processor.

The `Program` model itself:

```python
class Program(BaseModel):
    program_id: str
    jurisdiction_id: str
    shape: str                              # references shape catalog
    status: str = "active"
    name: dict[str, str] = {}               # lang -> localized name
    description: dict[str, str] = {}
    authority_chain: list[AuthorityReference]
    legal_documents: list[LegalDocument]
    rules: list[LegalRule]
    demo_cases: list[CaseBundle] = []
    schema_version: str = "1.0"
```

### Backwards compatibility

Phase A is purely additive. `seed.py` and `jurisdictions.py` continue to work; the manifest loader is a parallel path. Phase B's engine refactor preserves byte-identical OAS output via deprecated aliases for one cycle. Phase I drops the deprecation. Until Phase I, both `OASEngine(rules=oas_rules)` (legacy) and `ProgramEngine(program=program).evaluate(case)` (manifest-driven) produce the same recommendation for the same case.

## Consequences

### Positive

- **Symmetry rule has a mechanical surface**: "add a program" = "add a manifest under `programs/`" in N directories.
- **No engine work to add a program in a known shape**: a contributor with a new jurisdiction's old-age pension program writes one YAML, one ConfigValue file, and i18n keys. No Python edits.
- **Shape catalog becomes the contribution surface**: the canonical shapes (ADR-015) are forkable by adopters who run their own GovOps. POSIX-style.
- **Clean separation of structure (manifest) vs. value (substrate)**: the v2 ConfigValue substrate stays unchanged; v3 is an *additive* layer above it.
- **Demo cases co-located with the program**: a contributor reading `lawcode/ca/programs/oas.yaml` sees the rules and the demo data in one place.

### Negative

- **Two YAML files per program per jurisdiction** (manifest + config rules). Mitigated by directory convention; not duplicative — the two carry different concerns.
- **Loader complexity grows**: includes (`formula: { include: "formulas/oas-amount.yaml" }`) and substrate refs (`{ ref: "..." }`) require a small DSL. Mitigated by JSON Schema validation and constrained syntax (only two reference types).
- **Phase B engine refactor is non-trivial**: `OASEngine._determine_outcome` hardcodes pension-type and 40-year ratio. Mitigated by deprecation alias + byte-identical regression tests as Phase B exit gate.
- **Authority chain duplication risk**: CA's Constitution Act appears in every CA program manifest. Acceptable for v3 (the duplication is small, audit-grade); v3.1 may refactor to shared `lawcode/ca/authority/*.yaml` files.

### Mitigations

- **JSON Schema gate in CI**: every `lawcode/*/programs/*.yaml` is validated against `schema/program-manifest-v1.0.json` on PR.
- **Round-trip test**: load manifest → produce LegalRule list → must equal `seed.py`'s list for CA OAS in Phase A; this guards the migration.
- **Shape catalog schema**: ADR-015 publishes the meta-schema for shapes, so a new shape goes through review before manifests can declare it.
- **Deprecation cycle**: `OASEngine` alias preserved through Phase H; removed at Phase I cutover. CLAUDE.md tracks deprecation status.

## Alternatives considered

### Alternative 1 — Programs in `seed.py`/`jurisdictions.py`, no manifest

Status quo. Rejected because adding the second program (EI) symmetrically across 6 jurisdictions in Python would mean editing two source files for every jurisdiction × program — exactly the friction the charter is trying to remove. Doesn't enable the "Unix of Public Sector" adoption story.

### Alternative 2 — One mega-manifest per jurisdiction containing all programs

`lawcode/ca/programs.yaml` containing both OAS and EI. Rejected because:
- Programs evolve at different cadences; per-program files keep PR diffs scoped
- A jurisdiction with 10 programs would have an unreadable single file
- Forking a single program's shape into another jurisdiction is harder when programs are bundled

### Alternative 3 — Manifest in JSON, not YAML

Rejected for the same reasons ADR-003 chose YAML for v2: comments matter for legal annotation; editor round-trip; multi-line strings (statutory text); YAML is a human-authored surface, JSON is a wire format.

### Alternative 4 — Ship rules in the manifest as inline values, no substrate ref

`min_age: 65` instead of `min_age: { ref: "ca.rule.age-65.min_age" }`. Rejected because it would require editing the manifest for quarterly indexation events, breaking the "configure-without-deploy" property that v2 paid for. The substrate is the source-of-truth for values; the manifest is the source-of-truth for structure.

## References

- v3 charter: [docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md](../../IDEA-GovOps-v3.0-ProgramAsPrimitive.md)
- v3 PLAN: [PLAN-v3.md](../../../PLAN-v3.md) §"Phase A — Manifest substrate"
- ADR-003 (YAML over JSON for artefacts)
- ADR-006 (Per-parameter granularity in substrate)
- ADR-010 (SQLite from Phase 6)
- ADR-011 (Calculation rules as typed AST)
- ADR-013 (Event-driven reassessment)
- ADR-015 (Canonical Program Shape Library) — companion to this ADR
