"""Unit tests for the formula AST walker (ADR-011).

These tests exercise govops.formula in isolation — no ConfigStore, no
engine, no case bundle. Refs and fields are resolved from in-test maps so
each scenario is hermetic and the trace is deterministic.

Coverage targets:
  - every FormulaOp at least once
  - error paths for every node kind (missing payload, non-numeric, divide-
    by-zero, clamp inversion, unknown field/ref)
  - trace order + citation propagation
  - the OAS `base * (eligible_years / 40)` shape that Phase 10B will adopt
"""

from __future__ import annotations

import pytest

from govops.formula import (
    FormulaError,
    FormulaNode,
    FormulaOp,
    add,
    clamp,
    const,
    divide,
    evaluate_formula,
    field,
    max_,
    min_,
    multiply,
    ref,
    subtract,
)


# Plain-fact resolver used by most tests — predictable values, no side effects.
_REFS = {
    "ca.calc.oas.base_monthly_amount": 727.67,
    "global.calc.cola.multiplier": 1.0,
    "ca.calc.gis.supplement": 1097.75,
}

_FIELDS = {
    "eligible_years_oas": 33.0,
    "full_years_oas": 40.0,
    "applicant_age": 67.5,
}


def _resolve_ref(key: str):
    if key not in _REFS:
        raise KeyError(key)
    return _REFS[key]


def _resolve_field(name: str):
    if name not in _FIELDS:
        raise FormulaError(f"unknown formula field: {name}")
    return _FIELDS[name]


def _eval(node: FormulaNode):
    return evaluate_formula(node, resolve_ref=_resolve_ref, resolve_field=_resolve_field)


# ---------------------------------------------------------------------------
# Leaf operators
# ---------------------------------------------------------------------------


def test_const_literal_number():
    value, trace = _eval(const(42))
    assert value == 42.0
    assert len(trace) == 1
    assert trace[0].op == "const"
    assert trace[0].output == 42.0


def test_const_string_coerced_to_float():
    """Strings that parse as numbers coerce — a YAML quirk safety net."""
    value, _ = _eval(const("3.5"))
    assert value == 3.5


def test_const_missing_value_raises():
    bad = FormulaNode(op=FormulaOp.CONST)
    with pytest.raises(FormulaError, match="const node requires"):
        _eval(bad)


def test_const_non_numeric_string_raises():
    with pytest.raises(FormulaError, match="not numeric"):
        _eval(const("not a number"))


def test_ref_resolves_via_callback():
    value, trace = _eval(ref("ca.calc.oas.base_monthly_amount", citation="OAS Act, s. 7"))
    assert value == 727.67
    assert trace[0].citation == "OAS Act, s. 7"


def test_ref_missing_key_raises():
    with pytest.raises(KeyError):
        _eval(ref("does.not.exist"))


def test_ref_missing_payload_raises():
    bad = FormulaNode(op=FormulaOp.REF)
    with pytest.raises(FormulaError, match="ref node requires"):
        _eval(bad)


def test_field_resolves_from_engine_context():
    value, _ = _eval(field("eligible_years_oas"))
    assert value == 33.0


def test_field_unknown_raises():
    with pytest.raises(FormulaError, match="unknown formula field"):
        _eval(field("nonexistent_field"))


def test_field_missing_payload_raises():
    bad = FormulaNode(op=FormulaOp.FIELD)
    with pytest.raises(FormulaError, match="field node requires"):
        _eval(bad)


# ---------------------------------------------------------------------------
# Arithmetic operators
# ---------------------------------------------------------------------------


def test_add_n_ary():
    value, _ = _eval(add([const(1), const(2), const(3), const(4)]))
    assert value == 10


def test_subtract_binary():
    value, _ = _eval(subtract(const(10), const(3)))
    assert value == 7


def test_subtract_wrong_arity_raises():
    bad = FormulaNode(op=FormulaOp.SUBTRACT, args=[const(1), const(2), const(3)])
    with pytest.raises(FormulaError, match="exactly 2"):
        _eval(bad)


def test_multiply_n_ary():
    value, _ = _eval(multiply([const(2), const(3), const(4)]))
    assert value == 24


def test_divide_binary():
    value, _ = _eval(divide(const(10), const(4)))
    assert value == 2.5


def test_divide_by_zero_raises_with_citation():
    bad = divide(const(1), const(0), citation="OAS Act, s. 999")
    with pytest.raises(FormulaError, match="divide-by-zero.*OAS Act, s. 999"):
        _eval(bad)


def test_divide_wrong_arity_raises():
    bad = FormulaNode(op=FormulaOp.DIVIDE, args=[const(1)])
    with pytest.raises(FormulaError, match="exactly 2"):
        _eval(bad)


