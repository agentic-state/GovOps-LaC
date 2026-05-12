# ADR-018 — Cross-Program Evaluation API

**Status**: Accepted
**Date**: 2026-04-29
**Track / Gate**: GovOps v3.0 — Phase E (cross-program evaluation). Locks v3 Decision Gate 5.

## Context

Phases A–D delivered the program-as-primitive substrate: program manifests under `lawcode/<jur>/programs/<id>.yaml`, a shape-agnostic `ProgramEngine` (ADR-016), bounded-benefit + active-obligation primitives (ADR-017), and Employment Insurance authored symmetrically across the 6 active jurisdictions (CA, BR, ES, FR, DE, UA). Two programs now coexist in the codebase — Old Age Security and Employment Insurance — but the API still answers a one-program-per-case world: `POST /api/cases/{id}/evaluate` runs *the* engine and returns *the* recommendation. There is no way for a caller to ask "evaluate this case against every program available in this jurisdiction" in one round trip, and no way for the system to surface the fact that an applicant is concurrently eligible for OAS *and* EI in CA.

The charter calls out **cross-program evaluation** explicitly as a v3 audience deliverable:

> *Government leaders need a comparison surface; citizens need an entry path that says "what am I entitled to?" — both require a one-call API that returns per-program eligibility for a given case.*

PLAN-v3 §Phase E defines the contract:

> *POST /api/cases/{id}/evaluate accepts `programs: [oas, ei]`; per-program slot in audit package; `ProgramInteractionWarning` surfaces when two programs conflict (e.g. EI + OAS for same claimant — locale-specific rules).*

Three load-bearing decisions:

1. **API shape** — request body grammar; response shape; backward compatibility with the 30+ existing `evaluate` callers in `tests/test_api.py` and `tests/test_events.py`.
2. **Default semantics** — when the caller does not specify a program list, what runs?
3. **Interaction warnings** — what shape do they take, what triggers them, where do they live in the response and the audit package?

## Decision

### Request: optional `programs` list

The endpoint accepts an *optional* JSON body. Existing callers that POST with no body keep their current behaviour byte-identically.

```json
POST /api/cases/{case_id}/evaluate
Content-Type: application/json

{
  "programs": ["oas", "ei"]   // optional; omit to evaluate all programs
                              //   registered for the case's jurisdiction
}
```

- **Empty / missing body**: evaluate every program registered for the case's jurisdiction. When no programs are registered (e.g. legacy in-memory seed paths that have not yet been migrated to manifests), fall back to the legacy single-engine path so v2 callers keep working.
- **`programs` list given**: evaluate exactly those programs in order. An unknown program id (not registered for this jurisdiction) returns HTTP 400 with the offending id.
- **Empty `programs: []` list**: treated identically to "missing" — evaluate the default set. Avoids a foot-gun where a caller serialises an empty list and gets nothing back.

### Response: backward-compatible additive shape

```json
{
  "recommendation": <Recommendation>,                     // back-compat
  "program_evaluations": [<Recommendation>, ...],         // new, one per program
  "warnings": [<ProgramInteractionWarning>, ...]          // new
}
```

- `recommendation` continues to point at one Recommendation. Selection rule: if an OAS-shaped program ran and produced a result, that recommendation is the alias; otherwise the first entry of `program_evaluations`. Existing tests asserting `r.json()["recommendation"]["outcome"] == "eligible"` keep passing.
- `program_evaluations` is the canonical v3 shape — one entry per program evaluated, in the order they ran. Each entry carries `program_id` so consumers can route by name rather than by index.
- `warnings` lists `ProgramInteractionWarning` records (see below). Empty list when no interactions fire.

### `ProgramInteractionWarning` model

A new top-level Pydantic model in `src/govops/models.py`:

```python
class ProgramInteractionWarning(BaseModel):
    id: str = Field(default_factory=_new_id)
    severity: str = "info"           # "info" | "warning" | "conflict"
    programs: list[str]              # program_ids involved, e.g. ["oas", "ei"]
    description: str                 # human-readable explanation
    citation: str = ""               # statutory or guidance reference, when applicable
```

Detection lives in a single pure function `detect_program_interactions(recommendations, jurisdiction_id)` in a new `src/govops/program_interactions.py`. Phase E ships exactly one rule — the one PLAN-v3 names as the test target:

- **OAS + EI dual eligibility** (severity `info`): when a single case is `ELIGIBLE` for both OAS and EI, surface a one-line note that the two programs operate on independent statutory bases and can be claimed concurrently. This is informational, not a blocker. The citation is the program-pair's authority chain root (the constitution / charter that allocates each).

