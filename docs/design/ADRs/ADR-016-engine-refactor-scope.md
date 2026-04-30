# ADR-016 — Engine Refactor Scope: `OASEngine` → `ProgramEngine`

**Status**: Accepted
**Date**: 2026-04-29
**Track / Gate**: GovOps v3.0 — Phase B (engine generalization). Locks v3 Decision Gate 3.

## Context

Phase A (committed `3b7dca7`) made *Program* a first-class declarable manifest. CA OAS now loads from `lawcode/ca/programs/oas.yaml` and produces byte-identical engine output to the seed.py path. But the engine itself — `OASEngine` in `src/govops/engine.py` — is still program-shaped:

- Class name encodes the program (`OASEngine`)
- `_determine_outcome` returns `(DecisionOutcome, pension_type, partial_ratio)` — pension-type and 40-year ratio are baked into the eligible-branch logic
- Helpers `_partial_full_years()` and `_qualified_years()` are OAS-specific (residency-after-18, capped at full_years)
- `Recommendation.pension_type` and `Recommendation.partial_ratio` are top-level fields, not nested under a shape-specific outcome detail

Phase C will introduce Employment Insurance with bounded benefit duration + active obligations — a different *shape* of program. Phase B's job is to make the engine shape-agnostic so Phase C can plug `unemployment_insurance` in without touching engine internals.

Five design questions need a load-bearing answer:

1. **What is the boundary between program-agnostic engine logic and shape-specific logic?**
2. **How does the engine know which shape evaluator to use?**
3. **How is backwards compatibility preserved for existing `OASEngine(rules=…)` callers?**
4. **Does `Recommendation` change?**
5. **What's the deprecation policy and timeline?**

## Decision

### The boundary: triage is generic, "all satisfied" is shape-specific

`ProgramEngine._determine_outcome` keeps the program-agnostic triage:

- Any rule with `flags` set → `ESCALATE`
- Any rule `NOT_SATISFIED` (and no `INSUFFICIENT_EVIDENCE`) → `INELIGIBLE`
- Any rule `INSUFFICIENT_EVIDENCE` → `INSUFFICIENT_EVIDENCE`

When all rules are satisfied, the engine **delegates to a shape evaluator** to compute eligible-branch details:

- For `old_age_pension`: full vs. partial pension, the `qualified/full_years` ratio
- For `unemployment_insurance` (Phase C): total weeks of benefit eligibility, start/end of benefit period, list of active obligations
- For future shapes: whatever their statutory tradition produces

This factoring preserves the property that v2's outcome-triage rules operate on (ineligible/insufficient/escalate are universal across program shapes; the eligible-branch is what varies).

### Shape evaluator interface

```python
# src/govops/shapes/__init__.py
class ShapeEvaluator(Protocol):
    shape_id: str
    version: str

    def determine_eligible_details(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        param: Callable[[LegalRule, str, Any], Any],
    ) -> EligibleDetails: ...


class EligibleDetails(BaseModel):
    pension_type: str = ""                       # OAS-shape: "full" | "partial" | ""
    partial_ratio: Optional[str] = None          # OAS-shape: "33/40" or None
    program_outcome_detail: dict = {}            # forward-looking per ADR-014
```

