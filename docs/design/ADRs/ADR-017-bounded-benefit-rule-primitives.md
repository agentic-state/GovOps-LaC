# ADR-017 — Bounded-Benefit Rule Primitives

**Status**: Accepted
**Date**: 2026-04-29
**Track / Gate**: GovOps v3.0 — Phase C (EI canonical shape). Locks v3 Decision Gate 4.

## Context

Phase B (committed `d5f6c40`) made the engine shape-agnostic: the eligible-branch in `_determine_outcome` delegates to a registered `ShapeEvaluator`, and `calculate()` reads its formula-field map from the shape. The OAS shape (`old_age_pension`) covers age-and-residency-based lifetime pensions.

Phase C introduces **Employment Insurance** as the second canonical shape. EI is structurally different from OAS in two ways that v2's rule type vocabulary cannot express:

1. **Eligibility is bounded in time**, not lifetime — a recipient is eligible for *N weeks* starting on a specific date, not "forever once granted." `BenefitAmount` (lifetime monthly amount) is the wrong model; we need a `BenefitPeriod` with start/end/weeks_total/weeks_remaining.
2. **Recipients carry forward-looking obligations** — they must remain available for and actively seek work. These obligations don't gate eligibility (the case being evaluated either has them or doesn't have them yet); they are statements of what *applies* to the recipient. The engine must surface them on the recommendation so case workers see them and citizens acknowledge them.

Phase C is **hermetic**: it ships engine-level primitives that exercise via synthetic test programs. Phase D handles the 6-jurisdiction EI rollout (CA, BR, ES, FR, DE, UA — JP excluded as architectural control).

Three design questions need a load-bearing answer:

1. **What new rule types does the engine recognize, and what do their evaluations return?**
2. **How do bounded-benefit and obligation outputs flow through the engine into the Recommendation?**
3. **Does the OAS shape need to change to accommodate the new fields?**

## Decision

### Two new `RuleType` values: `BENEFIT_DURATION_BOUNDED`, `ACTIVE_OBLIGATION`

Added to the existing `RuleType` enum in `src/govops/models.py`:

```python
class RuleType(str, Enum):
    AGE_THRESHOLD = "age_threshold"
    RESIDENCY_MINIMUM = "residency_minimum"
    RESIDENCY_PARTIAL = "residency_partial"
    LEGAL_STATUS = "legal_status"
    EVIDENCE_REQUIRED = "evidence_required"
    EXCLUSION = "exclusion"
    CALCULATION = "calculation"
    BENEFIT_DURATION_BOUNDED = "benefit_duration_bounded"   # ADR-017 (v3 Phase C)
    ACTIVE_OBLIGATION = "active_obligation"                 # ADR-017 (v3 Phase C)
```

Both new types are **non-gating**: the engine's per-rule dispatch returns `RuleOutcome.NOT_APPLICABLE` for them with a descriptive `detail` ("Benefit duration rule — see benefit_period on recommendation" / "Active obligation — see active_obligations on recommendation"). They appear in the audit's `rule_evaluations` list with full citations, but they don't push the outcome to ineligible / insufficient.

This parallels how `RuleType.CALCULATION` already works (per ADR-011) — calculation rules don't gate eligibility either; they produce a `BenefitAmount` *after* the engine triages the case as eligible. Bounded-benefit and obligation rules follow the same model: shape-evaluator consumes them post-triage and surfaces the result on the Recommendation.

### Two new typed models on the Recommendation

```python
class BenefitPeriod(BaseModel):
    """Bounded eligibility period for time-bounded programs (ADR-017)."""
    start_date: date
    end_date: date
    weeks_total: int            # total weeks of eligibility from start
    weeks_remaining: int        # remaining as of evaluation_date
    citations: list[str] = []


class ActiveObligation(BaseModel):
    """Forward-looking obligation that applies to a recipient (ADR-017)."""
    obligation_id: str
    description: str
    citation: str
    cadence: Optional[str] = None     # e.g. "biweekly", "monthly"


class Recommendation(BaseModel):
    ...existing fields...
    program_id: Optional[str] = None
    program_outcome_detail: dict = {}
    benefit_period: Optional[BenefitPeriod] = None       # ADR-017
    active_obligations: list[ActiveObligation] = []      # ADR-017
```

