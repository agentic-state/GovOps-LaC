"""GovOps rule engine.

Deterministic evaluation of pension/benefit eligibility rules.
Example case study: Old Age Security (Canada), based on the publicly
available Old Age Security Act (R.S.C., 1985, c. O-9).

Key statutory rules encoded:
  - s. 3(1): age >= 65
  - s. 3(2)(a): 10+ years of residence in Canada after age 18 (full pension with 40+ years)
  - s. 3(2)(b): partial pension for 10-39 years (pro-rata 1/40 per year)

Four possible outcomes:
  - eligible (full or partial pension)
  - ineligible
  - insufficient_evidence
  - escalate (edge cases needing human interpretation)
"""

from __future__ import annotations

from datetime import date

from govops.legacy_constants import resolve_param  # populates LEGACY_CONSTANTS
from govops.models import (
    AuditEntry,
    CaseBundle,
    DecisionOutcome,
    LegalRule,
    Recommendation,
    ResidencyPeriod,
    RuleEvaluation,
    RuleOutcome,
    RuleType,
)


def _years_between(start: date, end: date) -> float:
    """Calculate years between two dates as a decimal."""
    days = (end - start).days
    return days / 365.25


def _age_at(dob: date, ref_date: date) -> float:
    return _years_between(dob, ref_date)


def _home_residency_years_after_18(
    dob: date,
    residency_periods: list[ResidencyPeriod],
    ref_date: date,
    home_countries: tuple[str, ...],
) -> float:
    """Total years of home-country residency/contribution after the applicant turned 18.

    Callers must pass ``home_countries`` explicitly (post-Phase-2 there's no
    default to fall back on; jurisdictional values come from the registry via
    ``OASEngine._get_home_countries()``).
    """
    age_18_date = date(dob.year + 18, dob.month, dob.day)
    total_days = 0
    for period in residency_periods:
        if period.country.upper() not in home_countries:
            continue
        start = max(period.start_date, age_18_date)
        end = period.end_date or ref_date
        end = min(end, ref_date)
        if start < end:
            total_days += (end - start).days
    return total_days / 365.25


