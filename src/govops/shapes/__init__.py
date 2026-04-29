"""Program shape registry for GovOps v3.0 (per ADR-015 + ADR-016).

A *shape* is the contract a program manifest must satisfy. The shape catalog
is published under ``schema/shapes/`` (see ADR-015). Each published shape has
a Python *evaluator* registered here that implements the
:class:`ShapeEvaluator` Protocol — when the engine triages a case as
eligible (all rules satisfied), it delegates to the shape evaluator to
compute shape-specific outcome details (pension type, benefit duration,
obligations, etc.).

Per ADR-015's two-tier model, this module holds the **canonical published**
evaluators only. Local shapes (jurisdiction-specific shapes that haven't been
upstreamed) register themselves at deployment startup via the same
:func:`register_shape` API.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Callable, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from govops.models import CaseBundle, LegalRule


class EligibleDetails(BaseModel):
    """Shape-specific output for the eligible branch of an evaluation.

    Per ADR-016, when :class:`govops.engine.ProgramEngine` triages a case as
    eligible (all rules satisfied), it delegates to the shape evaluator to
    produce these details. Top-level fields ``pension_type`` and
    ``partial_ratio`` are kept for OAS-shape backward compatibility (web UI,
    audit package, decision-notice templates index them by name);
    ``program_outcome_detail`` is the forward-compatible storage location for
    bounded-benefit and other shape-specific output.
    """

    pension_type: str = ""
    partial_ratio: Optional[str] = None
    program_outcome_detail: dict = Field(default_factory=dict)


@runtime_checkable
class ShapeEvaluator(Protocol):
    """Protocol every published or local shape evaluator must satisfy."""

    shape_id: str
    version: str

    def determine_eligible_details(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        param: Callable[..., Any],
    ) -> EligibleDetails:
        """Compute shape-specific outcome details for an eligible case.

        ``param`` is the engine's bound ``_param(rule, name, default)``
        method, so the evaluator reads parameter values through the same
        substrate-aware path as the rule dispatcher (per ADR-013's scalar
        seam — `evaluation_date` flows end-to-end).
        """
        ...

    def compute_formula_fields(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        param: Callable[..., Any],
    ) -> dict[str, float]:
        """Return the field map for formula AST ``field`` node resolution.

        Per ADR-011, calculation rules embed a typed AST whose ``field``
        nodes name shape-specific case-derived values (e.g. OAS uses
        ``eligible_years_oas``, ``full_years_oas``). The engine itself is
        program-agnostic; the shape evaluator owns the field vocabulary.
        """
        ...


SHAPE_REGISTRY: dict[str, ShapeEvaluator] = {}


def register_shape(evaluator: ShapeEvaluator) -> None:
    """Register a :class:`ShapeEvaluator` instance under its ``shape_id``.

    Idempotent within a process: re-registering the same shape replaces the
    prior evaluator (intentional — supports test fixtures and local-shape
    overrides per ADR-015's two-tier model).
    """
    SHAPE_REGISTRY[evaluator.shape_id] = evaluator


def get_shape(shape_id: str) -> ShapeEvaluator:
    """Look up a registered shape evaluator. Raises :class:`KeyError` when missing."""
    if shape_id not in SHAPE_REGISTRY:
        raise KeyError(
            f"Shape '{shape_id}' not in registry. "
            f"Available shapes: {sorted(SHAPE_REGISTRY)}"
        )
    return SHAPE_REGISTRY[shape_id]


# ---------------------------------------------------------------------------
# Self-register canonical published shapes
# ---------------------------------------------------------------------------
# Ordered at the bottom of __init__ so EligibleDetails / ShapeEvaluator /
# SHAPE_REGISTRY are all defined before the evaluator module imports them.

from govops.shapes.old_age_pension import OldAgePensionEvaluator  # noqa: E402

register_shape(OldAgePensionEvaluator())
