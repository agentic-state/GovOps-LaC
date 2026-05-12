"""Unemployment-insurance shape evaluator (canonical, schema/shapes/unemployment_insurance-v1.0.yaml).

Implements the eligible-branch logic for bounded-duration income replacement
programs with active job-search obligations. The canonical examples are
Canada's Employment Insurance (EI), Brazil's Seguro-Desemprego, Spain's
Prestación por Desempleo, France's Allocations chômage, Germany's
Arbeitslosengeld, Ukraine's Допомога по безробіттю.

Phase C (per ADR-017) ships hermetic isolation tests against synthetic
programs. Phase D handles the 6-jurisdiction rollout — JP excluded as
the architectural control per the v3 charter.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Callable

from govops.models import ActiveObligation, BenefitPeriod, CaseBundle, LegalRule, RuleType
from govops.shapes import EligibleDetails


class UnemploymentInsuranceEvaluator:
    shape_id = "unemployment_insurance"
    version = "1.0"

    def determine_eligible_details(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        param: Callable[..., Any],
    ) -> EligibleDetails:
        benefit_period = self._compute_benefit_period(rules, evaluation_date, param)
        obligations = self._collect_obligations(rules, param)
        return EligibleDetails(
            pension_type="",
            partial_ratio=None,
            benefit_period=benefit_period,
            active_obligations=obligations,
            program_outcome_detail={},
        )

    def compute_formula_fields(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        param: Callable[..., Any],
    ) -> dict[str, float]:
        """No formula-AST fields needed for the bounded-benefit shape in Phase C.

        Phase D may extend this if real jurisdictions need contribution-period-
        driven duration math via the formula AST (paralleling OAS's
        eligible_years_oas / full_years_oas vocabulary).
        """
        return {}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _compute_benefit_period(
        self,
        rules: list[LegalRule],
        evaluation_date: date,
        param: Callable[..., Any],
    ) -> BenefitPeriod | None:
        """Find the benefit_duration_bounded rule and compute the BenefitPeriod.

        Returns None when no such rule is present (degenerate program) or when
        ``weeks_total <= 0``.
        """
        for rule in rules:
            if rule.rule_type != RuleType.BENEFIT_DURATION_BOUNDED:
                continue
            weeks_total = int(param(rule, "weeks_total", 0))
            if weeks_total <= 0:
                return None
            start_offset_days = int(param(rule, "start_offset_days", 0))
            start = evaluation_date + timedelta(days=start_offset_days)
            end = start + timedelta(weeks=weeks_total)
            if evaluation_date <= start:
                weeks_remaining = weeks_total
            elif evaluation_date >= end:
                weeks_remaining = 0
            else:
                weeks_remaining = (end - evaluation_date).days // 7
            return BenefitPeriod(
                start_date=start,
                end_date=end,
                weeks_total=weeks_total,
                weeks_remaining=weeks_remaining,
                citations=[rule.citation] if rule.citation else [],
            )
        return None

    def _collect_obligations(
        self,
        rules: list[LegalRule],
        param: Callable[..., Any],
    ) -> list[ActiveObligation]:
        """Walk the rules; build an ActiveObligation for every active_obligation rule."""
        obligations: list[ActiveObligation] = []
        for rule in rules:
            if rule.rule_type != RuleType.ACTIVE_OBLIGATION:
                continue
            obligations.append(
                ActiveObligation(
                    obligation_id=param(rule, "obligation_id", rule.id),
                    description=rule.description,
                    citation=rule.citation,
                    cadence=param(rule, "cadence", None),
                )
            )
        return obligations