`param` is a bound reference to the engine's `_param(rule, name, default)` method. The shape evaluator reads parameters through it so the substrate's `evaluation_date` semantics (per ADR-013's scalar seam) flow through unchanged.

A `SHAPE_REGISTRY: dict[str, ShapeEvaluator]` exposes every published evaluator. v3 ships with one entry at v0.5.0 (`old_age_pension`); Phase C adds `unemployment_insurance`.

### How the engine picks a shape

`ProgramEngine` accepts both `program=…` and legacy `rules=…`:

```python
engine = ProgramEngine(program=ca_oas)                 # v3 native
engine = ProgramEngine(rules=oas_rules_list)           # v2 legacy
engine = ProgramEngine(rules=oas_rules_list, shape="old_age_pension")  # explicit
```

Resolution rules:

1. If `program` is given → use `SHAPE_REGISTRY[program.shape]`; ignore `shape` kwarg
2. Else if `shape` kwarg is given → use `SHAPE_REGISTRY[shape]`
3. Else (legacy path) → default to `SHAPE_REGISTRY["old_age_pension"]`

Defaulting to `old_age_pension` for the legacy path is the backwards-compat hinge: every v2 caller of `OASEngine(rules=…)` was implicitly OAS-shaped, so the default is correct for every caller that hasn't migrated yet. This unblocks the Phase B refactor without touching api.py / screen.py — they keep working, the deprecation alias keeps working, and migration to `program=…` becomes a Phase F-or-later cleanup (when those callers gain access to a Program object).

### Recommendation gets two new fields, keeps the old ones

`Recommendation` adds:

- `program_id: Optional[str] = None` — populated when an engine is constructed with `program=…`; left `None` for legacy `rules=…` callers
- `program_outcome_detail: dict = {}` — shape-specific eligible-branch detail (forward-compatible storage; OAS-shape leaves it empty since pension_type and partial_ratio remain top-level)

Existing `pension_type: str = ""` and `partial_ratio: Optional[str] = None` stay top-level. The OAS shape evaluator continues to populate them; downstream consumers (api serialization, web UI, audit package, decision-notice templates) keep their existing field bindings. Phase I cutover may flatten them under `program_outcome_detail` later — out of scope for v3.

### Deprecation: `OASEngine = ProgramEngine` alias for one cycle

```python
# src/govops/engine.py — bottom of file
class OASEngine(ProgramEngine):
    """Deprecated alias for ProgramEngine.

    Kept for one v3 cycle so v2's API + screen + test consumers continue to
    work without code changes. Emits DeprecationWarning on construction.
    Scheduled for removal at the v3 Phase I cutover (v0.5.0 release).
    """

    def __init__(self, *args, **kwargs):
        import warnings
        warnings.warn(
            "OASEngine is a deprecated alias for ProgramEngine; migrate "
            "to ProgramEngine before v3.1.",
            DeprecationWarning,
            stacklevel=2,
        )
        super().__init__(*args, **kwargs)
```

`DeprecationWarning` is the canonical Python signal; it does not trigger pytest failures with the project's default warning filter (no `filterwarnings = ["error"]` in `pyproject.toml`). The warning is informational; CI runs stay green.

### Phase B exit gate

A hermetic test asserts byte-identical engine output between three constructor shapes for the same case:

- `OASEngine(rules=oas_rules_list).evaluate(case)` *(legacy path; emits DeprecationWarning)*
- `ProgramEngine(rules=oas_rules_list).evaluate(case)` *(legacy-equivalent path)*
- `ProgramEngine(program=ca_oas).evaluate(case)` *(v3 native path)*

The three Recommendations must agree on `outcome`, `pension_type`, `partial_ratio`, `missing_evidence`, `flags`, `benefit_amount.value`, and the `rule_evaluations` list — modulo auto-id and timestamp fields. The native path also populates `program_id="oas"`; the other two leave it `None`.

## Consequences

### Positive

- **Phase C unblocked**: adding `unemployment_insurance` is a `src/govops/shapes/unemployment_insurance.py` PR + manifest authoring, not engine surgery.
- **No churn for v2 callers**: api.py, screen.py, test_engine.py keep working unchanged via the deprecated alias. Migration is a separate task with a clear deadline (v3.1).
- **Clean boundary for adopters**: the shape catalog (ADR-015) is the contract; the engine is the substrate. Forking a deployment for a new legal tradition becomes a shape-evaluator authoring task, not an engine fork.
- **Backwards-compat hinge is principled**: defaulting to `old_age_pension` for `rules=…` legacy constructors is correct *because* v2 was OAS-only — no fragile heuristic, just a documented historical fact.

### Negative

- **Two top-level fields stay (`pension_type`, `partial_ratio`)** that are OAS-shape-specific. This is a deliberate compromise to avoid breaking serialization for the web UI, audit package, and decision-notice templates that index them by name. Phase I may consolidate them under `program_outcome_detail` if a clean migration path emerges.
- **Two parallel construction shapes** (`program=` vs `rules=`) live for one cycle. Acceptable; the deprecation policy is explicit and small (5 callers).
- **The shape evaluator imports `LegalRule`, `RuleEvaluation`, `CaseBundle` from `models.py`** — same boundary issue ADR-015 acknowledges. Acceptable; the *contract* (YAML + EligibleDetails shape) is what's portable for adopters, not the evaluator code.

### Mitigations

- **Byte-identical regression test as Phase B exit gate**: the three-constructor test above runs against every demo case in `seed.py` (4 cases) — full coverage of the eligible-full / ineligible / partial / insufficient-evidence decision paths.
- **Deprecation warning is loud but non-fatal**: callers see it on the first construction; CI doesn't break.
- **CLAUDE.md gets a "engine name change" note**: future contributors orienting from CLAUDE.md don't search for `OASEngine` and find only the deprecated alias.

## Alternatives considered

### Alternative 1 — Don't rename; just add `Program` as a constructor argument

Keep the class name `OASEngine` since v2 already shipped it. Rejected because it leaves a load-bearing program-name in the engine class identifier, defeating the whole "program-as-primitive" thesis. Reading `OASEngine(program=ei_program)` reads as wrong.

### Alternative 2 — Hard rename without alias

Break `OASEngine` immediately; force every caller to migrate now. Rejected as gratuitous churn for a v3 surface that has internal consumers (api.py, screen.py) and external test fixtures (test_engine.py is documentation as much as it is verification). Deprecation alias for one cycle is the canonical Python pattern.

### Alternative 3 — Move pension-type logic into a `ProgramShape.OAS` enum dispatcher inside the engine

Keep the engine monolithic; switch on shape inside `_determine_outcome`. Rejected because Phase C and beyond will add more shapes; an `if/elif` cascade inside the engine becomes the maintenance hot spot the shape catalog was designed to avoid. Protocol-based dispatch via a registry scales; a switch statement doesn't.

### Alternative 4 — Make `pension_type` and `partial_ratio` shape-only, removing them from `Recommendation`

Forces the OAS shape's outcome detail under `program_outcome_detail.pension_type`. Rejected for v3 because it breaks the web UI, audit package, decision-notice templates, and a small handful of test assertions in one move. The migration cost outweighs the benefit when the alternative ("keep them top-level for now, consolidate at v4") is cheap and reversible.

## References

- v3 charter: [docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md](../../IDEA-GovOps-v3.0-ProgramAsPrimitive.md)
- v3 PLAN: [PLAN-v3.md](../../../PLAN-v3.md) §"Phase B — Engine generalization"
- ADR-014 — Program-as-Primitive (manifest model)
- ADR-015 — Canonical Program Shape Library
- ADR-013 — Event-driven reassessment (the scalar-seam addendum that closed `_param()`'s `evaluation_date` gap; the shape evaluator inherits this property by reading params through the engine's bound `_param` method)
- ADR-011 — Calculation rules as typed AST (the formula-AST evaluator in `OASEngine.calculate()` is program-agnostic and stays in `ProgramEngine` unchanged)
