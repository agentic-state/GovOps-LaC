# ADR-011 — Calculation rules represented as a typed AST in YAML

**Status**: Accepted
**Date**: 2026-04-27
**Track / Gate**: Law-as-Code v2.0 / Phase 10B (entitlement calculation)

## Context

Phase 10B introduces `RuleType.CALCULATION` so the engine can answer not only *"is this person eligible?"* but *"how much do they receive?"*. The substrate already represents thresholds, residency minima, partial-pension proration, legal status, evidence requirements, and exclusions as data — `LegalRule` records with typed parameters. A calculation rule is the next member of that family, but it carries something the others do not: an **expression**, not just parameters.

The shape of that expression is a load-bearing decision. Three options were on the table:

1. **Python lambdas (or callables) stored as `ConfigValue`.** Trivial to implement; full expressive power; easy to write. Matches nothing else in the substrate. Re-introduces the entire "code as configuration" anti-pattern this project exists to reject: the law is not Python, the formula is not behaviour, and a citizen-facing audit cannot diff two `<function lambda at 0x...>` strings.

2. **A small custom DSL.** A pension formula needs roughly six operations: literal, named reference, arithmetic, min/max, clamp. Writing a parser is two days of work; maintaining one is forever. The DSL would have its own grammar, error messages, and edge cases — none of which contributors editing `lawcode/*.yaml` should have to learn.

3. **A typed Abstract Syntax Tree, expressed in YAML, validated by JSON Schema.** Each node is a small Pydantic model with a discriminator (`op`); leaves are `const` / `ref` / `field`; internal nodes are `add` / `subtract` / `multiply` / `divide` / `min` / `max` / `clamp`. Per-node citation is a first-class field, so every coefficient and every operation can point back to law.

Option 3 fits every existing axiom of the substrate:

- **Data, not code.** The YAML is inert until the engine walks it. There is no `eval`, no exec, no source string. A reviewer can read the formula without running anything.
- **Schema-validated.** `schema/lawcode-v1.0.json` already gates every YAML record. The AST gets a sibling schema (`schema/formula-v1.0.json`) that says *"this is the shape of a calculation expression"*, and CI catches malformed formulas the same way it catches malformed records today.
- **Citation-per-step, not citation-per-rule.** A pension formula like `base × (eligible_years / 40)` cites two distinct sections (s. 7 sets the base, s. 3(2)(b) sets the proration). A typed AST lets each node carry its own `citation`, so the audit trail can render *"$727.67 (OAS Act, s. 7) × (33 / 40 (OAS Act, s. 3(2)(b))) = $600.10"*. A monolithic formula string can't.
- **No new runtime authority.** Like every other rule type, the formula's coefficients (e.g. the base monthly amount) resolve through the existing `ConfigValue` substrate via `ref` nodes. Quarterly cost-of-living adjustments are a `ConfigValue` supersession — no code change.
- **No new contributor learning curve.** YAML editors already know how to write nested mappings. They do not need to learn a parser-frontend grammar.

## Decision

Calculation rules carry a `formula` field whose value is a typed AST tree. Each tree node has the shape:

```yaml
op: <operator>           # required, discriminator
citation: "<...>"        # optional per-node citation; load-bearing for audit trace
note: "<...>"            # optional human-readable label

# leaf payloads (exactly one based on op):
value: <number|string>   # for op=const
ref_key: "<dotted.key>"  # for op=ref  (resolves via ConfigStore at evaluation time)
field_name: "<name>"     # for op=field (reads a derived value from CaseBundle context)

# internal payload:
args: [<node>, ...]      # for arithmetic ops
```

Supported operators in v1.0 of the formula schema:

| `op`        | Arity   | Purpose                                                                  |
| ----------- | ------- | ------------------------------------------------------------------------ |
| `const`     | leaf    | Literal number / string                                                  |
| `ref`       | leaf    | Resolves a ConfigValue (e.g. `ca.calc.oas.base_monthly_amount`)          |
| `field`     | leaf    | Reads a context field provided by the engine (e.g. `eligible_years_oas`) |
| `add`       | n-ary   | Sum of args                                                              |
| `subtract`  | binary  | `args[0] - args[1]`                                                      |
| `multiply`  | n-ary   | Product of args                                                          |
| `divide`    | binary  | `args[0] / args[1]` (zero-division → engine raises with citation context)|
| `min`       | n-ary   | Smallest arg                                                             |
| `max`       | n-ary   | Largest arg                                                              |
| `clamp`     | ternary | `min(max(args[0], args[1]), args[2])` — bounds a value                   |

The set is intentionally small. New operators are added when a real jurisdiction needs one, not preemptively. Logical control flow (`if`, `case`) is **not** in v1.0: branching is expressed as an exclusion or an eligibility precondition at the rule level, not inside the formula.

## Engine behaviour

`engine.calculate(case, recommendation)` returns a `BenefitAmount` with:

- `value`: the numeric result of evaluating the AST
- `currency`: from a sibling `ConfigValue` (or rule parameter)
- `period`: `"monthly"` / `"annual"` / `"lump_sum"`
- `formula_trace`: the ordered list of `(op, inputs, output, citation)` records produced by walking the AST. The trace is the audit primitive — every render of "you would receive $X/month" must be reproducible from the trace alone.
- `citations`: deduplicated list of citations from every node visited

`engine.calculate` runs **only after `evaluate()` returns `ELIGIBLE`** (full or partial). For non-eligible cases, no calculation is attempted; the recommendation has `benefit_amount = None` and the screen surface renders without a dollar amount.

## Where coefficients live

Every numeric coefficient that varies over time (base monthly amount, COLA multiplier, full-pension years threshold, partial-pension floor) is a `ConfigValue` referenced by `ref_key`. The formula structure stays static across COLA adjustments; the values change as supersession events. This is the "configure-without-deploy" exit line for Phase 10B made concrete: bumping the OAS base for the next quarter is a single PR adding one new dated `ConfigValue` row.

## Consequences

**Positive**:

- Audit trail is finer-grained than any prior rule type — every coefficient traces to its statutory source.
- Quarterly indexation requires no engine change.
- Schema-validated formulas catch typos and arity errors at CI time, not at evaluate time.
- Multi-jurisdiction reuse: a Brazilian, German, or French pension formula slots in alongside Canada's without engine changes; only its coefficients and citations differ.

**Negative**:

- More verbose than a Python expression. `base × (years / 40)` is six lines of YAML instead of one. The trade — auditability and citation-per-node — is paid willingly; this is the substrate's job, not an inconvenience to solve.
- The walker has to handle each operator. Eight operators × ~5 lines each = ~40 lines. Bounded, predictable, all in one place.
- New operators require a minor schema bump + walker update + test. By design.

**Neutral**:

- The AST is data; we may eventually surface an editor in the admin UI (a structured formula builder rather than a code editor). Out of scope for v1.0 — the YAML form is sufficient.

## Cross-references

- [PLAN.md](../../../PLAN.md) §Phase 10B — entry/exit
- [ADR-006](ADR-006-per-parameter-granularity.md) — per-parameter granularity (a coefficient is one `ConfigValue`)
- [ADR-010](ADR-010-sqlite-from-phase-6.md) — substrate persistence (formulas hydrate alongside other rules)
- `src/govops/formula.py` (new) — AST models + walker
- `src/govops/engine.py` — `OASEngine.calculate()` (new method)
- `tests/test_formula.py` (new) — formula evaluator tests