These are top-level fields (not nested under `program_outcome_detail`) for the same reason `pension_type` / `partial_ratio` are top-level: typed downstream consumers (web UI, audit package, decision-notice templates) can access them by name without unpacking a generic dict. The `program_outcome_detail` slot remains available for shape-specific output that doesn't merit a typed field — adopters of the shape catalog can store implementation-specific detail there without growing the canonical Recommendation.

### `EligibleDetails` extends with the new typed fields

```python
class EligibleDetails(BaseModel):
    pension_type: str = ""
    partial_ratio: Optional[str] = None
    benefit_period: Optional[BenefitPeriod] = None       # ADR-017
    active_obligations: list[ActiveObligation] = []      # ADR-017
    program_outcome_detail: dict = {}
```

The shape evaluator returns this; the engine unpacks the four typed fields plus the dict slot into the Recommendation. Existing OAS evaluator returns `EligibleDetails` with `benefit_period=None` and `active_obligations=[]` — backwards-compatible by construction.

### `UnemploymentInsuranceEvaluator` is the canonical shape

Registered in `src/govops/shapes/unemployment_insurance.py` under `shape_id="unemployment_insurance"`, version `"1.0"`. Its responsibilities:

- Walk the program's rules; find the `BENEFIT_DURATION_BOUNDED` rule and read `weeks_total` from its parameters; compute `start_date` from the engine's `evaluation_date` (or an explicit `start_date` parameter); compute `end_date` as `start_date + weeks_total * 7 days`; return a `BenefitPeriod`.
- Walk the rules; for every `ACTIVE_OBLIGATION` rule, build an `ActiveObligation` from its `obligation_id`, `description`, `citation`, and optional `cadence` parameters.
- Return `EligibleDetails(pension_type="", partial_ratio=None, benefit_period=<computed>, active_obligations=<list>)`.
- `compute_formula_fields()` returns an empty dict — no field vocabulary needed for the bounded-benefit shape until Phase D reveals authoring needs.

