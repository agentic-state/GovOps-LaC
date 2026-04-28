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

from datetime import date, datetime, timezone

from typing import Any, Callable, Optional

from govops.config import ConfigKeyNotMigrated
from govops.formula import FormulaError, FormulaNode, evaluate_formula
from govops.legacy_constants import resolve_param  # populates LEGACY_CONSTANTS
from govops.models import (
    AuditEntry,
    BenefitAmount,
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

    def __init__(
        self,
        rules: list[LegalRule],
        evaluation_date: date | None = None,
        ref_resolver: Optional[Callable[[str], float | int]] = None,
    ):
        self.rules = {r.id: r for r in rules}
        self.evaluation_date = evaluation_date or date.today()
        self._audit: list[AuditEntry] = []
        # ConfigValue resolver for formula `ref` nodes (ADR-011). Defaults to
        # the substrate's resolve_param so coefficients flow through the same
        # path as every other LEGACY_CONSTANTS lookup; tests can inject a
        # callable for hermetic formula coverage.
        self._ref_resolver = ref_resolver or resolve_param

    def _log(self, event_type: str, detail: str, data: dict | None = None):
        self._audit.append(AuditEntry(
            event_type=event_type,
            actor="system:oas-engine",
            detail=detail,
            data=data or {},
        ))

    def _eval_dt(self) -> Optional[datetime]:
        """The case's evaluation_date as a UTC-midnight datetime, for substrate lookups.

        Returns None when evaluation_date is unset, signalling the substrate
        resolver to use "now" — same behaviour as before the seam closed.
        """
        if self.evaluation_date is None:
            return None
        return datetime(
            self.evaluation_date.year,
            self.evaluation_date.month,
            self.evaluation_date.day,
            tzinfo=timezone.utc,
        )

    def _param(self, rule: LegalRule, name: str, default: Any = None) -> Any:
        """Resolve a scalar rule parameter, substrate-first, honouring evaluation_date.

        Closes ADR-013's named seam: a dated supersession of e.g.
        ``ca.rule.age-65.min_age`` (65 → 67 effective 2027-01-01) takes effect
        on its date for any case evaluated against the same code. Cases dated
        before the supersession see the prior value; cases dated after see the
        new one. Same engine, same rule object, different ``evaluation_date``,
        different threshold — the substrate is the source of truth.

        Falls back to ``rule.parameters[name]`` when the rule has no
        ``param_key_prefix`` (ad-hoc rules in tests) or when the substrate
        raises ``ConfigKeyNotMigrated`` (the substrate is silent for that key).
        Frozen-dict fallback preserves backwards-compat for the 65→340 test
        suite that pre-dates this refactor.
        """
        frozen = rule.parameters.get(name, default)
        if not rule.param_key_prefix:
            return frozen
        try:
            return resolve_param(
                f"{rule.param_key_prefix}.{name}",
                default=frozen,
                evaluation_date=self._eval_dt(),
            )
        except ConfigKeyNotMigrated:
            return frozen

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

        # Compute benefit amount for eligible cases via formula AST (ADR-011).
        # Failures during calculation don't invalidate eligibility — they
        # surface as a flag and a None amount, so the citizen sees the
        # eligibility decision even if the dollar figure can't be rendered.
        benefit_amount: Optional[BenefitAmount] = None
        if outcome == DecisionOutcome.ELIGIBLE:
            try:
                benefit_amount = self.calculate(case)
            except FormulaError as exc:
                flags.append(f"benefit_amount_unavailable: {exc}")
                self._log("calculation_error", str(exc), {})

        rec = Recommendation(
            case_id=case.id,
            outcome=outcome,
            rule_evaluations=evals,
            explanation=explanation,
            pension_type=pension_type,
            partial_ratio=partial_ratio,
            missing_evidence=missing_evidence,
            flags=flags,
            benefit_amount=benefit_amount,
        )

        self._log("recommendation_produced", f"Outcome: {outcome.value}", {
            "outcome": outcome.value,
            "pension_type": pension_type,
            "benefit_amount": benefit_amount.value if benefit_amount else None,
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
        elif rule.rule_type == RuleType.CALCULATION:
            return self._eval_calculation(rule)
        else:
            return RuleEvaluation(
                rule_id=rule.id,
                rule_description=rule.description,
                citation=rule.citation,
                outcome=RuleOutcome.NOT_APPLICABLE,
                detail=f"Rule type {rule.rule_type} not handled by this engine version",
            )

    def _eval_calculation(self, rule: LegalRule) -> RuleEvaluation:
        """Calculation rules don't gate eligibility (ADR-011).

        They produce an amount when the case is eligible. The gating loop
        records them as NOT_APPLICABLE so they appear in the audit trail but
        don't push the outcome to INELIGIBLE / INSUFFICIENT_EVIDENCE. The
        actual amount is computed in calculate() after _determine_outcome
        returns ELIGIBLE.
        """
        return RuleEvaluation(
            rule_id=rule.id,
            rule_description=rule.description,
            citation=rule.citation,
            outcome=RuleOutcome.NOT_APPLICABLE,
            detail="Calculation rule — see benefit_amount on recommendation",
        )

    def _eval_age(self, rule: LegalRule, case: CaseBundle) -> RuleEvaluation:
        min_age = self._param(rule, "min_age", 65)
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
            hc = self._param(rule, "home_countries")
            if hc:
                return tuple(c.upper() for c in hc)
        return ()

    def _eval_residency_minimum(self, rule: LegalRule, case: CaseBundle) -> RuleEvaluation:
        min_years = self._param(rule, "min_years", 10)
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
        full_years = self._param(rule, "full_years", 40)
        min_years = self._param(rule, "min_years", 10)
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
        accepted = self._param(rule, "accepted_statuses", ["citizen", "permanent_resident"])
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
        required_types = self._param(rule, "required_types", [])
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
        full_years = self._partial_full_years()
        qualified = self._qualified_years(case, full_years)
        if qualified >= full_years:
            return DecisionOutcome.ELIGIBLE, "full", f"{full_years}/{full_years}"
        else:
            return DecisionOutcome.ELIGIBLE, "partial", f"{qualified}/{full_years}"

    def _partial_full_years(self) -> int:
        """Full-pension years threshold from the residency-partial rule.

        Defaults to 40 (the OAS canonical) when no partial rule is present.
        """
        for rule in self.rules.values():
            if rule.rule_type == RuleType.RESIDENCY_PARTIAL:
                return self._param(rule, "full_years", 40)
        return 40

    def _qualified_years(self, case: CaseBundle, full_years: int) -> int:
        """Years of home-country residency after 18, integer-floored and capped at full_years.

        This is the value used both for the partial-pension ratio and for
        formula `field("eligible_years_oas")` lookups. Keeping it in one
        helper guarantees the displayed ratio (e.g. "33/40") and the dollar
        amount stay in lockstep — they cite the same statutory clause.
        """
        home = self._get_home_countries()
        years = _home_residency_years_after_18(
            case.applicant.date_of_birth, case.residency_periods, self.evaluation_date,
            home_countries=home,
        )
        return min(int(years), full_years)

    def calculate(self, case: CaseBundle) -> Optional[BenefitAmount]:
        """Compute the benefit amount for an eligible case via formula AST.

        Per ADR-011, a calculation rule's `parameters['formula']` is a typed
        AST tree. We resolve `ref` nodes through the substrate (default) and
        `field` nodes from a context map populated for this case. The walk
        produces a flat trace; every render of "you would receive $X/month"
        must be reproducible from the trace alone.

        Returns None when no calculation rule is present (older
        jurisdictions that haven't adopted CALCULATION yet) or when the
        formula is missing.
        """
        calc_rules = [r for r in self.rules.values() if r.rule_type == RuleType.CALCULATION]
        if not calc_rules:
            return None
        # One calc rule per jurisdiction in v1; if a jurisdiction needs
        # several (e.g. base + supplement), we'll iterate and aggregate.
        rule = calc_rules[0]
        formula_dict = rule.parameters.get("formula")
        if not formula_dict:
            return None

        formula = FormulaNode.model_validate(formula_dict)

        # Field map — values derived from the case at evaluation time. Keep
        # this small and explicit; new fields land alongside new formulas.
        full_years = self._partial_full_years()
        fields = {
            "eligible_years_oas": float(self._qualified_years(case, full_years)),
            "full_years_oas": float(full_years),
        }

        def resolve_field(name: str) -> float:
            if name not in fields:
                raise FormulaError(f"unknown formula field: {name}")
            return fields[name]

        # Date-aware ref resolution (ADR-013 §"the seam"): when the case's
        # evaluation_date is set, the formula's `ref` lookups resolve against
        # the substrate as it stood on that date — so a 2025 case re-evaluated
        # in 2026 still picks up 2025's coefficient. Tests can inject a
        # callable directly via the constructor's `ref_resolver` for hermetic
        # coverage; the default path threads the date through resolve_param.
        eval_dt = self._eval_dt()
        if self._ref_resolver is resolve_param:
            def resolve_ref(key: str) -> float | int:
                return resolve_param(key, evaluation_date=eval_dt)
        else:
            # Test-injected resolver: pass through unchanged.
            resolve_ref = self._ref_resolver

        value, trace = evaluate_formula(
            formula,
            resolve_ref=resolve_ref,
            resolve_field=resolve_field,
        )

        # Deduplicate citations in walk order so the audit surface lists the
        # statutory sources without repetition.
        citations: list[str] = []
        seen: set[str] = set()
        for step in trace:
            if step.citation and step.citation not in seen:
                citations.append(step.citation)
                seen.add(step.citation)

        return BenefitAmount(
            value=round(value, 2),
            currency=rule.parameters.get("currency", "CAD"),
            period=rule.parameters.get("period", "monthly"),
            formula_trace=[s.model_dump() for s in trace],
            citations=citations,
        )

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
