# ADR-003 — YAML over JSON for Law-as-Code artefacts

**Status**: Accepted
**Date**: 2026-04-25
**Gate**: 1 (locked at end of Phase 0)
**Context**: [PLAN.md](../../../PLAN.md) §3 requires choosing the on-disk format for `lawcode/<jurisdiction>/config/*.yaml` artefacts before Phase 3 begins.

---

## Decision

**YAML 1.2** is the on-disk format for all Law-as-Code artefacts under `lawcode/`.

JSON Schema (`schema/configvalue-v1.0.json`, `schema/lawcode-v1.0.json`) is the validation contract. CI validates every YAML file against the schema (Phase 5). The schema is published as a language-agnostic public artefact; YAML is one valid serialization.

## Rationale

| Criterion | YAML | JSON |
| --- | --- | --- |
| Comments (essential for legal annotation) | Yes | No |
| Diff readability for non-developer reviewers | High | Medium |
| Editor round-trip preserves formatting | Generally yes | Yes |
| Schema validation tooling | Good (via JSON Schema after parse) | Native |
| Risk of subtle parsing surprises | Medium (Norway problem, multiline literals) | Low |
| Familiarity for legal/policy contributors | Higher in 2026 | Higher with developer tools |

Comments are decisive. Legal contributors need to annotate why a value was chosen, the case law that influenced it, the implementing memo from the program — without that, the audit trail loses provenance. JSON forces this metadata into a sibling file or a `_comment` key, both of which are second-class.

## Mitigations for YAML risks

- **YAML 1.2 only** (no YAML 1.1; stops the Norway problem and other type-coercion surprises).
- **Schema-first**: every YAML file declares `# yaml-language-server: $schema=...` at the top; CI validates the parsed structure against the JSON Schema before accepting.
- **No anchors/aliases** in lawcode YAML: keep the on-disk shape directly mappable to the schema. Reuse happens at the ConfigStore layer (global-scope vs jurisdiction override), not via YAML anchors.
- **Quote all string scalars** that look like booleans, dates, or numbers (`"on"`, `"yes"`, `"01"`). Reviewers flag any unquoted such strings in PR review.
- **Single trailing newline**, **2-space indent**, **no tabs** — enforced via pre-commit `yamllint`.

## Consequences

- Phase 3 introduces a YAML loader: `ConfigStore.load_from_yaml(path)`.
- Phase 5 publishes JSON Schemas as the canonical artefact; YAML is a serialization of the schema.
- A future binary or columnar format could be added (Parquet for bulk export, for example) without changing the canonical schema.
- Encoding pipeline (Phase 4) emits commit-ready YAML, not Python.
- Federation (Phase 8) fetches YAML files; checksum/signing (Gate 7) operates on the YAML bytes.

## Out of scope

- TOML, HOCON, or other formats. YAML wins on legal-annotation, JSON wins on schema; the combination above gives both.
- Per-jurisdiction format flexibility. Every jurisdiction uses the same YAML+Schema combination to keep federation tractable.
