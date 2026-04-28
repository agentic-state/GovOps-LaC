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

## Resolution semantics — derived backwards from the end render

The cleanest way to understand what's needed is to start at the end (a citizen reads a rendered page) and trace backwards to the inputs that produced the result.

**Step 1 — The end**: a citizen viewing a French page sees the string `"Profil du demandeur"`.

**Step 2 — How that string got there**: at SSR/render time, the i18n layer (`web/src/lib/i18n.ts` on the frontend, `src/govops/i18n.py` on the backend) was asked for the string for `ui.label.case.applicant_profile` in French.

**Step 3 — What the i18n layer asked the substrate**: by convention, language is encoded as a **suffix in the key** for `domain="ui"` records. The i18n layer issues `resolve(key="ui.label.case.applicant_profile.fr", evaluation_date=now, jurisdiction_id="global")` and reads the returned record's `value`.

**Step 4 — What the substrate did to answer**: the resolver scans approved records matching the key + jurisdiction, filters by the in-effect window, and returns the latest by `effective_from`.

A record is **in effect** for `(key, evaluation_date, jurisdiction_id)` when all four hold:

- `status == "approved"` — drafts, pending, and rejected records do not resolve
- `effective_from <= evaluation_date`
- `effective_to is null` OR `evaluation_date < effective_to`
- jurisdiction matches — exact match wins; a jurisdictional miss falls back to global (`jurisdiction_id == null` or `"global"`). **No fallback in the other direction**: a global record won't be returned to a jurisdiction-specific query unless no jurisdictional record matches.

If multiple records satisfy the window (overlapping supersession), the resolver returns the latest by `effective_from`.

### What the substrate does **not** do

These responsibilities live in the *caller*, not the resolver:

| Concern | Where it lives | Why |
| --- | --- | --- |
| Language fallback (`fr` → `en` if FR missing) | i18n layer ([`src/govops/i18n.py`](../src/govops/i18n.py), [`web/src/lib/i18n.ts`](../web/src/lib/i18n.ts)) | Language is a *key suffix* convention for UI labels; the resolver treats `ui.label.foo.fr` and `ui.label.foo.en` as completely different keys |
| Default-language preference per request | i18n layer | The user's locale is a request-level concern, not a substrate-level one |
| Citation back-trace | Caller renders the citation field; substrate just stores it | Provenance is data, not behaviour |
| Reverse impact (which rules cite this section?) | Phase 7 reverse-index endpoint | Different access pattern; substrate's primary index is by key |

This separation is deliberate: the substrate is dumb-on-purpose. A small, predictable resolver beats a clever one when audit-reproducibility is the contract.

### Disciplined supersession

Adding a new value for an existing key:

1. **Close the prior record** by setting its `effective_to` to the new record's `effective_from`.
2. **Insert a new record** with the new value, citation, rationale, and `effective_from`. Use `supersedes` to point at the prior id.

This keeps the in-effect windows non-overlapping — only one record is in effect for a given `(key, jurisdiction_id, evaluation_date)` tuple. The `ConfigStore.supersede()` method automates the close+insert atomically.

**Don't edit the prior record's `value` in place.** The substrate keeps both records so a case evaluated last year remains reproducible against the rules in force then.

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
