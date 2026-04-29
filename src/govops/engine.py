"""GovOps rule engine.

Deterministic evaluation of public-sector program eligibility rules.
Originally shipped (v2) as ``OASEngine`` for old-age pension; v3 Phase B
(per ADR-016) generalizes to ``ProgramEngine`` with shape-specific
post-processing delegated to evaluators in :mod:`govops.shapes`.

Backwards compatibility (one cycle, removed at v3.1 Phase I cutover):
``OASEngine`` is preserved as a thin :class:`DeprecationWarning`-emitting
subclass so v2 callers (api.py, screen.py, test_engine.py) keep working
unchanged. Migration path: pass ``program=`` instead of ``rules=``, or
import ``ProgramEngine`` directly.

Reference statutory case study:
  Old Age Security Act, R.S.C. 1985, c. O-9 — federal monthly pension for
  Canadian residents aged 65+. Encoded statutory rules:
    - s. 3(1): age >= 65
    - s. 3(2)(a): 10+ years residence after age 18 (full pension at 40+)
    - s. 3(2)(b): partial pension for 10-39 years (1/40 per year)

Four possible outcomes:
  - eligible (full or partial — for OAS-shape; or bounded period for EI-shape)
  - ineligible
  - insufficient_evidence
  - escalate (edge cases needing human interpretation)
"""

from __future__ import annotations

import warnings
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
    RuleEvaluation,
    RuleOutcome,
    RuleType,
)
from govops.programs import Program
from govops.residency import home_residency_years_after_18
from govops.shapes import ShapeEvaluator, get_shape


# Module-level helpers re-exported from govops.residency for backwards-compat —
# pre-v3 callers may have imported `_home_residency_years_after_18` from this
# module. Phase I cutover removes these.
def _years_between(start: date, end: date) -> float:
    """Deprecated alias for :func:`govops.residency.years_between`."""
    from govops.residency import years_between
    return years_between(start, end)


def _home_residency_years_after_18(
    dob: date,
    residency_periods,
    ref_date: date,
    home_countries: tuple[str, ...],
) -> float:
    """Deprecated alias for :func:`govops.residency.home_residency_years_after_18`."""
    return home_residency_years_after_18(dob, residency_periods, ref_date, home_countries)


def _age_at(dob: date, ref_date: date) -> float:
    days = (ref_date - dob).days
    return days / 365.25


# Default shape for legacy `rules=…`-only constructors (per ADR-016).
# v2 was OAS-only, so defaulting to old_age_pension is correct for every
# legacy caller that hasn't migrated to `program=…`.
_LEGACY_DEFAULT_SHAPE = "old_age_pension"