The initial Phase C implementation reads `weeks_total` as a literal parameter. Phase D may extend this to a formula-AST path (paralleling OAS's `RuleType.CALCULATION`) when real jurisdictions need contribution-period-driven duration math; that's an additive change that doesn't break Phase C.

### OAS shape is unchanged

`OldAgePensionEvaluator` continues to return `EligibleDetails` with the existing fields populated. The new `benefit_period` and `active_obligations` fields default to `None` and `[]` respectively. No behavior change in the OAS path; Phase B's three-constructor byte-identical regression continues to hold.

## Consequences

### Positive

- **Phase D unblocked**: authoring 6 EI manifests (CA, BR, ES, FR, DE, UA) is now a YAML-and-substrate task, not engine surgery.
- **The new primitives are reusable**: any future bounded-benefit program (parental leave, training subsidies, time-limited disability programs) can adopt `BENEFIT_DURATION_BOUNDED`. Any program with forward-looking conditions (community service requirements, training mandates) can adopt `ACTIVE_OBLIGATION`. The shape catalog grows by reuse, not by re-invention.
- **Engine surface stays small**: dispatch for the two new types is symmetric with `CALCULATION` — `NOT_APPLICABLE` in the rule loop, consumed by the shape evaluator post-triage.
- **Recommendation contract grows additively**: top-level typed fields are forward-compatible; existing API consumers ignore unknown fields, web UI gains them when ready.

### Negative

- **Two more top-level Recommendation fields**: `benefit_period` and `active_obligations` join the existing OAS-shape-specific `pension_type` / `partial_ratio`. The Recommendation model now visibly carries shape-specific concepts at the top level. Acceptable for v3 (the alternative — pushing everything under `program_outcome_detail` — breaks typed access for serialization downstream); a v4 cleanup could collapse these under a discriminated `outcome_detail` union if it earns the migration cost.
- **`weeks_total` is a literal in Phase C** (no formula AST yet). Sufficient for hermetic tests; Phase D may extend to formula-AST if real jurisdictions require contribution-period-driven duration. Additive, not blocking.
- **`ActiveObligation` is a forward-looking declaration**, not a satisfaction check — it carries no notion of "the recipient has met it." Acceptable for v3; tracking compliance is a v4 citizen-track concern alongside event-driven reassessment for obligation breaches.

### Mitigations

- **Hermetic test coverage**: `tests/test_shape_unemployment_insurance.py` exercises the synthetic flow end-to-end (synthetic Program → engine → BenefitPeriod + obligations on the Recommendation) without touching `lawcode/`. Phase D's 6-jurisdiction rollout adds integration coverage.
- **Schema enum already accepts the new values**: `schema/program-manifest-v1.0.json` and `schema/program-shape-v1.0.json` listed `benefit_duration_bounded` and `active_obligation` in their rule-type enums during Phase A — the schema gate is ready.
- **Shape catalog YAML promoted from "reserved" to "active"**: `schema/shapes/unemployment_insurance-v1.0.yaml`'s descriptor flips from "Phase C unlocks" to "Active" in this same commit, signaling the contract is live.

## Alternatives considered

### Alternative 1 — Reuse `CALCULATION` for benefit duration

Encode "weeks of EI" as a `RuleType.CALCULATION` rule whose formula returns a number that downstream code interprets as weeks. Rejected because it conflates dollar amounts with time durations — the audit and the UI need to distinguish them ("you receive $X/month for Y weeks" is two different things, two different rendering paths). Separate types preserve the audit's clarity.

### Alternative 2 — Make `ACTIVE_OBLIGATION` a `SATISFIED` outcome with side-effects

Have the engine treat obligation rules as "checked and passed" with a side-effect of populating the obligation list. Rejected because obligations are forward-looking conditions, not verifications — saying they were "satisfied" misrepresents the audit ("the case satisfies the obligation to seek work" is wrong; the case *acknowledges* an obligation that *will apply*). `NOT_APPLICABLE` with a clear detail is the honest framing.

### Alternative 3 — Push `benefit_period` and `active_obligations` into `program_outcome_detail` dict

Keep Recommendation lean; let shape-specific fields live in the dict. Rejected because typed downstream consumers (web UI, decision-notice templates, audit package) need stable named access. A `Recommendation.benefit_period.weeks_remaining` is more usable than `Recommendation.program_outcome_detail["benefit_period"]["weeks_remaining"]`. The type-vs-genericity tradeoff favors typed fields for the canonical shapes.

### Alternative 4 — Defer `ACTIVE_OBLIGATION` to a later phase

Phase C ships only `BENEFIT_DURATION_BOUNDED`; obligations land later. Rejected because EI authoring in Phase D needs both — a manifest that can't say "you must seek work" is incomplete. Splitting the primitives across phases creates a gap where Phase D would have to author placeholder rules, then re-author them when ACTIVE_OBLIGATION lands. One ADR, both primitives, clean.

## References

- v3 charter: [docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md](../../IDEA-GovOps-v3.0-ProgramAsPrimitive.md) §"New primitives EI forces"
- v3 PLAN: [PLAN-v3.md](../../../PLAN-v3.md) §"Phase C — EI canonical shape + new primitives"
- ADR-014 — Program-as-Primitive (manifest model)
- ADR-015 — Canonical Program Shape Library
- ADR-016 — Engine refactor scope (the shape-evaluator interface this ADR extends)
- ADR-011 — Calculation rules as typed AST (the precedent pattern: non-gating rule consumed by post-eligible computation)
