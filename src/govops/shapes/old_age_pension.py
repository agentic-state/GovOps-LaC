"""Old-age pension shape evaluator (canonical, schema/shapes/old_age_pension-v1.0.yaml).

Implements the eligible-branch logic for residency-and-age-based old-age
pensions. The canonical example is Canada's Old Age Security: a federal
pension paid to applicants who meet an age threshold and a minimum
residency / contribution period in the home jurisdiction; partial pensions
pro-rate at 1/N per year of qualified residency.

Migrated at the v3 Phase B engine refactor (per ADR-016) from
``OASEngine._partial_full_years()`` and ``OASEngine._qualified_years()``.
Byte-identical output to v2's pre-refactor behavior is asserted by
``tests/test_program_engine.py``.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Callable

from govops.models import CaseBundle, LegalRule, RuleType
from govops.residency import home_residency_years_after_18
from govops.shapes import EligibleDetails


class OldAgePensionEvaluator:
    shape_id = "old_age_pension"
    version = "1.0"

    def determine_eligible_details(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        param: Callable[..., Any],
    ) -> EligibleDetails:
        full_years = self._partial_full_years(rules, param)
        qualified = self._qualified_years(rules, case, evaluation_date, full_years, param)
        if qualified >= full_years:
            return EligibleDetails(
                pension_type="full",
                partial_ratio=f"{full_years}/{full_years}",
            )
        return EligibleDetails(
            pension_type="partial",
            partial_ratio=f"{qualified}/{full_years}",
        )

    def compute_formula_fields(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        param: Callable[..., Any],
    ) -> dict[str, float]:
        """Field map for OAS amount formulas (per ADR-011).

        Migrated from ``OASEngine.calculate()``'s inline field dict at the
        Phase B refactor. The two values come from the same residency math
        as the partial-pension ratio, so a manifest's calc rule and partial
        rule render in lockstep.
        """
        full_years = self._partial_full_years(rules, param)
        qualified = self._qualified_years(rules, case, evaluation_date, full_years, param)
        return {
            "eligible_years_oas": float(qualified),
            "full_years_oas": float(full_years),
        }

    # ------------------------------------------------------------------
    # Helpers (migrated from OASEngine)
    # ------------------------------------------------------------------

    def _partial_full_years(
        self,
        rules: list[LegalRule],
        param: Callable[..., Any],
    ) -> int:
        """Full-pension years threshold from the residency_partial rule.

        Defaults to 40 (the OAS canonical) when no residency_partial rule is
        present in the program.
        """
        for rule in rules:
            if rule.rule_type == RuleType.RESIDENCY_PARTIAL:
                return param(rule, "full_years", 40)
        return 40

    def _qualified_years(
        self,
        rules: list[LegalRule],
        case: CaseBundle,
        evaluation_date: date,
        full_years: int,
        param: Callable[..., Any],
    ) -> int:
        """Years of home-country residency after 18, integer-floored, capped at full_years.

        This is the value used both for the partial-pension ratio and for any
        formula ``field("eligible_years_oas")`` lookup (ADR-011). Keeping it
        in a single helper keeps the displayed ratio (e.g. "33/40") and the
        dollar amount in lockstep — they cite the same statutory clause.
        """
        home = self._get_home_countries(rules, param)
        years = home_residency_years_after_18(
            case.applicant.date_of_birth,
            case.residency_periods,
            evaluation_date,
            home_countries=home,
        )
        return min(int(years), full_years)

    def _get_home_countries(
        self,
        rules: list[LegalRule],
        param: Callable[..., Any],
    ) -> tuple[str, ...]:
        """Derive home countries from the rule list.

        Every residency rule in a v2 manifest carries ``home_countries`` via
        the substrate (per Phase 2 Domain 1), so the loop below always finds
        a match in any jurisdiction's seeded rule set. Returns an empty tuple
        only when the program has no residency rules — a degenerate state
        that the residency evaluators handle as missing evidence.
        """
        for rule in rules:
            hc = param(rule, "home_countries")
            if hc:
                return tuple(c.upper() for c in hc)
        return ()