class ProgramEngine:
    """Deterministic eligibility engine, shape-agnostic.

    Per ADR-016, the engine handles program-agnostic concerns (rule dispatch,
    triage, audit, formula AST evaluation) and delegates shape-specific
    eligible-branch logic to a :class:`govops.shapes.ShapeEvaluator`.

    Construction shapes (any one of these works):

        ProgramEngine(program=ca_oas)                           # v3 native
        ProgramEngine(rules=oas_rules_list)                     # legacy
        ProgramEngine(rules=oas_rules_list, shape="old_age_pension")  # explicit
    """

    def __init__(
        self,
        rules: Optional[list[LegalRule]] = None,
        program: Optional[Program] = None,
        shape: Optional[str] = None,
        evaluation_date: Optional[date] = None,
        ref_resolver: Optional[Callable[[str], float | int]] = None,
    ):
        if program is not None and rules is not None:
            raise ValueError(
                "Pass either program= or rules=, not both. "
                "When program is given, rules are read from program.rules."
            )
        if program is None and rules is None:
            raise ValueError("Must pass either program= or rules=.")

        if program is not None:
            self.rules = {r.id: r for r in program.rules}
            self._program: Optional[Program] = program
            self._program_id: Optional[str] = program.program_id
            shape_id = program.shape
        else:
            self.rules = {r.id: r for r in rules}
            self._program = None
            self._program_id = None
            shape_id = shape or _LEGACY_DEFAULT_SHAPE

        self._shape: ShapeEvaluator = get_shape(shape_id)
        self._shape_id: str = shape_id
        self.evaluation_date = evaluation_date or date.today()
        self._audit: list[AuditEntry] = []
        # ConfigValue resolver for formula `ref` nodes (ADR-011). Defaults to
        # the substrate's resolve_param so coefficients flow through the same
        # path as every other LEGACY_CONSTANTS lookup; tests can inject a
        # callable for hermetic formula coverage.
        self._ref_resolver = ref_resolver or resolve_param

    # ------------------------------------------------------------------
    # Audit + parameter resolution helpers
    # ------------------------------------------------------------------

    def _log(self, event_type: str, detail: str, data: dict | None = None):
        self._audit.append(AuditEntry(
            event_type=event_type,
            actor=f"system:program-engine[{self._shape_id}]",
            detail=detail,
            data=data or {},
        ))

    def _eval_dt(self) -> Optional[datetime]:
        """The case's evaluation_date as a UTC-midnight datetime, for substrate lookups."""
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

        Closes ADR-013's scalar seam: a dated supersession of e.g.
        ``ca.rule.age-65.min_age`` (65 → 67 effective 2027-01-01) takes effect
        on its date for any case evaluated against the same code. Cases dated
        before the supersession see the prior value; cases dated after see the
        new one — the substrate is the source of truth.
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

    # ------------------------------------------------------------------
    # Top-level evaluation
    # ------------------------------------------------------------------

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

        # --- Determine overall outcome (triage generic; eligible-branch shape-specific) ---
        outcome, pension_type, partial_ratio, program_outcome_detail = self._determine_outcome(
            evals, missing_evidence, flags, case,
        )

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
            program_id=self._program_id,
            program_outcome_detail=program_outcome_detail,
        )

        self._log("recommendation_produced", f"Outcome: {outcome.value}", {
            "outcome": outcome.value,
            "pension_type": pension_type,
            "benefit_amount": benefit_amount.value if benefit_amount else None,
        })

        return rec, list(self._audit)

    # ------------------------------------------------------------------
    # Rule dispatch
    # ------------------------------------------------------------------

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
        """Calculation rules don't gate eligibility (ADR-011)."""
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
        """Derive home countries from the residency rules in the current set.

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
        years = home_residency_years_after_18(
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
        years = home_residency_years_after_18(
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

    # ------------------------------------------------------------------
    # Outcome triage (generic) + shape delegation (eligible branch)
    # ------------------------------------------------------------------

    def _determine_outcome(
        self,
        evals: list[RuleEvaluation],
        missing_evidence: list[str],
        flags: list[str],
        case: CaseBundle,
    ) -> tuple[DecisionOutcome, str, str | None, dict]:
        """Triage is generic; the eligible-branch is delegated to the shape (ADR-016)."""
        has_not_satisfied = any(e.outcome == RuleOutcome.NOT_SATISFIED for e in evals)
        has_insufficient = any(e.outcome == RuleOutcome.INSUFFICIENT_EVIDENCE for e in evals)

        if flags:
            return DecisionOutcome.ESCALATE, "", None, {}

        if has_not_satisfied and not has_insufficient:
            return DecisionOutcome.INELIGIBLE, "", None, {}

        if has_insufficient:
            return DecisionOutcome.INSUFFICIENT_EVIDENCE, "", None, {}

        # All rules satisfied — delegate eligible-branch details to shape evaluator.
        details = self._shape.determine_eligible_details(
            list(self.rules.values()),
            case,
            self.evaluation_date,
            self._param,
        )
        return (
            DecisionOutcome.ELIGIBLE,
            details.pension_type,
            details.partial_ratio,
            dict(details.program_outcome_detail),
        )

    # ------------------------------------------------------------------
    # Calculation (ADR-011) — engine generic, field map shape-specific
    # ------------------------------------------------------------------

    def calculate(self, case: CaseBundle) -> Optional[BenefitAmount]:
        """Compute the benefit amount for an eligible case via formula AST.

        Per ADR-011, a calculation rule's ``parameters['formula']`` is a typed
        AST tree. We resolve ``ref`` nodes through the substrate (default) and
        ``field`` nodes from a context map populated for this case by the
        active shape evaluator (ADR-016). Returns None when no calculation
        rule is present or when the formula is missing.
        """
        calc_rules = [r for r in self.rules.values() if r.rule_type == RuleType.CALCULATION]
        if not calc_rules:
            return None
        rule = calc_rules[0]
        formula_dict = rule.parameters.get("formula")
        if not formula_dict:
            return None

        formula = FormulaNode.model_validate(formula_dict)

        # Field map — values derived from the case at evaluation time. The
        # shape evaluator owns the field vocabulary (per ADR-016) so the
        # engine doesn't bake in OAS-specific names like 'eligible_years_oas'.
        fields = self._shape.compute_formula_fields(
            list(self.rules.values()),
            case,
            self.evaluation_date,
            self._param,
        )

        def resolve_field(name: str) -> float:
            if name not in fields:
                raise FormulaError(f"unknown formula field: {name}")
            return fields[name]

        # Date-aware ref resolution (ADR-013 §"the seam"): when the case's
        # evaluation_date is set, the formula's `ref` lookups resolve against
        # the substrate as it stood on that date.
        eval_dt = self._eval_dt()
        if self._ref_resolver is resolve_param:
            def resolve_ref(key: str) -> float | int:
                return resolve_param(key, evaluation_date=eval_dt)
        else:
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

    # ------------------------------------------------------------------
    # Explanation (program-agnostic prose synthesis)
    # ------------------------------------------------------------------

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
            elif pension_type == "partial":
                parts.append(
                    f"The applicant meets the minimum residency requirement for a PARTIAL Old Age Security pension "
                    f"at a rate of {partial_ratio} of the full amount."
                )
            else:
                # Non-OAS shape (e.g. unemployment_insurance in Phase C): the shape
                # provides its own narrative through program_outcome_detail; the
                # engine produces a generic eligible-statement so the audit
                # explanation isn't empty.
                parts.append("The applicant meets all statutory requirements for this program.")
        elif outcome == DecisionOutcome.INELIGIBLE:
            parts.append("The applicant does not meet one or more statutory requirements for this program.")
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


# ---------------------------------------------------------------------------
# Backwards-compat alias (per ADR-016)
# ---------------------------------------------------------------------------


class OASEngine(ProgramEngine):
    """Deprecated alias for :class:`ProgramEngine`.

    Preserved through one v3 cycle so v2 callers (api.py, screen.py,
    test_engine.py) keep working unchanged. Emits :class:`DeprecationWarning`
    on construction. Scheduled for removal at v3 Phase I cutover (v0.5.0
    release) per ADR-016 §"Deprecation".

    Migration: ``OASEngine(rules=…)`` → ``ProgramEngine(rules=…)``, or
    upgrade to ``ProgramEngine(program=…)`` once a Program object is in
    scope.
    """

    def __init__(self, *args, **kwargs):
        warnings.warn(
            "OASEngine is a deprecated alias for ProgramEngine; migrate to "
            "ProgramEngine before v3.1 (removal scheduled for Phase I cutover). "
            "See ADR-016.",
            DeprecationWarning,
            stacklevel=2,
        )
        super().__init__(*args, **kwargs)
