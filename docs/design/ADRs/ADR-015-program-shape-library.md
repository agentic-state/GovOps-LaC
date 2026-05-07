# ADR-015 — Canonical Program Shape Library

**Status**: Accepted
**Date**: 2026-04-29
**Track / Gate**: GovOps v3.0 — Phase A (Manifest Substrate). Locks v3 Decision Gate 2.

## Context

ADR-014 makes *Program* a first-class declarable manifest. But a manifest needs a contract: when `lovable/ca/programs/oas.yaml` declares `shape: old_age_pension`, *something* has to define what fields that shape requires, what rule types are valid, what the engine does with it, and what the result shape looks like. That something is the **canonical program shape library**.

The v3 charter names this as the "Unix bit": the contribution that makes GovOps adoptable globally is *the interface*, not *the implementation*. POSIX, not Linux. A program leader in Estonia or Kenya should be able to fork the shape library, write manifests against the shape contracts, and run their own GovOps without reading any of this repo's Python.

Three design questions need a load-bearing answer:

1. **What is a shape — a JSON Schema, a Python class, or both?**
2. **Who can register a new shape — anyone, or only the upstream repo?**
3. **How does a shape relate to the engine code that evaluates it?**

## Decision

### A shape is a published JSON Schema + a registered evaluator

```
schema/
├── program-manifest-v1.0.json          # the manifest meta-schema (per ADR-014)
├── program-shape-v1.0.json             # the shape meta-schema (declares what a shape declares)
└── shapes/
    ├── old_age_pension-v1.0.yaml       # canonical OAS-style shape
    ├── unemployment_insurance-v1.0.yaml # canonical EI-style shape (Phase C)
    └── README.md                        # contributor guide
```

A shape is declared by a YAML file that **conforms to** `schema/program-shape-v1.0.json`. The shape declares:

- `shape_id` — the string a manifest references (e.g. `old_age_pension`)
- `version` — semver; manifests pin a version
- `rule_types_allowed` — which `RuleType` enum values may appear in a manifest declaring this shape
- `required_rules` — rule types that must be present (e.g. `old_age_pension` requires at least one `age_threshold` and one `residency_minimum`)
- `outcome_shape` — what the engine produces for an eligible case (e.g. `pension_full_or_partial`, `bounded_benefit_period`)
- `description` — plain-language summary for non-coder reviewers
- `references` — pointer to the shape's evaluator module

A shape's **evaluator module** is the Python file that knows how to interpret the shape-specific outcome (e.g. `src/govops/shapes/old_age_pension.py` knows how to compute "full" vs. "partial" pension and the X/40 ratio). The evaluator implements a small interface:

```python
class ShapeEvaluator(Protocol):
    shape_id: str
    version: str

    def post_process(
        self,
        program: Program,
        case: CaseBundle,
        evals: list[RuleEvaluation],
    ) -> ShapeOutcome: ...
```

`ShapeOutcome` is a discriminated union — `PensionOutcome` (`full`/`partial`/`ineligible` + ratio), `BoundedBenefitOutcome` (`BenefitPeriod` + obligations), and so on. The base `ProgramEngine` (Phase B) handles rule dispatch; the shape evaluator handles "given the rule outcomes, what's the program-specific story to tell."

### Two-tier registration: published shapes vs. local shapes

**Published shapes** live in `schema/shapes/` and are part of this repo. Adding one is a PR with:

- The YAML shape file
- A new evaluator module under `src/govops/shapes/`
- Tests covering the evaluator in isolation
- Documentation in `schema/shapes/README.md`
- An ADR if the shape introduces new rule types or outcome semantics

A published shape becomes part of the canonical library — like a POSIX function. Other GovOps deployments can implement manifests against it and expect identical engine behavior.

**Local shapes** live in `lawcode/<jur>/_shapes/` (note the underscore prefix) and are loaded only by the deploying instance. A jurisdiction that needs a shape unique to its legal tradition can declare one without upstreaming. The schema gate validates manifests against local shapes the same way; the only difference is that local shapes don't ship to other adopters.

This two-tier model is the federation primitive without the cryptographic plumbing: an adopter can run their own GovOps with their own shapes today, and propose them upstream when they're ready.

### The engine knows shapes by registry, not by import

`src/govops/shapes/__init__.py` exposes a `SHAPE_REGISTRY: dict[str, ShapeEvaluator]`. At engine startup, the registry loads:

1. Published shapes from `src/govops/shapes/*.py` (via entry-point discovery — explicit register call per file)
2. Local shapes from `lawcode/<jur>/_shapes/*.yaml` (Phase H)

When a manifest declares `shape: old_age_pension`, the loader looks up the evaluator via `SHAPE_REGISTRY["old_age_pension"]`. Unknown shape = manifest validation failure at load time, not at evaluation time.

### Initial shape catalog

v3 ships two published shapes at v0.5.0:

#### `old_age_pension` (Phase A)

Migrated from current `OASEngine` behavior. Required rules: `age_threshold`, `residency_minimum`, `legal_status`, `evidence_required`. Optional: `residency_partial`, `calculation`, `exclusion`. Outcome shape: `PensionOutcome` (full / partial / ineligible / insufficient_evidence / escalate, with ratio for partial).

