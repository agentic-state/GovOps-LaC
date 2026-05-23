# ADR-019 -- Lawcode jurisdiction-metadata block

**Status**: Accepted
**Date**: 2026-05-10
**Track / Gate**: GovOps v3.1 -- Lane 1 (foundation). Schema slot prerequisite for ADR-020 (lawcode-as-discovery) and ADR-022 (authoring substrate).

## Context

v3.0 shipped the Program-as-Primitive substrate at `lawcode/<jur>/programs/<id>.yaml` and the `govops init <iso-code>` scaffolder, but the running engine still discovers jurisdictions from a hand-written Python literal `JURISDICTION_REGISTRY` at `src/govops/jurisdictions.py:1430`. Phase H promised "out-of-the-box adoption" yet the operator runbook on `/admin` documents the broken story explicitly:

> *Register the jurisdiction in `src/govops/jurisdictions.py` with its authority chain and demo cases.*

The 2026-05-10 hands-on playthrough confirmed: a contributor who runs `govops init pl` ends up with a `lawcode/pl/` directory the running app cannot see. The lawcode YAML substrate today carries only ConfigValue records (per ADR-003) and program manifests (per ADR-014). It has no slot for the jurisdiction-level identity facts the engine needs to register a jurisdiction: human-readable name, ISO country code, government level, legal tradition, language regime, default language.

ADR-020 will retire the Python literal and make `lawcode/` the discovery source. That move is impossible without an on-disk schema for jurisdiction identity. ADR-022 will extend in-app authoring to non-ConfigValue records; new jurisdictions authored through the wizard need the same on-disk projection target.

This ADR defines the slot.

## Decision

Add an optional top-level `jurisdiction:` block to any lawcode YAML file, validated by `schema/lawcode-v1.0.json` via an inline `$defs.jurisdictionMetadata` definition. The block is structurally distinct from ConfigValue records (`defaults:` / `values:`) and may co-exist with them in the same file.

### Block shape

```yaml
jurisdiction:
  id: jur-ca-federal              # required; pattern ^jur-[a-z][a-z0-9-]+$
  country: CA                     # required; ISO 3166-1 alpha-2, uppercase
  level: federal                  # required; enum
  parent_id: null                 # optional; null or a jurisdiction id for sub-national
  name:                           # required; >=1 IETF-tagged display name
    en: Canada
    fr: Canada
  legal_tradition: bijural        # optional; enum
  language_regime: en+fr          # optional; short canonical label
  default_language: en            # required; IETF tag
```

### Enums

- `level`: `federal | national | provincial | state | regional | municipal`
- `legal_tradition`: `common_law | civil_law | bijural | mixed | religious | customary`

`bijural` deliberately denotes mixed common-law / civil-law systems (Canada, Scotland, Louisiana). `mixed` covers other hybrid combinations.

### File-level posture

Existing `lawcode-v1.0.json` required `values`. After ADR-019 the file-shape is `anyOf [{required: values}, {required: jurisdiction}]`. A file may carry:

1. ConfigValue substrate only (today's 7 jurisdictions' `config/jurisdiction.yaml` -- back-compat preserved, schema unchanged for these)
2. Jurisdiction metadata only (`govops init` may emit a metadata-only `jurisdiction.yaml` at the top of `lawcode/<code>/`)
3. Both blocks side-by-side (the canonical end state once Lane 2 migration consolidates)

`additionalProperties: false` stays at the file level so typos surface loudly. The metadata block also enforces `additionalProperties: false` so contributor typos in `legel_tradition` or `defualt_language` fail the gate immediately.

### Schema location

The metadata definition is inlined in `schema/lawcode-v1.0.json` under `$defs.jurisdictionMetadata` rather than living in a separate `jurisdiction-metadata-v1.0.json`. Rationale:

- One file, one validator pass through `Draft202012Validator(lawcode_schema)` -- `validate_lawcode.py` and `test_phase5_schema.py` need no new ref-resolution plumbing
- The block is *part of* the lawcode file shape; an independent file would imply it travels independently, which it does not
- The README maintains the "one schema = one shape" pattern by documenting the metadata block as a property of the lawcode file shape

### CLI scaffolding

