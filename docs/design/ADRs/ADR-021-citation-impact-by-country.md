# ADR-021: Citation impact groups by country, not by program-scoped jurisdiction_id

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-11 |
| **Authors** | GovOps team |
| **Supersedes** | (partial) the Phase 7 reverse-index grouping in ADR-013 |
| **Lane** | v3.1 L5 |

## Context

The `/api/impact?citation=...` endpoint (Law-as-Code Phase 7) finds every `ConfigValue` whose `citation` substring-matches a query and returns them grouped for the citizen-impact UI. Pre-v3.1, results were grouped by the `ConfigValue.jurisdiction_id` field directly.

`jurisdiction_id` on a `ConfigValue` is **program-scoped**, not country-scoped:

- Canadian OAS substrate -> `ca-oas`
- Spanish OAS substrate -> `es-jub`
- Spanish EI substrate -> `es-ei`
- French OAS substrate -> `fr-cnav`
- French EI substrate -> `fr-ei`
- ...

The scoping is load-bearing for substrate routing -- `es-jub` and `es-ei` deliberately keep separate namespaces so an EI rule does not accidentally read OAS substrate (see `_JURISDICTION_PREFIX_TO_ID` in `legacy_constants.py` and the Phase D EI-rollout rationale).

But this scoping leaked into the impact UI:

> Marco's 2026-05-10 playthrough: searching `/impact` for "Real Decreto 1234/2020" -- a Spanish citation that appears in BOTH the Spanish OAS substrate (`es-jub`) and the Spanish EI substrate (`es-ei`) -- returned the message "2 records across **2 jurisdictions**". The two "jurisdictions" were `es-jub` and `es-ei`. There is only one Spain.

The bug was structurally wrong because **citations are country-bound, not program-bound**. A Spanish statute does not become a different statute when invoked from a different program's substrate. The display "2 jurisdictions" implied the citation had cross-jurisdictional reach when it had not.

## Decision

The `/api/impact` endpoint groups results by **country**, derived from the `jurisdiction_id` prefix via the JURISDICTION_REGISTRY (ADR-020).

**Response shape changes**:

| Pre-L5 | Post-L5 |
|---|---|
| `jurisdiction_count: int` | `country_count: int` |
| `results[].jurisdiction_id: str \| null` | `results[].country_code: str \| null` |
| `results[].jurisdiction_label: str` (program -- country) | `results[].country_label: str` (country only) |

Each `ConfigValue` inside `results[].values` retains its program-scoped `jurisdiction_id`, so the UI can still show "this row came from `es-ei`". Only the **bucket key** changes.

Resolution rule (`_country_code_for_value`):
- `jurisdiction_id is None` or `"global"` -> bucket key `None` (Global)
- prefix matches a JURISDICTION_REGISTRY key (`es`, `ca`, `fr`, ...) -> bucket key = country code
- prefix does not match -> bucket key = raw `jurisdiction_id` (fallback for federation packs or unregistered codes; ensures the result is still readable)

The Global bucket continues to be listed first; remaining country buckets sort alphabetically by country code.

## Consequences

**Positive**:

- The UI summary "N records across M countries" matches statutory reality. A Spanish citation matches 1 country, regardless of how many Spanish program substrates reference it.
- The change is contained to `/api/impact` and its consumer (`web/src/routes/impact.tsx` + `ImpactSection.tsx`). No data migration. No substrate change. The per-program `jurisdiction_id` scoping that substrate routing depends on is preserved.
- Future federation packs that don't register a country in the registry still produce a coherent result (raw `jurisdiction_id` fallback).

**Negative / accepted**:

- This is a breaking change to the `/api/impact` response shape. v3.1 is unreleased so back-compat is not a concern within the project; any out-of-tree consumer (we know of none) would need to update. The OpenAPI snapshot is regenerated in the same PR.

**Neutral**:

- The pre-L5 `_jurisdiction_label()` helper (returns "<program> -- <country>") is retained for `/api/jurisdictions/howto` and other consumers that still want program-scoped labels. Only `/api/impact` switches.

## Forward-looking: structured `cited_authority` URI (deferred)

The substring-matching-on-the-free-form-`citation`-string approach has a known weakness: two citations that share text fragments can collide. For example, "Article 12" matches anything mentioning Article 12 in any statute in any country. The current substring fallback is adequate for the demo bar; for v4 (treaty-framework support, CA-FR proof pair) the impact lookup should resolve to a **structured authority reference** instead:

```yaml
cited_authority:
  statute_id: doc-es-jub-trlgss          # references legal_documents[].id in the manifest
  section_ref: art. 205                   # the section ref inside that document
```

The `ConfigValue` schema would add an optional `cited_authority: { statute_id, section_ref }` field; free-form `citation` remains for human display and back-compat. Impact lookups would prefer `cited_authority` when present, falling back to the existing substring match on `citation`.

This is **not in v3.1 scope**. v3.1 closes the misleading-grouping bug; v4 (or a v3.2 follow-up) adds the structured field. The grouping logic in this ADR is forward-compatible: both substring matches and structured-authority matches will continue to group by country.

## Alternatives considered

1. **Keep grouping by program-scoped jurisdiction_id; fix the copy.** Change "N jurisdictions" to "N programs". Rejected -- the user mental model is country, not program. A Spanish program leader searching for "Real Decreto" is looking for "where does this Spanish law show up in Spanish substrate", not "how many distinct Spanish program manifests".

2. **Group by country AND by program (nested two-level).** Rejected -- adds UI complexity without earning the cognitive load. The flat country-grouped list with per-row program chip is enough; users who want to know which program a value came from can read the row.

3. **Backfill `cited_authority` on every existing ConfigValue.** Rejected as v3.1-scope creep. The grouping fix alone closes the user-visible bug; structured citation linkage is its own v4 lane.

## Implementation notes

- `_country_code_for_value(jurisdiction_id)` and `_country_label(country_code)` are new helpers in `api.py` next to the existing `_jurisdiction_label()`. The grouping logic in `impact_by_citation` rewires from `cv.jurisdiction_id` to `_country_code_for_value(cv.jurisdiction_id)`.
- Tests in `tests/test_api_impact.py` are updated for the new shape and a new regression test (`test_two_programs_one_country_count_as_one_country`) asserts the ADR-021 motivating case: two Spanish program substrates with one shared citation -> `country_count == 1`.
- The mock-impact fixture (`web/src/lib/mock-impact.ts`) is updated for parity with the live shape, so SSR fallback rendering doesn't drift.
- ICU plural messages updated across all 6 locales (`impact.summary`): "jurisdictions" -> "countries" (or locale-appropriate equivalent).

## Related

- ADR-013 (ConfigValue substrate model) -- defines `jurisdiction_id` semantics this ADR refines for impact display.
- ADR-020 (lawcode-as-discovery) -- provides the JURISDICTION_REGISTRY this ADR uses to resolve country codes.
- v4 treaty framework charter intent (2026-05-07) -- the structured `cited_authority` URI is the foundation v4 needs for CA-FR pension-portability cross-citation lookups.
