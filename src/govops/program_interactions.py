"""Cross-program interaction detection (v3 / ADR-018 / Phase E).

When a single case is evaluated against multiple programs in one round trip,
the system emits :class:`ProgramInteractionWarning` records describing
relationships between the program outcomes. Phase E ships exactly one rule —
the OAS + EI dual-eligibility info note that PLAN-v3 names as the test target
— behind a registry so adopters of the substrate can author richer rules at
v4 without touching the engine.

A rule is a pure function::

    def rule(recommendations, jurisdiction_id) -> list[ProgramInteractionWarning]

It receives the list of recommendations produced by the cross-program engine
(one per program evaluated, in registration order) and the jurisdiction id of
the case being evaluated. It returns zero or more warnings. The detector
runs every registered rule and concatenates the results in registration
order. Warnings are advisory, not blocking — they live alongside the
recommendations and are surfaced both in the API response and the audit
package per ADR-018.
"""

from __future__ import annotations

from typing import Callable, List

from govops.models import (
    DecisionOutcome,
    ProgramInteractionWarning,
    Recommendation,
)


InteractionRule = Callable[
    [list[Recommendation], str],
    list[ProgramInteractionWarning],
]


# ---------------------------------------------------------------------------
# Built-in rules
# ---------------------------------------------------------------------------


def _oas_ei_dual_eligibility(
    recommendations: list[Recommendation],
    jurisdiction_id: str,
) -> list[ProgramInteractionWarning]:
    """When a case is ELIGIBLE for both OAS and EI, surface an info note.

    OAS (lifetime monthly pension) and EI (bounded contributory benefit)
    operate on independent statutory bases in every jurisdiction that runs
    both. They can be claimed concurrently. The warning is informational so
    cross-program consumers (the audit package, the comparison surface, the
    citizen entry path) can render both programs side by side without
    treating the dual eligibility as an exception.
    """
    by_program: dict[str, Recommendation] = {}
    for rec in recommendations:
        if rec.program_id:
            by_program[rec.program_id] = rec
    oas = by_program.get("oas")
    ei = by_program.get("ei")
    if oas is None or ei is None:
        return []
    if oas.outcome != DecisionOutcome.ELIGIBLE:
        return []
    if ei.outcome != DecisionOutcome.ELIGIBLE:
        return []
    return [
        ProgramInteractionWarning(
            severity="info",
            programs=["oas", "ei"],
            description=(
                "Applicant qualifies for both Old Age Security (lifetime monthly "
                "pension) and Employment Insurance (bounded contributory benefit). "
                "The two programs operate on independent statutory bases and may "
                "be claimed concurrently."
            ),
            citation="OAS Act + jurisdiction-specific EI statute (see per-program citations).",
        )
    ]


# ---------------------------------------------------------------------------
# Registry + dispatch
# ---------------------------------------------------------------------------


_RULES: list[InteractionRule] = [
    _oas_ei_dual_eligibility,
]


# Static metadata about each registered rule. Keyed by the rule function so a
# rule registration update auto-propagates. The metadata is what the
# /api/programs/{id}/interactions endpoint surfaces to the leader-comparison
# UI -- it is intentionally separate from the runtime rule body so a rule can
# document the program-pair without depending on any case context.
_RULE_METADATA: dict[InteractionRule, dict[str, object]] = {
    _oas_ei_dual_eligibility: {
        "id": "oas_ei_dual_eligibility",
        "severity": "info",
        "programs": ["oas", "ei"],
        "description": (
            "When a single applicant qualifies for both Old Age Security "
            "(lifetime monthly pension) and Employment Insurance (bounded "
            "contributory benefit), the two programs operate on independent "
            "statutory bases and may be claimed concurrently."
        ),
        "citation": (
            "OAS Act + jurisdiction-specific EI statute "
            "(see per-program citations)."
        ),
    },
}


def list_interactions_for(program_id: str) -> list[dict[str, object]]:
    """Return static metadata for every registered rule that mentions program_id.

    Used by the leader-facing comparison surface (/compare/{program_id}) so
    operators can see which OTHER programs interact with this one without
    needing a case context. Order matches the rule registry's order (insertion).
    """
    out: list[dict[str, object]] = []
    for rule in _RULES:
        meta = _RULE_METADATA.get(rule)
        if meta is None:
            continue
        if program_id in (meta.get("programs") or []):
            out.append(meta)
    return out


def detect_program_interactions(
    recommendations: list[Recommendation],
    jurisdiction_id: str = "",
) -> list[ProgramInteractionWarning]:
    """Run every registered interaction rule and return the concatenated warnings.

    Order is preserved — earlier rules' warnings come first. The function is
    pure: identical inputs produce identical outputs (no global state read).
    """
    warnings: list[ProgramInteractionWarning] = []
    for rule in _RULES:
        warnings.extend(rule(recommendations, jurisdiction_id))
    return warnings


def register_interaction_rule(rule: InteractionRule) -> None:
    """Append a custom interaction rule to the global registry.

    Intended for tests and for adopters who fork the substrate. Phase E does
    not yet expose this through YAML; v4 may. Idempotent only insofar as the
    caller controls duplicate registrations.
    """
    _RULES.append(rule)


def reset_interaction_rules() -> None:
    """Reset the registry to the built-in defaults. Intended for tests."""
    global _RULES
    _RULES = [_oas_ei_dual_eligibility]
