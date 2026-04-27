# JSON Schemas for the `lawcode/` substrate

Two JSON Schemas (Draft 2020-12) define the on-disk shape of every dated `ConfigValue` record. They are the contract a non-Python contributor edits against when adding a threshold, a UI label, or a prompt.

| File | Describes |
| --- | --- |
| [`configvalue-v1.0.json`](configvalue-v1.0.json) | A **single** record. Mirrors the SQLModel in [`src/govops/config.py`](../src/govops/config.py). |
| [`lawcode-v1.0.json`](lawcode-v1.0.json) | A YAML **file** under `lawcode/` — `defaults` + `values:` array. Each item, after merging defaults, must satisfy `configvalue-v1.0.json`. |

## How CI uses them

[`scripts/validate_lawcode.py`](../scripts/validate_lawcode.py) runs both schemas against every YAML under `lawcode/`. It runs in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) on every push, so a malformed YAML fails the build before merge. Locally:

```bash
python scripts/validate_lawcode.py
```

Negative coverage lives in [`tests/test_phase5_schema.py`](../tests/test_phase5_schema.py) — including a deliberately malformed YAML to prove the gate is not toothless.

## Editor support

Every YAML file under `lawcode/` carries this pragma at the top:

```yaml
# yaml-language-server: $schema=../../schema/lawcode-v1.0.json
```

VS Code with the Red Hat YAML extension uses it to provide autocomplete, validation, and hover docs while you edit. The path depth differs per file (jurisdiction rules nest one level deeper); the pragma in each file is correct for its location.

## Field reference

A `ConfigValue` record carries these fields. File-level `defaults` merge into each `values:` entry, so common fields can be hoisted.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `key` | string | yes | Lowercase dotted. Pattern: `^[a-z0-9][a-z0-9._-]*$`. e.g. `ca.rule.age-65.min_age` |
| `value` | any | no | Number, string, bool, list, or mapping. Shape must match `value_type` |
| `value_type` | enum | yes | `number` · `string` · `bool` · `list` · `object` · `enum` · `prompt` · `formula` |
| `domain` | string | yes | `rule` · `engine` · `ui` · `prompt` · `config` · `enum` — open vocabulary, but the canonical set is fixed during Phases 1–4 |
| `jurisdiction_id` | string \| null | no | `ca-oas`, `br-inss`, `fr-cnav`, etc. `null` or `"global"` for cross-jurisdictional records |
| `effective_from` | ISO-8601 date or datetime | yes | The instant from which the record is in effect |
| `effective_to` | ISO-8601 date or datetime | no | Exclusive upper bound; omit or set null for open-ended |
| `citation` | string | no | Statutory or doctrinal source. Editorial convention requires it for `domain="rule"` records |
| `author` | string | yes (any record) | Who wrote this record. Defaults to `system:yaml` for loader-inserted records |
| `approved_by` | string | yes (`prompt` only) | Required when `value_type == "prompt"` per [ADR-008](../docs/design/ADRs/ADR-008-prompt-as-config-dual-approval.md) Gate 4 (dual approval). Optional otherwise |
| `rationale` | string | no | Why this value, in human terms |
| `supersedes` | string | no | The `id` of the prior version this record replaces; forms a linked version chain |
| `status` | enum | no | `draft` · `pending` · `approved` · `rejected`. Only `approved` records participate in resolution. Defaults to `approved` for YAML-loaded records |
| `language` | BCP-47 tag | no | Used by `domain="ui"` records to scope per-language values (`en`, `fr`, `pt-BR`, etc.) |

## Examples

### A rule parameter

```yaml
# yaml-language-server: $schema=../../../schema/lawcode-v1.0.json
defaults:
  domain: rule
  jurisdiction_id: ca-oas
values:
  - key: ca.rule.age-65.min_age
    value: 65
    value_type: number
    effective_from: "1985-01-01"
    citation: "OAS Act, R.S.C. 1985, c. O-9, s. 3(1)"
    author: govops-maintainers
    approved_by: govops-maintainers
    rationale: "Original statutory minimum age."
```

### A UI label (one record per language)

```yaml
# yaml-language-server: $schema=../../schema/lawcode-v1.0.json
defaults:
  domain: ui
  jurisdiction_id: global
values:
  - key: ui.label.case.applicant_profile.fr
    value: "Profil du demandeur"
    value_type: string
    language: fr
    effective_from: "1900-01-01"
```

### A prompt (dual-approved per ADR-008)

```yaml
# yaml-language-server: $schema=../../schema/lawcode-v1.0.json
defaults:
  domain: prompt
  jurisdiction_id: global
  value_type: prompt
  effective_from: "1900-01-01"
values:
  - key: global.prompt.encoder.extraction_system
    citation: "GovOps encoder v0.2"
    rationale: "Initial extraction system prompt."
    author: govops-maintainers
    approved_by: govops-maintainers
    value: |-
      You are a legal rule extraction engine for GovOps.
      ...
```

## Resolution semantics

A record is in effect for `(key, evaluation_date, jurisdiction_id, language?)` when:

- `effective_from <= evaluation_date`, AND
- `effective_to is null` OR `evaluation_date < effective_to`, AND
- `status == "approved"`, AND
- the jurisdiction matches (or, for global records, the resolver falls back from a jurisdictional miss)

Multiple records for the same key with overlapping windows resolve to the latest `effective_from`. Disciplined supersession (closing the prior record's `effective_to` to the new record's `effective_from`) keeps the windows non-overlapping.

## Versioning policy

- Filenames use semver: `configvalue-v1.0.json`, `lawcode-v1.0.json`.
- **Backwards-compatible additions** (new optional field, looser constraint) bump the **minor** version.
- **Breaking changes** that could fail existing YAML cut a new **major** version (`v2.0.json`); the old file stays in the directory so v1 consumers keep working.
- The `$id` URL inside each file is canonical.

## Adding a new field

1. Update both `configvalue-v1.0.json` (record shape) and `lawcode-v1.0.json` (the mirrored per-record properties under `values.items.properties`).
2. Add the field to `ConfigValue` in [`src/govops/config.py`](../src/govops/config.py).
3. Add validation cases in [`tests/test_phase5_schema.py`](../tests/test_phase5_schema.py) — at minimum, one valid example and one rejection for the wrong shape.
4. Update the field reference table above.
5. Run `python scripts/validate_lawcode.py` to confirm every existing YAML still validates against the updated schema.

## Related ADRs

- [ADR-003](../docs/design/ADRs/ADR-003-yaml-over-json.md) — YAML over JSON for editor round-trip and comment support
- [ADR-006](../docs/design/ADRs/ADR-006-per-parameter-granularity.md) — one record per leaf value, not per-rule blobs
- [ADR-008](../docs/design/ADRs/ADR-008-prompt-as-config-dual-approval.md) — `value_type=prompt` records require both `author` and `approved_by`
- [ADR-010](../docs/design/ADRs/ADR-010-sqlite-from-phase-6.md) — runtime ConfigValue writes land in embedded SQLite from Phase 6; YAML in `lawcode/` remains the authored source-of-truth