def test_min_picks_smallest():
    value, _ = _eval(min_([const(7), const(3), const(11)]))
    assert value == 3


def test_max_picks_largest():
    value, _ = _eval(max_([const(7), const(3), const(11)]))
    assert value == 11


def test_clamp_within_bounds():
    value, _ = _eval(clamp(const(15), const(10), const(20)))
    assert value == 15


def test_clamp_below_lo():
    value, _ = _eval(clamp(const(5), const(10), const(20)))
    assert value == 10


def test_clamp_above_hi():
    value, _ = _eval(clamp(const(25), const(10), const(20)))
    assert value == 20


def test_clamp_inverted_bounds_raises():
    bad = clamp(const(15), const(20), const(10))
    with pytest.raises(FormulaError, match="bounds inverted"):
        _eval(bad)


def test_clamp_wrong_arity_raises():
    bad = FormulaNode(op=FormulaOp.CLAMP, args=[const(1), const(2)])
    with pytest.raises(FormulaError, match="exactly 3"):
        _eval(bad)


def test_internal_node_without_args_raises():
    bad = FormulaNode(op=FormulaOp.MULTIPLY)
    with pytest.raises(FormulaError, match="requires `args`"):
        _eval(bad)


# ---------------------------------------------------------------------------
# Trace structure + citation propagation
# ---------------------------------------------------------------------------


def test_trace_records_inputs_and_outputs_in_order():
    # multiply(2, add(3, 4)) — depth-first leaves first, then internals.
    expr = multiply([const(2), add([const(3), const(4)])])
    value, trace = _eval(expr)
    assert value == 14
    # trace order: const(2), const(3), const(4), add, multiply
    assert [s.op for s in trace] == ["const", "const", "const", "add", "multiply"]
    # add step has its two inputs as children's outputs
    assert trace[3].inputs == [3.0, 4.0]
    assert trace[3].output == 7.0
    # multiply step combines const(2) with add result
    assert trace[4].inputs == [2.0, 7.0]
    assert trace[4].output == 14.0


def test_per_node_citations_preserved_in_trace():
    expr = multiply(
        [
            ref("ca.calc.oas.base_monthly_amount", citation="OAS Act, s. 7"),
            divide(
                field("eligible_years_oas", citation="OAS Act, s. 3(2)(b)"),
                const(40, citation="OAS Act, s. 3(2)(b)"),
            ),
        ],
        citation="OAS Act, s. 7-8 (formula)",
    )
    _, trace = _eval(expr)
    citations = [s.citation for s in trace]
    assert "OAS Act, s. 7" in citations
    assert "OAS Act, s. 3(2)(b)" in citations
    assert "OAS Act, s. 7-8 (formula)" in citations


# ---------------------------------------------------------------------------
# Realistic scenario — OAS partial pension formula shape
# ---------------------------------------------------------------------------


def test_oas_partial_pension_full_amount():
    """40+ years of residency clamps to 40 → ratio is 40/40 → full base."""
    formula = multiply(
        [
            ref("ca.calc.oas.base_monthly_amount", citation="OAS Act, s. 7"),
            divide(
                clamp(
                    field("full_years_oas"),  # 40 — at cap
                    const(0),
                    const(40),
                    citation="OAS Act, s. 3(2)(b)",
                ),
                const(40, citation="OAS Act, s. 3(2)(b)"),
            ),
        ],
        citation="OAS Act, s. 7-8 (formula authority)",
    )
    value, _ = _eval(formula)
    assert value == pytest.approx(727.67)


def test_oas_partial_pension_partial_amount():
    """33 years of residency → 33/40 of base."""
    formula = multiply(
        [
            ref("ca.calc.oas.base_monthly_amount", citation="OAS Act, s. 7"),
            divide(
                clamp(
                    field("eligible_years_oas"),  # 33
                    const(0),
                    const(40),
                    citation="OAS Act, s. 3(2)(b)",
                ),
                const(40, citation="OAS Act, s. 3(2)(b)"),
            ),
        ],
        citation="OAS Act, s. 7-8 (formula authority)",
    )
    value, _ = _eval(formula)
    expected = 727.67 * (33.0 / 40.0)
    assert value == pytest.approx(expected)


# ---------------------------------------------------------------------------
# Pydantic round-trip — formulas survive YAML/JSON serialization
# ---------------------------------------------------------------------------


def test_formula_node_pydantic_round_trip():
    """A formula serialized to dict and back yields an identical evaluation."""
    original = multiply(
        [
            ref("ca.calc.oas.base_monthly_amount", citation="OAS Act, s. 7"),
            divide(field("eligible_years_oas"), const(40)),
        ],
    )
    as_dict = original.model_dump()
    restored = FormulaNode.model_validate(as_dict)

    v1, _ = _eval(original)
    v2, _ = _eval(restored)
    assert v1 == v2