Used by: every existing OAS manifest in `lawcode/<jur>/programs/oas.yaml`.

#### `unemployment_insurance` (Phase C)

Required rules: `contribution_period`, `legal_status`, `evidence_required`, `benefit_duration_bounded`, `active_obligation`. Optional: `exclusion`, `calculation`. Outcome shape: `BoundedBenefitOutcome` (eligible weeks + start/end + active obligations list, or ineligible / insufficient_evidence / escalate).

Used by: 6 EI manifests authored in Phase D.

Two new rule types lock with this shape: `BENEFIT_DURATION_BOUNDED`, `ACTIVE_OBLIGATION` — see ADR-017.

### Shape versioning

Shapes are semver. `old_age_pension-v1.0` and `old_age_pension-v2.0` can coexist; manifests pin a version. A breaking change to a shape (new required rule, new outcome field) is a new major version; manifests stay on the old version until explicitly migrated. This is the same pattern v2 used for `schema/configvalue-v1.0.json`.

## Consequences

### Positive

- **Adopters can fork the library**: the shape catalog is the contribution surface. A national social security agency studying GovOps can fork `unemployment_insurance-v1.0.yaml`, adapt it to their statutory tradition, and run a parallel GovOps without touching this repo.
- **Engine code stays small**: the `ProgramEngine` (Phase B) is shape-agnostic. Adding a new program *shape* requires authoring a shape file + an evaluator module — bounded, reviewable, testable. Adding a new program *instance* in an existing shape requires only YAML.
- **POSIX-style interface as documentation**: the shape file IS the contract. A program leader can read `schema/shapes/old_age_pension-v1.0.yaml` and understand what an old-age pension program declares, without reading any Python.
- **Local shapes enable federation today**: an adopter can run their own GovOps with shapes upstream hasn't published yet; they propose upstream when stable. No central authority required.

### Negative

- **Two-layer schema** (manifest schema + shape schema). Mitigated by tooling: the loader checks shape conformance at manifest load time, errors are clear.
- **Shape evolution is governance**: a published shape can't change rule_types_allowed without a major-version bump and migration. Real cost; correct cost. Mitigated by versioning convention.
- **Risk of shape proliferation**: every adopter wants their own shape. Mitigated by the two-tier model — local shapes don't proliferate the canonical library; only PRs that cross the upstream review gate do.
- **Evaluator imports break encapsulation**: `src/govops/shapes/old_age_pension.py` imports `LegalRule`, `Recommendation`, `RuleEvaluation`. Acceptable — shapes are upstream-published Python; the *contract* (YAML + ShapeOutcome shape) is what's portable, not the evaluator code.

### Mitigations

- **Schema gate in CI**: every shape file under `schema/shapes/` is validated against `schema/program-shape-v1.0.json`; every manifest is validated against the manifest schema AND the declared shape's contract.
- **Shape catalog README**: `schema/shapes/README.md` documents the contribution rules — what an upstream shape needs, when to file an ADR, when local-only is the right choice.
- **Round-trip testing**: every published shape ships with at least one demo manifest in `lawcode/_shapes-fixtures/<shape-id>/` that round-trips through load → evaluate → assert.
- **Versioning discipline**: bumping a shape's major version is an ADR; minor bumps are PR-reviewed; patch bumps for typos / docs are squash-mergeable.

## Alternatives considered

### Alternative 1 — Shapes are Python-only (no YAML contract)

`old_age_pension` is only a Python class; manifests reference it by Python import path. Rejected because it kills the "fork the library, run your own" adoption story — a forking deployment now needs to ship Python, not just YAML. Also makes shape *contracts* implicit (read the source) rather than published documents.

### Alternative 2 — Shapes are JSON Schema only (no evaluator interface)

The shape is purely declarative — the engine reads the YAML and dispatches generically. Rejected because some shape outcomes require non-trivial logic (pension's full/partial/ratio computation, EI's bounded-period reassessment math). Pure declarative would push that logic into rule definitions, defeating the purpose of having shapes.

### Alternative 3 — One global shape catalog managed by an external authority

Like the IANA registry. Rejected — adds friction without payoff for an open-source MVP. The two-tier (published vs. local) model gives adopters autonomy while keeping the canonical library curated.

### Alternative 4 — Skip shapes, treat every program as fully custom

`Program.outcome_logic_class: str` pointing to a Python class. Rejected — kills symmetry. Two CA programs and two BR programs with no relationship between them is exactly what the charter is trying to avoid.

## References

- v3 charter: [docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md](../../IDEA-GovOps-v3.0-ProgramAsPrimitive.md) §"The bet: Program-as-Primitive" + §"Adoption substrate"
- v3 PLAN: [PLAN-v3.md](../../../PLAN-v3.md) §"Phase A" + §"Phase C"
- ADR-014 — Program-as-Primitive (manifest model) — companion to this ADR
- ADR-017 (pending) — New rule primitives for `unemployment_insurance` shape
- v2 schema convention: `schema/configvalue-v1.0.json`, `schema/lawcode-v1.0.json`