`govops init <code>` (`src/govops/cli_init.py:_jurisdiction_yaml`) emits the metadata block populated with TODO markers. Every required field has either a placeholder (`country: <CODE>`) or a TODO comment annotating the allowed enum values. A scaffolded `jurisdiction.yaml` validates against the schema on day one; the contributor's first `pytest -q` confirms structure before any TODO is filled.

## Consequences

### Positive

- ADR-020 (lawcode-as-discovery) gains the schema slot it needs to retire the Python literal
- ADR-022 (authoring substrate) gains the on-disk projection target for the Onboard wizard
- Schema validator catches typos in jurisdiction identity before runtime
- The 7 existing `config/jurisdiction.yaml` files validate unchanged (back-compat)
- `govops init` produces a fully schema-valid skeleton from day one

### Negative

- The metadata block is duplicated across two locations during the v3.1 transition: Python `Jurisdiction` dataclass (still load-bearing until ADR-020 lands) and YAML `jurisdiction:` block. Lane 2 closes the duplication by treating Python as the read-side projection of YAML. Until then, a contributor editing both must keep them in sync; tests assert equivalence.
- Contributors authoring jurisdiction.yaml by hand must remember that ConfigValue `jurisdiction_id` (e.g. `ca-oas`) and metadata `jurisdiction.id` (e.g. `jur-ca-federal`) are different identifiers. The mismatch is documented in the schema description; v3.2 may unify the namespace.

### Neutral

- Schemas for program manifests (`program-manifest-v1.0.json`) are unchanged. Authority chain, legal documents, rules, and demo cases continue to live in `programs/<id>.yaml`. Only jurisdiction-level identity moves into the new slot.

## Alternatives considered

### Separate `schema/jurisdiction-metadata-v1.0.json` file

Rejected: forces ref resolution in `validate_lawcode.py` and `test_phase5_schema.py` for no functional benefit. The block is a property of the lawcode file, not an independent artefact.

### Storing metadata as ConfigValues with `domain: jurisdiction`

Rejected: ConfigValue records are time-versioned, citation-bearing, dual-approval-gated parameter-tuning records. Jurisdiction identity is not parameter-tunable -- it's the structural fact that defines what a parameter belongs to. Squeezing identity through the ConfigValue mold would require nine artificial ConfigValue keys per jurisdiction (`jurisdiction.<code>.id`, `.country`, `.level`, ...) and would obscure the structural distinction between identity and parameters.

### Embedding metadata inside each program manifest

Rejected: a jurisdiction with N programs would carry the same identity facts N times, inviting drift. The metadata is per-jurisdiction, not per-program, so the YAML shape should reflect that.

## References

- v3 charter -- Phase H, the original adoption-substrate promise (see [`docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md`](../../IDEA-GovOps-v3.0-ProgramAsPrimitive.md))
- ADR-014 -- program manifests under `lawcode/<jur>/programs/<id>.yaml`
- ADR-003 -- ConfigValue substrate file shape
- `schema/lawcode-v1.0.json` -- the file shape this ADR extends
- `src/govops/cli_init.py` -- the scaffolder this ADR updates
- v3.1 plan, Lane 1 -- this ADR's implementation context

## Amendment 2026-05-10 -- legal_tradition relaxed to free-form

L2 (data migration) surfaced that the 7 running jurisdictions carry prose `legal_tradition` strings -- "Bijural (common law / civil law)" for Canada, "Civil law (Romano-Germanic)" for Brazil, "Civil law (Japanese hybrid; German + French + post-war common-law influence)" for Japan -- with semantic detail the original 6-bucket enum cannot represent. Forcing those into the enum would either lose detail or require a parallel `legal_tradition_detail` field, which conflates intent with prose.

The cleaner call: relax `legal_tradition` from enum to free-form string with `minLength: 1`. The schema description still lists the canonical short buckets (`common_law`, `civil_law`, `bijural`, `mixed`, `religious`, `customary`) as recommended for new entries, so wizard-driven authoring (ADR-022) defaults toward the structured bucket set while back-fill from the existing prose round-trips unchanged. A tighter taxonomy may land in v3.2 once concrete UI requirements settle (e.g. a comparison surface that needs structured matching across the 7 traditions).

Test coverage updated: `test_metadata_invalid_legal_tradition_fails` (L1) is replaced by `test_metadata_legal_tradition_is_free_form` (L2) asserting that representative prose strings validate while the empty string remains rejected.
