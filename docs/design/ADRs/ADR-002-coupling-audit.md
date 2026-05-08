# ADR-002 — Phase 0 coupling audit of `seed.py` and `jurisdictions.py`

**Status**: Accepted
**Date**: 2026-04-25
**Context**: Phase 0 of [PLAN.md](../../../PLAN.md) requires identifying hidden coupling that will complicate the Phase 2 ConfigValue migration.

---

## Findings

### 1. Late-import cycle: `jurisdictions.py` imports from `seed.py`

`src/govops/jurisdictions.py:1075` does a deliberate post-class import:

```python
# Late import: seed.py imports from this module, so importing at top would cycle.
from govops.seed import (
    AUTHORITY_CHAIN as CA_AUTHORITY_CHAIN,
    CANADA_FEDERAL,
    LEGAL_DOCUMENTS as CA_LEGAL_DOCUMENTS,
    OAS_RULES as CA_RULES,
    make_demo_cases as _ca_demo_cases,
)
```

The note claims `seed.py` imports from `jurisdictions.py`, but `seed.py` only imports from `govops.models`. So the cycle is dormant today, but the late-import suggests historical churn. **Risk for v2.0**: when both files are gutted to read from `ConfigStore` (Phase 2), the registry shape may need to move to a third module that loads from YAML at startup. Plan to extract `JurisdictionPack` and `JURISDICTION_REGISTRY` into a dedicated `registry.py` during Phase 3.

### 2. Canada is special-cased

The Canadian jurisdiction lives entirely in `seed.py` (340 lines); the other 5 live in `jurisdictions.py` (1138 lines). The `JURISDICTION_REGISTRY` at the bottom of `jurisdictions.py` is the only place where Canada is treated as one of six peers. **Risk for v2.0**: any structural code that special-cases Canada (UI, tests, docs) will break the "all six in lockstep" rule. **Mitigation**: during Phase 3 YAML externalization, fold `seed.py` into `lawcode/ca/config/*.yaml` so Canada becomes structurally identical to the other five.

### 3. Parameter shapes are nearly but not quite uniform

Across all 6 jurisdictions, rule `parameters` use the same key names:

| Rule type | Keys | Variation |
| --- | --- | --- |
| `age_threshold` | `min_age` | int, ranges 60–67 |
| `residency_minimum` | `min_years`, `home_countries` | int + list of country codes; CA uses 3 spellings (`["CA", "CANADA", "CAN"]`), most others use 2 |
| `residency_partial` | `full_years`, `min_years` | int + int; ranges 35–45 / 2–25 |
| `legal_status` | `accepted_statuses` | identical list everywhere: `["citizen", "permanent_resident"]` |
| `evidence_required` | `required_types` | only CA seeds this; others may be missing it |

**Risk for v2.0**: `accepted_statuses` is identical across all 6 today. Naive Phase 2 migration would create 6 ConfigValue records holding the same value. **Mitigation**: use the `jurisdiction_id=null` global-scope feature in the ConfigValue model — set `legal_status.accepted` once at global scope; jurisdictions override only when they diverge. This keeps the YAML diff small when (e.g.) a sixth status is added globally.

### 4. `home_countries` lists are language-shaped, not data-shaped

`["CA", "CANADA", "CAN"]` mixes ISO-2, ISO-3, and a full English country name. The engine compares with `period.country.upper()`. **Risk**: a French-speaking user enters "CANADA" or "Kanada" and the comparison fails for non-listed spellings. **Mitigation**: Phase 2 should normalize these to ISO-3166 alpha-2 codes; the comparison logic should also accept ISO-3 and a normalized name list resolved from a single global ConfigValue.

### 5. Translation keys are flat, not namespaced

`_TRANSLATIONS` in `i18n.py` uses dot-separated keys like `nav.about`, `common.back_to_cases`. There is no namespace per jurisdiction or per rule. **Risk for v2.0**: ConfigValue keys are also dot-separated and we're about to add `<jur>.rule.<id>.<param>`-style keys. UI label keys must stay distinct — recommend a `ui.label.` prefix for all i18n entries to keep the namespace flat across all ConfigValue domains.

