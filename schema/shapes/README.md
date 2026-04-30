# Program Shape Catalog

Per [ADR-015](../../docs/design/ADRs/ADR-015-program-shape-library.md), a *program shape* is the contract a program manifest must satisfy. This directory holds the **published** shapes — the canonical library that adopters fork or implement against.

> Local shapes (jurisdiction-specific shapes that haven't been upstreamed) live under `lawcode/<jurisdiction>/_shapes/`, not here. Same schema, different scope.

## Contents

| Shape | Status | Used by |
| --- | --- | --- |
| [`old_age_pension-v1.0.yaml`](old_age_pension-v1.0.yaml) | Active (Phase A) | `lawcode/<jur>/programs/oas.yaml` for CA, BR, ES, FR, DE, UA, JP |
| [`unemployment_insurance-v1.0.yaml`](unemployment_insurance-v1.0.yaml) | Active (Phase C) | `lawcode/<jur>/programs/ei.yaml` for CA, BR, ES, FR, DE, UA (NOT JP — architectural control). Phase D authors the 6 manifests. |

## What a shape declares

See `schema/program-shape-v1.0.json` for the full schema. Briefly:

- `shape_id` — the string a manifest references in its `shape:` field
- `version` — semver; manifests pin a major version
- `rule_types_allowed` — which `RuleType` enum values may appear in a manifest
- `required_rules` — which rule types MUST be present
- `outcome_shape` — what the engine produces (`pension_full_or_partial`, `bounded_benefit_period`, `binary_eligibility`)
- `evaluator_module` / `evaluator_class` — Python implementation under `src/govops/shapes/`
- `description` — plain-language one-paragraph summary; the audience is a program leader reading the catalog before deciding whether to adopt

## Adding a new shape

1. **Local first**: declare the shape under `lawcode/<your-jur>/_shapes/<shape-id>.yaml`. Run it locally; iterate until stable.
2. **Author the evaluator** under `src/govops/shapes/<shape_id>.py` implementing the `ShapeEvaluator` protocol.
3. **File a PR** with: the YAML shape file moved to this directory, the evaluator module, isolation tests, an ADR if the shape introduces new rule types or outcome semantics.
4. **Versioning**: shapes are semver. Major bumps require an ADR. Manifests pin to a major version.

## Why a separate catalog vs. embedded in code

Per ADR-015, the **interface is the contribution**. An adopter forking GovOps for a new legal tradition can read this directory and the shape JSON Schemas without reading any of the upstream Python. POSIX-style — the catalog is the public contract.

## Out of scope

- Sub-national shapes (provinces, Länder, régions) — v4
- Shapes for adjacent domains (immigration eligibility, occupational licensing, tax credits) — each is its own v3-sized bet, not a v3 ship
- Shapes that require Ed25519-signed federation between running instances — defer until a real peer instance commits to run