class OASEngine:
    """Deterministic OAS initial eligibility engine."""

    def __init__(self, rules: list[LegalRule], evaluation_date: date | None = None):
        self.rules = {r.id: r for r in rules}
        self.evaluation_date = evaluation_date or date.today()
        self._audit: list[AuditEntry] = []

    def _log(self, event_type: str, detail: str, data: dict | None = None):
        self._audit.append(AuditEntry(
            event_type=event_type,
            actor="system:oas-engine",
            detail=detail,
            data=data or {},
        ))

    def evaluate(self, case: CaseBundle) -> tuple[Recommendation, list[AuditEntry]]:
        """Run all rules against the case and produce a recommendation."""
        self._audit = []
        self._log("evaluation_start", f"Evaluating case {case.id}")

        evals: list[RuleEvaluation] = []
        missing_evidence: list[str] = []
        flags: list[str] = []

        # --- Evidence sufficiency pre-check ---
        dob_types = set(resolve_param("global.engine.evidence.dob_types"))
        residency_types = set(resolve_param("global.engine.evidence.residency_types"))
        has_dob_evidence = any(
            e.evidence_type in dob_types and e.provided
            for e in case.evidence_items
        )
        has_residency_evidence = any(
            e.evidence_type in residency_types and e.provided
            for e in case.evidence_items
        )

        if not has_dob_evidence:
            missing_evidence.append("Date of birth verification (birth certificate, passport, or government ID)")
        if not has_residency_evidence:
            missing_evidence.append("Residency verification (tax records, residency declaration, or utility bills)")

        # --- Rule evaluations ---
        for rule in self.rules.values():
            ev = self._evaluate_rule(rule, case, missing_evidence, flags)
            evals.append(ev)
            self._log("rule_evaluated", f"{rule.id}: {ev.outcome.value}", {
                "rule_id": rule.id,
                "outcome": ev.outcome.value,
            })

        # --- Determine overall outcome ---
        outcome, pension_type, partial_ratio = self._determine_outcome(evals, missing_evidence, flags, case)

        explanation = self._build_explanation(outcome, evals, pension_type, partial_ratio, missing_evidence)

        rec = Recommendation(
            case_id=case.id,
            outcome=outcome,
            rule_evaluations=evals,
            explanation=explanation,
            pension_type=pension_type,
            partial_ratio=partial_ratio,
            missing_evidence=missing_evidence,
            flags=flags,
        )

        self._log("recommendation_produced", f"Outcome: {outcome.value}", {
            "outcome": outcome.value,
            "pension_type": pension_type,
        })

        return rec, list(self._audit)

    def _evaluate_rule(
        self,
        rule: LegalRule,
        case: CaseBundle,
        missing_evidence: list[str],
        flags: list[str],
    ) -> RuleEvaluation:
        if rule.rule_type == RuleType.AGE_THRESHOLD:
            return self._eval_age(rule, case)
        elif rule.rule_type == RuleType.RESIDENCY_MINIMUM:
            return self._eval_residency_minimum(rule, case)
        elif rule.rule_type == RuleType.RESIDENCY_PARTIAL:
            return self._eval_residency_partial(rule, case)
        elif rule.rule_type == RuleType.LEGAL_STATUS:
            return self._eval_legal_status(rule, case, flags)
        elif rule.rule_type == RuleType.EVIDENCE_REQUIRED:
            return self._eval_evidence(rule, case, missing_evidence)
        else:
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.NOT_APPLICABLE,
                detail=f"Rule type {rule.rule_type} not handled by this engine version",
            )

    def _eval_age(self, rule: LegalRule, case: CaseBundle) -> RuleEvaluation:
        min_age = rule.parameters.get("min_age", 65)
        age = _age_at(case.applicant.date_of_birth, self.evaluation_date)
        satisfied = age >= min_age
        return RuleEvaluation(
            rule_id=rule.id,
            rule_description=rule.description,
            citation=rule.citation,
            outcome=RuleOutcome.SATISFIED if satisfied else RuleOutcome.NOT_SATISFIED,
            detail=f"Applicant age: {age:.1f} years (threshold: {min_age})",
        )

    def _get_home_countries(self) -> tuple[str, ...]:
        """Derive home countries from the jurisdiction in the current rule set.

        After Phase 2 Domain 1, every residency rule carries home_countries via
        the legacy_constants registry, so the loop below always finds a match
        in any jurisdiction's seeded rule set. Returns an empty tuple only
        when the engine is constructed with no residency rules — a degenerate
        state that the residency evaluators handle as missing evidence.
        """
        for rule in self.rules.values():
            hc = rule.parameters.get("home_countries")
            if hc:
                return tuple(c.upper() for c in hc)
        return ()

    def _eval_residency_minimum(self, rule: LegalRule, case: CaseBundle) -> RuleEvaluation:
        min_years = rule.parameters.get("min_years", 10)
        home = self._get_home_countries()
        if not case.residency_periods:
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.INSUFFICIENT_EVIDENCE,
                detail="No residency/contribution periods provided",
            )
        years = _home_residency_years_after_18(
            case.applicant.date_of_birth, case.residency_periods, self.evaluation_date,
            home_countries=home,
        )
        satisfied = years >= min_years
        return RuleEvaluation(
            rule_id=rule.id,
            rule_description=rule.description,
            citation=rule.citation,
            outcome=RuleOutcome.SATISFIED if satisfied else RuleOutcome.NOT_SATISFIED,
            detail=f"Residency/contribution after age 18: {years:.1f} years (minimum: {min_years})",
        )

    def _eval_residency_partial(self, rule: LegalRule, case: CaseBundle) -> RuleEvaluation:
        full_years = rule.parameters.get("full_years", 40)
        min_years = rule.parameters.get("min_years", 10)
        home = self._get_home_countries()
        if not case.residency_periods:
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.INSUFFICIENT_EVIDENCE,
                detail="No residency/contribution periods provided",
            )
        years = _home_residency_years_after_18(
            case.applicant.date_of_birth, case.residency_periods, self.evaluation_date,
            home_countries=home,
        )
        qualified_years = min(int(years), full_years)
        if years >= full_years:
            detail = f"Full pension: {years:.1f} years >= {full_years} year threshold"
        elif years >= min_years:
            detail = f"Partial pension: {qualified_years}/{full_years} (residency: {years:.1f} years)"
        else:
            detail = f"Below minimum: {years:.1f} years < {min_years} year threshold"
        return RuleEvaluation(
            rule_id=rule.id,
            rule_description=rule.description,
            citation=rule.citation,
            outcome=RuleOutcome.SATISFIED if years >= min_years else RuleOutcome.NOT_SATISFIED,
            detail=detail,
            evidence_used=[p.country for p in case.residency_periods],
        )

    def _eval_legal_status(
        self, rule: LegalRule, case: CaseBundle, flags: list[str],
    ) -> RuleEvaluation:
        accepted = rule.parameters.get("accepted_statuses", ["citizen", "permanent_resident"])
        status = case.applicant.legal_status.lower()
        if status in accepted:
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.SATISFIED,
                detail=f"Legal status '{status}' is accepted",
            )
        elif status == "other" or status == "":
            flags.append("Legal status requires human verification")
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.INSUFFICIENT_EVIDENCE,
                detail=f"Legal status '{status}' requires verification",
            )
        else:
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.NOT_SATISFIED,
                detail=f"Legal status '{status}' does not meet requirements",
            )

    def _eval_evidence(
        self, rule: LegalRule, case: CaseBundle, missing_evidence: list[str],
    ) -> RuleEvaluation:
        required_types = rule.parameters.get("required_types", [])
        provided_types = {e.evidence_type for e in case.evidence_items if e.provided}
        missing = [t for t in required_types if t not in provided_types]
        if missing:
            for m in missing:
                label = m.replace("_", " ").title()
                entry = f"Missing required evidence: {label}"
                if entry not in missing_evidence:
                    missing_evidence.append(entry)
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.INSUFFICIENT_EVIDENCE,
                detail=f"Missing: {', '.join(missing)}",
            )
        return RuleEvaluation(
            rule_id=rule.id,
            rule_description=rule.description,
            citation=rule.citation,
            outcome=RuleOutcome.SATISFIED,
            detail="All required evidence provided",
        )

    def _determine_outcome(
        self,
        evals: list[RuleEvaluation],
        missing_evidence: list[str],
        flags: list[str],
        case: CaseBundle,
    ) -> tuple[DecisionOutcome, str, str | None]:
        has_not_satisfied = any(e.outcome == RuleOutcome.NOT_SATISFIED for e in evals)
        has_insufficient = any(e.outcome == RuleOutcome.INSUFFICIENT_EVIDENCE for e in evals)

        if flags:
            return DecisionOutcome.ESCALATE, "", None

        if has_not_satisfied and not has_insufficient:
            return DecisionOutcome.INELIGIBLE, "", None

        if has_insufficient:
            return DecisionOutcome.INSUFFICIENT_EVIDENCE, "", None

        # All rules satisfied — determine pension type
        # Find the full_years from the partial-pension rule
        full_years = 40
        for rule in self.rules.values():
            if rule.rule_type == RuleType.RESIDENCY_PARTIAL:
                full_years = rule.parameters.get("full_years", 40)
                break
        home = self._get_home_countries()
        years = _home_residency_years_after_18(
            case.applicant.date_of_birth, case.residency_periods, self.evaluation_date,
            home_countries=home,
        )
        qualified = min(int(years), full_years)
        if qualified >= full_years:
            return DecisionOutcome.ELIGIBLE, "full", f"{full_years}/{full_years}"
        else:
            return DecisionOutcome.ELIGIBLE, "partial", f"{qualified}/{full_years}"

    def _build_explanation(
        self,
        outcome: DecisionOutcome,
        evals: list[RuleEvaluation],
        pension_type: str,
        partial_ratio: str | None,
        missing_evidence: list[str],
    ) -> str:
        parts = []
        if outcome == DecisionOutcome.ELIGIBLE:
            if pension_type == "full":
                parts.append("The applicant meets all statutory requirements for a FULL Old Age Security pension.")
            else:
                parts.append(
                    f"The applicant meets the minimum residency requirement for a PARTIAL Old Age Security pension "
                    f"at a rate of {partial_ratio} of the full amount."
                )
        elif outcome == DecisionOutcome.INELIGIBLE:
            parts.append("The applicant does not meet one or more statutory requirements for Old Age Security.")
        elif outcome == DecisionOutcome.INSUFFICIENT_EVIDENCE:
            parts.append("The case cannot be determined due to missing or unverified evidence.")
        elif outcome == DecisionOutcome.ESCALATE:
            parts.append("This case requires human review due to conditions that cannot be resolved automatically.")

        parts.append("")
        parts.append("Rule-by-rule assessment:")
        for ev in evals:
            icon = {
                RuleOutcome.SATISFIED: "[PASS]",
                RuleOutcome.NOT_SATISFIED: "[FAIL]",
                RuleOutcome.INSUFFICIENT_EVIDENCE: "[NEED]",
                RuleOutcome.NOT_APPLICABLE: "[N/A ]",
            }[ev.outcome]
            parts.append(f"  {icon} {ev.rule_description}")
            parts.append(f"        {ev.detail}")
            parts.append(f"        Authority: {ev.citation}")

        if missing_evidence:
            parts.append("")
            parts.append("Missing evidence:")
            for m in missing_evidence:
                parts.append(f"  - {m}")

        return "\n".join(parts)