### 6. `EXTRACTION_SYSTEM_PROMPT` and `EXTRACTION_USER_PROMPT_TEMPLATE` are module-level constants

In `encoder.py:88,111` — module-level strings, not parameters. **Risk for v2.0**: these are exactly what Phase 4 will promote to ConfigValue. Audit reveals no caller passes a custom prompt today, so the migration is mechanical: add an optional `prompt_id` argument to extraction functions; default behaviour reads the value from `ConfigStore.resolve("global.prompt.extraction.system", today)`.

### 7. `JurisdictionPack` is a plain class, not a Pydantic model

`jurisdictions.py:1050` defines `JurisdictionPack` as a regular `class` with `__init__`. Every other domain object is a `BaseModel`. **Risk**: when YAML loading is added (Phase 3), `JurisdictionPack` won't deserialize the same way. **Mitigation**: convert to `BaseModel` during Phase 3 — low risk, no behavioural change.

### 8. `default_language` lives on `JurisdictionPack`, not `Jurisdiction`

The `default_language` is a property of the pack, not the jurisdiction model. **Risk**: when `Jurisdiction` records become first-class ConfigValues, the language metadata gets stranded on a separate object. **Mitigation**: move `default_language` to `Jurisdiction` (Phase 2 schema change, mechanical migration).

### 9. No `evaluation_date` propagation to UI

The engine accepts `evaluation_date` (`engine.py:69`), but the API (`/api/cases/{id}/evaluate`) does not accept it as a parameter. Today's UI always uses `date.today()`. **Risk for v2.0**: the entire effective-value substrate hinges on evaluation date being explicit. The frozen OpenAPI snapshot must be updated in Phase 1 to expose `evaluation_date` as an optional query parameter on evaluation endpoints — call this out as the **only intended OpenAPI change during Phase 1**, otherwise Lovable contract drifts.

### 10. CA demo case 4 has a logic asymmetry

`demo-case-004` (Jean-Pierre Tremblay) is the "insufficient evidence" case — missing birth certificate. But `seed.py:336` only sets the tax record; the case has no other evidence. The engine relies on `EvidenceItem.evidence_type == "birth_certificate"` matching exactly. **Risk for v2.0**: when evidence keys move to ConfigValue (`<jur>.evidence.types`), the test fixture must be updated in lockstep, or this case starts failing for a non-business reason.

---

## Decisions

1. **`registry.py` extraction**: during Phase 3, move `JurisdictionPack` and `JURISDICTION_REGISTRY` out of `jurisdictions.py` into a dedicated `src/govops/registry.py` that loads from `lawcode/REGISTRY.yaml`.
2. **Canada parity**: Phase 3 folds `seed.py` into `lawcode/ca/config/*.yaml` and removes the special case.
3. **Global-scope ConfigValues**: Phase 2 uses `jurisdiction_id=null` for values identical across all six (e.g. `legal_status.accepted`).
4. **Country code normalization**: Phase 2 normalizes `home_countries` to ISO-3166 alpha-2; comparison logic resolves a normalized name set from a global ConfigValue.
5. **i18n key namespacing**: Phase 2 prefixes all translation keys with `ui.label.` to keep namespaces orthogonal.
6. **OpenAPI delta in Phase 1**: `evaluation_date` is added as an optional query parameter on `/api/cases/{id}/evaluate`. This is the **only** Phase-1 OpenAPI change. The frozen `openapi-v0.2.0.json` is treated as the contract baseline; Phase-1 produces `openapi-v0.2.1.json` documenting the single delta.
7. **Demo case 4**: when evidence keys migrate to ConfigValue (Phase 2), `tests/test_engine.py` adds an explicit fixture-key assertion to prevent silent drift.

## Consequences

- Phase 2 effort is reduced by exploiting global-scope ConfigValues; 5 jurisdictions × 1 identical value collapses to 1 record.
- Phase 3 effort grows slightly (registry extraction added) but eliminates the late-import cycle permanently.
- Phase 1 acquires one explicit OpenAPI delta; Lovable can track it before Phase 6 begins.
- The risk register in PLAN.md should be updated to fold these mitigations in.
