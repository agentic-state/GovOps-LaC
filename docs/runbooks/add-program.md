# Runbook: Adding a new program

## When to use

When extending GovOps with a benefit program beyond the two currently supported shapes (`old_age_pension`, `unemployment_insurance`). Two scenarios:

1. **Same shape, different program** — adding a shape-conformant program to an existing jurisdiction (e.g. another lifetime monthly benefit that's structurally `old_age_pension`).
2. **New shape entirely** — adding a benefit that doesn't fit existing shapes (e.g. disability allowance, child benefit, parental leave). Requires authoring a shape evaluator and almost always a new ADR.

If you're adding the SAME program to a NEW jurisdiction (e.g. EI-equivalent for Poland), use [`add-jurisdiction.md`](add-jurisdiction.md) — that runbook's `--shapes` flag covers the standard case.

## Pre-flight

| Check | Command | Why |
|---|---|---|
| Current shape catalog | `ls src/govops/shapes/` | What shapes already exist |
| ADR-015 (shape library) + ADR-014 (manifest model) | `cat docs/design/ADRs/ADR-014-program-as-primitive.md` | The contracts a program manifest must satisfy |
| Schema for program manifests | `cat schema/program-manifest-v1.0.json` | What `lawcode/<jur>/programs/<id>.yaml` must conform to |
| Backend tests pass | `pytest -q` | Establishes baseline |

If introducing a NEW shape, also:
- Read `src/govops/shapes/__init__.py` for the `ShapeEvaluator` Protocol
- Read existing shape evaluators (`old_age_pension.py`, `unemployment_insurance.py`) for the pattern
- Decide if this warrants an ADR (almost always yes — new shapes are load-bearing)

## Steps

### Path A: same shape, different program

Use this when the new program's structure matches an existing shape.

#### A1 — Author the program manifest

Create `lawcode/<jur>/programs/<new-program-id>.yaml`. Copy the structure from an existing program manifest in the same shape; replace identifiers, citations, and rule references.

```yaml
# yaml-language-server: $schema=../../../schema/program-manifest-v1.0.json
schema_version: "1.0"
program_id: <new-id>                  # short kebab-case, unique within jurisdiction
jurisdiction_id: jur-<country>-<level>
shape: <existing-shape-name>          # e.g. old_age_pension
status: active

name:
  en: <Official program name in English>
  <other-locales>: <translated names>

description:
  en: <one-sentence description ending with the statutory citation>

authority_chain:
  - id: auth-<program>-constitution
    layer: constitution
    title: <constitution title>
    citation: <citation>
    effective_date: <ISO-8601 date>
    url: <statutory URL>
  - id: auth-<program>-act
    layer: act
    title: <Act title>
    citation: <full citation>
    parent: auth-<program>-constitution
  # ... regulations, programs, services as needed

rules:
  - rule_id: rule-<program>-<concept>
    type: <RuleType>      # age_threshold, residency_minimum, legal_status, evidence_required, exclusion, calculation, benefit_duration_bounded, active_obligation
    description: <one-sentence behavioral description>
    citation: <statutory citation pinpointing the rule>
    parameters:
      <param_key>:
        ref:
          key: <jurisdiction-prefix>.<program>.<param-name>
          jurisdiction_id: <jur>
```

Each rule's `parameters` are `ref`-linked to ConfigValues in `lawcode/<jur>/config/<program>-rules.yaml` per ADR-006 (per-parameter granularity). The manifest holds STRUCTURE; values live in the substrate.

#### A2 — Author the program's substrate values

Create `lawcode/<jur>/config/<new-program-id>-rules.yaml` with one ConfigValue record per parameter the manifest references:

```yaml
- key: <jurisdiction-prefix>.<program>.<param-name>
  jurisdiction_id: <jur>
  value: <value>
  value_type: <number | boolean | string | array | object>
  domain: rule
  effective_from: <ISO-8601 date the value takes effect>
  citation: <statutory citation pinpointing this parameter>
  author: <encoder name>
  rationale: <why this is the value, briefly>
  status: active
  approved_by: <approver>
  approved_at: <ISO-8601 timestamp>
```

Schema-validate before committing:

```bash
python scripts/validate_lawcode.py
```

#### A3 — Generate the plain-language sidecar

```bash
govops docs lawcode/<jur>/programs/<new-program-id>.yaml
```

This produces `<new-program-id>.md` next to the YAML — a non-coder-readable description of what the program does and what each rule means. Always regenerate after manifest changes.

#### A4 — Add demo cases

In `src/govops/jurisdictions.py`, the demo cases for the jurisdiction need to be extended to cover the new program. Add 4 cases (eligible-full, ineligible, partial, insufficient_evidence) following the per-jurisdiction `_<country>_demo_cases()` pattern. Each case can be evaluated against multiple programs — the engine returns per-program results when given `programs: [list]`.

#### A5 — Register cross-program interactions

If the new program interacts with existing ones (mutual exclusion, stacking limits, income offset rules), add an entry in `src/govops/program_interactions.py`. The cross-program evaluation API (ADR-018) surfaces these as `ProgramInteractionWarning` entries in the response.

#### A6 — Add tests

Per-program engine tests in `tests/test_engine.py` or a new `tests/test_<program>.py`:
- One test per rule (each rule produces the expected outcome on a known case)
- One test per cross-program interaction (warning surfaces when expected)
- One test for each demo case end-to-end (evaluate produces expected recommendation)

Plus a journey test in `web/e2e/journeys/` exercising the program through the citizen surface and (optionally) the officer surface.

#### A7 — Land via PR

ADR optional unless the program introduces a new rule type, a new interaction class, or changes how an existing shape is interpreted. The program manifest itself is the documentation.

### Path B: new shape entirely

Use this when no existing shape captures the program's structure.

#### B1 — Draft an ADR

A new shape is load-bearing — see [`draft-adr.md`](draft-adr.md). The ADR should answer:

- **What is the shape's contract?** What outcome details does it produce on the eligible branch (lifetime monthly amount? bounded weeks? lump sum? recurring with active obligations?)
- **How does it differ from existing shapes?** Why isn't this a generalization of an existing shape?
- **What new rule types (if any) does it require?** Bounded benefits introduced `benefit_duration_bounded` and `active_obligation` (ADR-017). New shapes may need new rule types — define them in the same ADR.
- **What's the migration path?** Is this shape registered in the canonical catalog (`src/govops/shapes/`) immediately, or as a "local shape" first that gets upstreamed later?

Land the ADR before writing code.

#### B2 — Implement the shape evaluator

Create `src/govops/shapes/<new-shape-id>.py` implementing the `ShapeEvaluator` Protocol from `src/govops/shapes/__init__.py`:

```python
from govops.shapes import register_shape, ShapeEvaluator, EligibleDetails

class <NewShape>Evaluator:
    """Per ADR-NNN, this evaluator computes <what>."""

    shape_id = "<new-shape-id>"

    def eligible_details(
        self,
        *,
        case: CaseBundle,
        rules: list[LegalRule],
        evaluation_date: date,
    ) -> EligibleDetails:
        # Compute shape-specific outcome details.
        # Return EligibleDetails(...) with the fields appropriate for this shape.
        ...

register_shape(<NewShape>Evaluator())
```

The evaluator runs only when the engine has triaged the case as eligible — its job is to produce shape-specific output (benefit amount, duration, obligations), not to re-decide eligibility.

#### B3 — Add the shape's JSON schema

Create `schema/shapes/<new-shape-id>-v1.0.json` describing the manifest shape (what `shape: <new-shape-id>` programs must look like).

Update `schema/program-manifest-v1.0.json` to recognize the new shape value.

#### B4 — Add new rule types if needed

If the shape requires rule types beyond what exists in `src/govops/models.py:RuleType`:

```python
class RuleType(str, Enum):
    # ... existing ...
    NEW_TYPE = "new_type"
```

Add the evaluation method in `src/govops/engine.py`:

```python
def _evaluate_new_type(self, rule: LegalRule, case: CaseBundle, evaluation_date: date) -> RuleResult:
    ...
```

Wire it in the dispatch table in `engine.py`. Add tests in `tests/test_engine.py` covering the new type's outcomes.

#### B5 — Author the first program in the new shape

Same as Path A (steps A1-A6), but using the new shape and any new rule types.

#### B6 — Update CLAUDE.md

The "Rule Types" table in CLAUDE.md is canonical — extend it. The "Project state" sections should mention the new shape as available.

#### B7 — Land

The ADR + the shape evaluator + the schema + the first program manifest can land together (one PR) or separately (ADR first, then implementation). Per [`draft-adr.md`](draft-adr.md), prefer separate PRs when the implementation is large.

## Post-checks

Program is properly added when:

- [ ] `python scripts/validate_lawcode.py` passes
- [ ] `pytest -q` passes (per-program tests + per-jurisdiction tests)
- [ ] `POST /api/cases/{id}/evaluate` with `programs: [<new-id>]` returns the expected per-rule trace
- [ ] `GET /api/programs/{<new-id>}/compare?jurisdictions=...` returns sensible cross-jurisdiction comparison data (when the program is in multiple jurisdictions)
- [ ] The plain-language sidecar (`programs/<id>.md`) is regenerated
- [ ] Cross-program interactions (if any) are wired and tested
- [ ] The journey test for the program passes against the local bench
- [ ] If a new shape was added, the ADR is `Accepted` and indexed in `docs/design/ADRs/README.md`

## Rollback

If the program needs to be removed:

```bash
git rm lawcode/<jur>/programs/<new-program-id>.yaml
git rm lawcode/<jur>/programs/<new-program-id>.md
git rm lawcode/<jur>/config/<new-program-id>-rules.yaml
# Edit src/govops/jurisdictions.py to remove demo cases
# Edit src/govops/program_interactions.py to remove interactions
git rm tests/test_<new-program-id>*.py
git rm web/e2e/journeys/<new-program-id>*.spec.ts
git commit -m "chore: remove <new-program-id> program (rationale)"
```

For a new SHAPE that needs to be removed: that's a much bigger deal because the shape catalog is meant to be stable. Mark the shape's ADR as `Deprecated`, deprecate the evaluator (raise `NotImplementedError`), and migrate any consuming programs to a different shape in a separate PR.

## Common gotchas

- **Manifest references a ConfigValue key that doesn't exist.** The engine resolves at evaluation time and produces a runtime error. The schema validator can't catch this. Mitigation: a journey test that exercises the program end-to-end on a demo case will surface it on the first run.

- **Citations that point at the wrong subsection.** Schema-valid, semantically wrong. Only domain review catches this. For load-bearing values (calculation coefficients), have a second pair of eyes confirm.

- **Demo cases that don't actually exercise the new rules.** If your demo cases all happen to satisfy every rule by accident, you'll never see the new rules fail in tests. Deliberately construct a case that fails ONE specific rule per rule — the "ineligible" demo case for each path.

- **Stamping a new shape into the canonical catalog before it's stable.** ADR-015 distinguishes canonical shapes from local shapes for a reason. If the shape is experimental, register it as local at startup; promote to canonical only after it has shipped in at least one production jurisdiction and proven its contract.

- **Cross-program interaction matrix exploding.** With N programs in a jurisdiction, there are N*(N-1)/2 potential interactions. Author them lazily — only encode interactions that actually exist in statute. The registry shouldn't be exhaustive; it should be authoritative for what's there.

## Last validated

- **Pending** — this runbook documents the conventions visible across the OAS / EI shape implementations and ADR-014/015/017. The next program added (Path A) or shape introduced (Path B) will be the first end-to-end run.
