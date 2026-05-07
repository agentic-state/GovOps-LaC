# ADR-006 — Per-parameter ConfigValue granularity

**Status**: Accepted
**Date**: 2026-04-25
**Gate**: 2 (locked at start of Phase 1)
**Context**: [PLAN.md](../../../PLAN.md) §3 requires choosing the granularity of `ConfigValue` records before the substrate is built. The choice is between **per-parameter** (one `ConfigValue` per leaf number/string/enum) and **per-rule** (one `ConfigValue` carrying the whole rule's parameter dict).

---

## Decision

`ConfigValue` records are **per-parameter**. Each leaf parameter in a `LegalRule.parameters` dict, each translation key, each enum-member list, and each prompt body becomes its own `ConfigValue` row, addressed by a hierarchical dotted key:

```
<jurisdiction>-<program>.<domain>.<rule-or-scope>.<param>
```

Examples:
- `ca-oas.rule.age-65.min_age` — the OAS minimum-age threshold (number)
- `ca-oas.rule.residency.min_years` — the OAS minimum residency years (number)
- `ca-oas.rule.residency-partial.divisor` — the partial-pension denominator (number)
- `ca-oas.enum.legal_status.accepted` — the accepted-statuses list for OAS (list)
- `global.ui.label.cases.title` — the "Cases" UI label, language-scoped via `jurisdiction_id="global"` and a separate per-locale key path under it
- `global.prompt.encoder.extraction_system` — the encoder system prompt (prompt)

The opposite — per-rule blobs — is **rejected**.

## Rationale

| Criterion | Per-parameter (chosen) | Per-rule (rejected) |
| --- | --- | --- |
| Versioning a single threshold (e.g. min_age 65 → 67) | One row, one citation, one effective_from | Re-version the entire rule's parameter dict |
| Citation scoping | Each parameter cites its own statute section | One citation for the rule, even if its parameters come from different sections |
| Diff readability for reviewers | Smallest possible diff | Whole-blob diff every time |
| Approval blast radius | Approve only the value that changed | Approve a blob that includes parameters nobody touched |
| Reverse-index queries (Phase 7) | "Which parameters depend on §3(1)?" answers cleanly | Every blob references every section it touches; queries collide |
| Rendering in admin UI (Phase 6) | One value, one timeline | Whole-blob timeline; harder to scan |
| Storage cost | Higher row count | Lower row count |
| Migration cost from current Python constants | Higher (more keys to seed) | Lower (mirror existing dicts) |

The "configure-without-deploy" thesis of v2.0 is the load-bearing argument: a maintainer must be able to amend **one number** through the admin UI without touching unrelated values, with that one number's citation, rationale, and approver visible to a future auditor. Per-parameter granularity is the only shape that delivers this directly.

The storage-cost objection is moot because of [ADR-007](ADR-007-in-memory-storage.md) (in-memory only). Row count of even ~10× the current parameter count is comfortably under any meaningful memory ceiling.

## Key schema rules

1. **Hierarchical, dot-separated, kebab-case** within each segment. No spaces, no underscores in segment bodies (segment names themselves may contain hyphens for readability, e.g. `age-65`).
2. **Three required segments minimum**: scope (`<jurisdiction>-<program>` or `global`), domain (`rule` / `enum` / `ui` / `prompt` / `engine`), and the leaf identifier.
3. **`global` scope** for cross-jurisdictional values: UI labels, prompts, default language, etc. `jurisdiction_id` on the `ConfigValue` is `null` (or the literal string `"global"`) for these.
4. **`jurisdiction_id`** on the record is the canonical authority — the key prefix is a convention, but resolution always uses `(key, evaluation_date, jurisdiction_id)`.
5. **Translations** are addressed as `global.ui.label.<key>` with one `ConfigValue` per `(key, language)`. The language goes in a metadata field, not the key path. (Revisit if Phase 3 YAML shape calls for per-locale files.)

## Consequences

- Phase 2 migration touches **every parameter dict, every translation key, every enum**. Lockstep across all 6 jurisdictions per [PLAN.md §Phase 2](../../../PLAN.md). Backwards-compat fallback ([ADR-004](ADR-004-backcompat-during-migration.md)) keeps tests green during cutover.
- `ConfigStore.resolve(key, evaluation_date, jurisdiction_id)` is the only public read API. Engine code never reaches into `parameters` dicts by hardcoded key — every read goes through `resolve()`.
- Audit integration (`ConfigResolution`) records the resolved `ConfigValue.id` per parameter read during evaluation. Per-parameter granularity gives audit packages precise pinning.
- Phase 6 admin UI ([govops-003 through govops-008](../../govops-003-config-search.md)) renders per-parameter timelines and diffs.
- Phase 7 (reverse index) implements `GET /api/impact?citation=<citation>` by scanning `ConfigValue.citation` across all rows — per-parameter granularity makes the result list precise and usable.

## Alternatives considered

- **Per-rule blob** (rejected, see table above)
- **Hybrid: structural fields per-rule, leaf parameters per-parameter** (rejected — adds a tier of indirection without solving any problem the per-parameter shape doesn't already solve; complicates resolve())
- **One key per resolved value, no jurisdiction component** (rejected — same key under different jurisdictions would collide; jurisdiction must be an addressing dimension, not embedded in the key string only)

## Open questions

- **i18n addressing**: do per-locale UI labels live under one key with a `language` metadata field, or under per-language keys (`global.ui.label.cases.title.fr`)? Phase 3 YAML externalization will force a choice. Lean toward metadata field; revisit at Phase 3.
- **Calculation formulas (Phase 10B)**: a benefit-amount formula has many leaf parameters but a structural shape (operator tree). Per-parameter handles the leaves cleanly; the formula itself becomes a separate `ConfigValue` of `value_type=formula` carrying a structured expression. Out of scope for Phase 1.
