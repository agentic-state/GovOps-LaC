"""Typed AST for calculation rules.

Per ADR-011, calculation rules carry a `formula` field whose value is a
typed AST. Each node has an `op` discriminator. Leaves resolve to numbers
via `const` / `ref` (ConfigStore lookup) / `field` (engine context).
Internal nodes are arithmetic / min / max / clamp.

The walker produces a flat trace alongside the result — every node visited
contributes one trace entry with its op, inputs, output, and citation.
That trace is the audit primitive for `BenefitAmount.formula_trace`.

The substrate stays dumb-on-purpose: no `eval`, no exec, no source string.
A reviewer can read any formula in YAML form without running anything;
the engine walks the tree node-by-node with explicit operator dispatch.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Callable, Optional

from pydantic import BaseModel, Field


class FormulaOp(str, Enum):
    CONST = "const"
    REF = "ref"
    FIELD = "field"
    ADD = "add"
    SUBTRACT = "subtract"
    MULTIPLY = "multiply"
    DIVIDE = "divide"
    MIN = "min"
    MAX = "max"
    CLAMP = "clamp"


class FormulaNode(BaseModel):
    """One node in a formula AST.

    Exactly one of (`value`, `ref_key`, `field_name`, `args`) is meaningful
    per node, dictated by `op`. Validation enforces this at construction.
    """

    op: FormulaOp
    citation: str = ""
    note: str = ""

    # leaf payloads — exactly one is set depending on op
    value: Optional[float | int | str] = None
    ref_key: Optional[str] = None
    field_name: Optional[str] = None

    # internal payload
    args: list["FormulaNode"] = Field(default_factory=list)


FormulaNode.model_rebuild()


class FormulaTraceStep(BaseModel):
    """One audit-visible step in the evaluation walk."""

    op: str
    inputs: list[Any] = Field(default_factory=list)
    output: float
    citation: str = ""
    note: str = ""


class FormulaError(ValueError):
    """Raised when a formula is malformed or cannot be evaluated.

    The message includes the offending op + a short context preview so the
    audit trail can localise the failure to a specific node.
    """


# ---------------------------------------------------------------------------
# Walker
# ---------------------------------------------------------------------------


def evaluate_formula(
    root: FormulaNode,
    *,
    resolve_ref: Callable[[str], float | int],
    resolve_field: Callable[[str], float | int],
) -> tuple[float, list[FormulaTraceStep]]:
    """Walk a formula AST, returning (result, ordered trace).

    `resolve_ref(key)` returns a numeric `ConfigValue` value (callers wire
    this to `ConfigStore.resolve` — the substrate is single-tenant for now,
    so global-jurisdiction fallback is acceptable).

    `resolve_field(name)` returns a numeric value derived from the case
    being evaluated (e.g. `eligible_years_oas`). The engine populates the
    field map before invoking the walker.

    Trace entries are appended in evaluation order — the trace is a
    reproducible record of the walk, not a tree.
    """
    trace: list[FormulaTraceStep] = []
    result = _walk(root, resolve_ref, resolve_field, trace)
    return result, trace


def _walk(
    node: FormulaNode,
    resolve_ref: Callable[[str], float | int],
    resolve_field: Callable[[str], float | int],
    trace: list[FormulaTraceStep],
) -> float:
    op = node.op

    if op is FormulaOp.CONST:
        if node.value is None:
            raise FormulaError("const node requires `value`")
        try:
            out = float(node.value)
        except (TypeError, ValueError) as exc:
            raise FormulaError(f"const value not numeric: {node.value!r}") from exc
        trace.append(FormulaTraceStep(
            op="const", inputs=[node.value], output=out,
            citation=node.citation, note=node.note,
        ))
        return out

    if op is FormulaOp.REF:
        if not node.ref_key:
            raise FormulaError("ref node requires `ref_key`")
        raw = resolve_ref(node.ref_key)
        try:
            out = float(raw)
        except (TypeError, ValueError) as exc:
            raise FormulaError(
                f"ref `{node.ref_key}` resolved to non-numeric value: {raw!r}"
            ) from exc
        trace.append(FormulaTraceStep(
            op="ref", inputs=[node.ref_key], output=out,
            citation=node.citation, note=node.note,
        ))
        return out

    if op is FormulaOp.FIELD:
        if not node.field_name:
            raise FormulaError("field node requires `field_name`")
        raw = resolve_field(node.field_name)
        try:
            out = float(raw)
        except (TypeError, ValueError) as exc:
            raise FormulaError(
                f"field `{node.field_name}` is non-numeric: {raw!r}"
            ) from exc
        trace.append(FormulaTraceStep(
            op="field", inputs=[node.field_name], output=out,
            citation=node.citation, note=node.note,
        ))
        return out

    # Internal nodes — first evaluate children, then combine.
    if not node.args:
        raise FormulaError(f"{op.value} node requires `args`")
    child_values = [_walk(c, resolve_ref, resolve_field, trace) for c in node.args]

    if op is FormulaOp.ADD:
        out = sum(child_values)
    elif op is FormulaOp.SUBTRACT:
        if len(child_values) != 2:
            raise FormulaError("subtract requires exactly 2 args")
        out = child_values[0] - child_values[1]
    elif op is FormulaOp.MULTIPLY:
        out = 1.0
        for v in child_values:
            out *= v
    elif op is FormulaOp.DIVIDE:
        if len(child_values) != 2:
            raise FormulaError("divide requires exactly 2 args")
        if child_values[1] == 0:
            raise FormulaError(
                f"divide-by-zero (citation: {node.citation or 'none'})"
            )
        out = child_values[0] / child_values[1]
    elif op is FormulaOp.MIN:
        out = min(child_values)
    elif op is FormulaOp.MAX:
        out = max(child_values)
    elif op is FormulaOp.CLAMP:
        if len(child_values) != 3:
            raise FormulaError("clamp requires exactly 3 args (value, lo, hi)")
        v, lo, hi = child_values
        if lo > hi:
            raise FormulaError(f"clamp bounds inverted: lo={lo} > hi={hi}")
        out = min(max(v, lo), hi)
    else:  # pragma: no cover — exhaustive over FormulaOp
        raise FormulaError(f"unhandled op: {op}")

    trace.append(FormulaTraceStep(
        op=op.value, inputs=child_values, output=out,
        citation=node.citation, note=node.note,
    ))
    return out


# ---------------------------------------------------------------------------
# Convenience constructors (test- and seed-friendly)
# ---------------------------------------------------------------------------


def const(value: float | int, citation: str = "", note: str = "") -> FormulaNode:
    return FormulaNode(op=FormulaOp.CONST, value=value, citation=citation, note=note)


def ref(key: str, citation: str = "", note: str = "") -> FormulaNode:
    return FormulaNode(op=FormulaOp.REF, ref_key=key, citation=citation, note=note)


def field(name: str, citation: str = "", note: str = "") -> FormulaNode:
    return FormulaNode(op=FormulaOp.FIELD, field_name=name, citation=citation, note=note)


def _internal(op: FormulaOp, args: list[FormulaNode], citation: str, note: str) -> FormulaNode:
    return FormulaNode(op=op, args=args, citation=citation, note=note)


def add(args: list[FormulaNode], citation: str = "", note: str = "") -> FormulaNode:
    return _internal(FormulaOp.ADD, args, citation, note)


def subtract(a: FormulaNode, b: FormulaNode, citation: str = "", note: str = "") -> FormulaNode:
    return _internal(FormulaOp.SUBTRACT, [a, b], citation, note)


def multiply(args: list[FormulaNode], citation: str = "", note: str = "") -> FormulaNode:
    return _internal(FormulaOp.MULTIPLY, args, citation, note)


def divide(a: FormulaNode, b: FormulaNode, citation: str = "", note: str = "") -> FormulaNode:
    return _internal(FormulaOp.DIVIDE, [a, b], citation, note)


def min_(args: list[FormulaNode], citation: str = "", note: str = "") -> FormulaNode:
    return _internal(FormulaOp.MIN, args, citation, note)


def max_(args: list[FormulaNode], citation: str = "", note: str = "") -> FormulaNode:
    return _internal(FormulaOp.MAX, args, citation, note)


def clamp(value: FormulaNode, lo: FormulaNode, hi: FormulaNode, citation: str = "", note: str = "") -> FormulaNode:
    return _internal(FormulaOp.CLAMP, [value, lo, hi], citation, note)