The function is a registry, not a hardcoded dispatch — adopters of the substrate can author their own interaction rules in jurisdictional packs at v4 without touching the engine. Phase E ships the registry skeleton with one entry; interaction-rule authoring is a separate v4 axis.

### Audit package extension

`AuditPackage` (in `src/govops/models.py`) gains two fields:

```python
class AuditPackage(BaseModel):
    # ... existing fields ...
    program_evaluations: list[Recommendation] = []           # ADR-018
    program_warnings: list[ProgramInteractionWarning] = []   # ADR-018
```

`recommendation` (single) is preserved unchanged for back-compat. The v3 audit consumer reads `program_evaluations`; pre-v3 consumers keep reading `recommendation`.

### Default-program resolution per jurisdiction

`DemoStore` gains a `programs: dict[str, Program]` keyed by `program_id`. Programs are registered at jurisdiction-seed time:

- The legacy `JURISDICTION_REGISTRY` path (today's `_seed_jurisdiction(jur)`) seeds OAS-shaped rules into `store.rules` exactly as before, then synthesises a Program object representing those rules and registers it under `program_id="oas"`. This preserves byte-identical OAS evaluation for the existing 30+ tests.
- Every `lawcode/<jur>/programs/*.yaml` other than `oas.yaml` is loaded via `programs.load_program_manifest()` and registered. For Phase D's EI rollout, this means switching to any of CA/BR/ES/FR/DE/UA registers an `ei` program automatically; switching to JP registers only `oas` (the architectural control holds).

When the engine runs against a registered program, it uses `ProgramEngine(program=program, evaluation_date=…, ref_resolver=…)`. When it falls back to the legacy single-engine path (no programs registered), it uses `OASEngine(rules=store.rules, …)` exactly as today. The fallback is dead code in practice for the 7 seeded jurisdictions, but keeps the door open for ad-hoc test fixtures.

### Per-program recommendation history

`DemoStore.recommendations` (latest-per-case, single Recommendation) and `recommendation_history` (chronological list per case) are **preserved unchanged** for back-compat. A new `DemoStore.program_recommendations: dict[str, dict[str, Recommendation]]` (keyed by `case_id` then `program_id`) stores the latest rec per program. Audit packages read from this when building `program_evaluations`.

### What this ADR does NOT decide

- **Frontend rendering** of multiple recommendations — that lands as part of Phase F (government-leader comparison surface) and Phase G (citizen entry).
- **Cross-jurisdiction comparison** — Phase F.
- **More interaction rules** — only the OAS+EI dual-eligibility info warning is in scope for Phase E. Adding richer rules (federal/provincial offset, asset-test interactions, family-unit rules) is v4 work.
- **API versioning** — the additive response shape avoids an API version bump. If v4 introduces a breaking change, that ADR will own the version bump.
- **Removing the `recommendation` (single) alias** — kept for one cycle, removal scheduled with the OAS-engine alias retirement at Phase I cutover.

## Consequences

### Positive

- One POST returns per-program eligibility — the cross-program API contract called for in PLAN-v3 ships intact.
- Backward compatibility is preserved by additive design: every pre-v3 caller keeps working without code changes.
- Interaction warnings have a registry shape (one pure function, dictionary-dispatched), so adopters can extend them without engine surgery.
- `program_id` is now load-bearing on every Recommendation — the OAS path that previously left it `None` populates it as `"oas"` after Phase E, so cross-program clients can route reliably.

### Negative

- The response carries two related-but-not-identical surfaces (`recommendation` singular, `program_evaluations` plural). Documentation must call out which to use; we mark `recommendation` as a back-compat alias in the OpenAPI snapshot.
- Default-evaluating *every* program for the jurisdiction means a single POST does N program evaluations on the path that previously did one. For the v3 demo this is N=2 at most; if a jurisdiction grows to ~10 programs at v4, latency budgets revisit.
- Interaction detection is a synchronous pure function, but its registry is a hardcoded dict-of-callables this phase. If we later want adopters to author interaction rules in YAML, that is a separate ADR (v4 axis).

### Mitigations

- The OAS+EI interaction rule lives in code, not data, this phase. The function takes `(recommendations, jurisdiction_id)` and returns `list[ProgramInteractionWarning]` so a future ADR can swap the implementation for a YAML-driven registry without changing the API surface.
- The audit package's two new fields default to empty lists, so existing audit consumers keep working unchanged.

## References

- PLAN-v3 §Phase E
- ADR-014 (program manifest model — programs are first-class)
- ADR-016 (ProgramEngine refactor — multiple shapes coexist)
- ADR-017 (bounded-benefit + active-obligation primitives — second program proves the substrate)
- Charter — *The proof: Employment Insurance, instantiated symmetrically across the 6 active jurisdictions. JP stays untouched.*
