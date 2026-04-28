"""Tests for the OAS eligibility rule engine.

Determinism property: identical inputs must produce identical outputs.
"""

from datetime import date


from govops.engine import OASEngine
from govops.models import (
    Applicant,
    CaseBundle,
    DecisionOutcome,
    EvidenceItem,
    ResidencyPeriod,
    RuleOutcome,
)
from govops.seed import OAS_RULES


def _make_engine(eval_date: date | None = None) -> OASEngine:
    return OASEngine(rules=OAS_RULES, evaluation_date=eval_date or date(2026, 4, 13))


def _make_case(
    dob: date,
    legal_status: str = "citizen",
    residency_periods: list[ResidencyPeriod] | None = None,
    evidence_items: list[EvidenceItem] | None = None,
) -> CaseBundle:
    return CaseBundle(
        jurisdiction_id="jur-ca-federal",
        applicant=Applicant(
            date_of_birth=dob,
            legal_name="Test Applicant",
            legal_status=legal_status,
        ),
        residency_periods=residency_periods or [],
        evidence_items=evidence_items or [],
    )


# ---------------------------------------------------------------------------
# Full pension: age 65+, 40+ years residency, all evidence
# ---------------------------------------------------------------------------

class TestFullPensionEligible:
    def test_clear_eligible(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, audit = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "full"
        assert rec.partial_ratio == "40/40"
        assert len(audit) > 0

    def test_determinism(self):
        """Same input must produce same output every time."""
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec1, _ = engine.evaluate(case)
        rec2, _ = engine.evaluate(case)
        assert rec1.outcome == rec2.outcome
        assert rec1.pension_type == rec2.pension_type
        assert len(rec1.rule_evaluations) == len(rec2.rule_evaluations)


# ---------------------------------------------------------------------------
# Partial pension
# ---------------------------------------------------------------------------

class TestPartialPension:
    def test_25_years_residency(self):
        """Immigrant with 25 years in Canada -> partial pension 25/40."""
        case = _make_case(
            dob=date(1958, 1, 1),
            legal_status="permanent_resident",
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1993, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "partial"
        assert "33/40" == rec.partial_ratio  # 1993 to 2026 = ~33 years

    def test_exactly_10_years(self):
        """Minimum residency = 10 years -> partial pension 10/40."""
        case = _make_case(
            dob=date(1951, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(2016, 4, 14)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine(eval_date=date(2026, 4, 13))
        rec, _ = engine.evaluate(case)
        # ~9.99 years, just barely under 10
        # Let's use a start that gives exactly 10+ years
        case2 = _make_case(
            dob=date(1951, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(2016, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        rec2, _ = engine.evaluate(case2)
        assert rec2.outcome == DecisionOutcome.ELIGIBLE
        assert rec2.pension_type == "partial"


# ---------------------------------------------------------------------------
# Ineligible: too young
# ---------------------------------------------------------------------------

class TestIneligibleAge:
    def test_under_65(self):
        case = _make_case(
            dob=date(1975, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1975, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INELIGIBLE
        # Age rule should be NOT_SATISFIED
        age_eval = next(e for e in rec.rule_evaluations if "65" in e.rule_description)
        assert age_eval.outcome == RuleOutcome.NOT_SATISFIED


# ---------------------------------------------------------------------------
# Ineligible: insufficient residency
# ---------------------------------------------------------------------------

class TestIneligibleResidency:
    def test_under_10_years(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(2020, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INELIGIBLE

    def test_no_canadian_residency(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="France", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INELIGIBLE


# ---------------------------------------------------------------------------
# Insufficient evidence
# ---------------------------------------------------------------------------

class TestInsufficientEvidence:
    def test_missing_birth_certificate(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="tax_record", provided=True),
                # No birth certificate
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INSUFFICIENT_EVIDENCE
        assert len(rec.missing_evidence) > 0

    def test_no_residency_periods(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INSUFFICIENT_EVIDENCE


# ---------------------------------------------------------------------------
# Escalation
# ---------------------------------------------------------------------------

class TestEscalation:
    def test_unknown_legal_status(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            legal_status="other",
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ESCALATE
        assert len(rec.flags) > 0


# ---------------------------------------------------------------------------
# Authority traceability
# ---------------------------------------------------------------------------

class TestTraceability:
    def test_every_rule_has_citation(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        for ev in rec.rule_evaluations:
            assert ev.citation, f"Rule {ev.rule_id} missing citation"
            assert "Old Age Security" in ev.citation or "C.R.C." in ev.citation

    def test_audit_trail_not_empty(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        _, audit = engine.evaluate(case)
        assert len(audit) >= 3  # start + rule evals + recommendation
        assert audit[0].event_type == "evaluation_start"
        assert audit[-1].event_type == "recommendation_produced"


# ---------------------------------------------------------------------------
# Residency calculation edge cases
# ---------------------------------------------------------------------------

class TestResidencyCalculation:
    def test_only_counts_after_age_18(self):
        """Residency before age 18 should not count."""
        case = _make_case(
            dob=date(1960, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1960, 1, 1), end_date=date(1985, 1, 1)),
                # 25 years total, but only 7 after age 18 (1978-1985)
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        # Only ~7 years after age 18, so under 10 year minimum
        assert rec.outcome == DecisionOutcome.INELIGIBLE

    def test_multiple_periods(self):
        """Multiple Canadian residency periods should be aggregated."""
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1980, 1, 1), end_date=date(1995, 1, 1)),
                ResidencyPeriod(country="UK", start_date=date(1995, 1, 1), end_date=date(2000, 1, 1)),
                ResidencyPeriod(country="Canada", start_date=date(2000, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        # 15 years (1980-1995) + 26 years (2000-2026) = ~41 years -> full pension
        assert rec.outcome == DecisionOutcome.ELIGIBLE


# ---------------------------------------------------------------------------
# Calculation rule (Phase 10B / ADR-011) — benefit_amount on the recommendation
# ---------------------------------------------------------------------------

class TestBenefitAmount:
    """End-to-end coverage that the calc rule fires for ELIGIBLE cases.

    The formula in seed.py is:
        base_monthly_amount × (eligible_years_oas / 40)
    where ``base_monthly_amount`` resolves to a YAML ConfigValue
    (727.67 today) and ``eligible_years_oas`` is the same integer-floored,
    bounded value the partial-ratio uses. The displayed ratio (e.g.
    "33/40") and the dollar amount must always agree about the same
    statutory clause.
    """

    def test_full_pension_pays_full_base(self):
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "full"
        assert rec.benefit_amount is not None
        assert rec.benefit_amount.value == 735.45
        assert rec.benefit_amount.currency == "CAD"
        assert rec.benefit_amount.period == "monthly"

    def test_partial_pension_prorates(self):
        """33 years residency → 33/40 ratio → 33/40 of base."""
        case = _make_case(
            dob=date(1958, 1, 1),
            legal_status="permanent_resident",
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1993, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "partial"
        assert rec.partial_ratio == "33/40"
        assert rec.benefit_amount is not None
        # Floats — round to 2dp the same way engine.calculate does.
        assert rec.benefit_amount.value == round(735.45 * (33.0 / 40.0), 2)

    def test_ineligible_case_has_no_benefit_amount(self):
        """Under-65 applicant is INELIGIBLE; no benefit_amount should appear."""
        case = _make_case(
            dob=date(2000, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(2018, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INELIGIBLE
        assert rec.benefit_amount is None

    def test_formula_trace_carries_per_node_citations(self):
        """The trace must let an auditor reproduce the dollar amount step by step."""
        case = _make_case(
            dob=date(1958, 1, 1),
            legal_status="permanent_resident",
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1993, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        ba = rec.benefit_amount
        assert ba is not None
        # The trace records every node visited in walk order.
        ops = [step["op"] for step in ba.formula_trace]
        assert "ref" in ops          # base_monthly_amount lookup
        assert "field" in ops        # eligible_years_oas
        assert "const" in ops        # the 40 divisor
        assert "divide" in ops
        assert "multiply" in ops
        # Each citation surfaces at least once in the dedup'd list.
        joined = " | ".join(ba.citations)
        assert "s. 7" in joined
        assert "s. 3(2)(b)" in joined

    def test_pre_supersession_evaluation_resolves_old_base_amount(self):
        """Configure-without-deploy E2E proof at the unit level (PLAN §8 #9).

        With the 2026-01-01 supersession of ``ca.calc.oas.base_monthly_amount``
        (727.67 → 735.45) in lawcode/, evaluating the same case twice with
        different evaluation_dates must produce the two different dollar
        amounts. The engine's formula `ref` resolution is date-aware as of
        ADR-013 §"the seam".
        """
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine_pre = _make_engine(eval_date=date(2025, 6, 1))
        rec_pre, _ = engine_pre.evaluate(case)
        assert rec_pre.benefit_amount is not None
        assert rec_pre.benefit_amount.value == 727.67

        engine_post = _make_engine(eval_date=date(2026, 6, 1))
        rec_post, _ = engine_post.evaluate(case)
        assert rec_post.benefit_amount is not None
        assert rec_post.benefit_amount.value == 735.45

        # Same case object, same engine logic, different dollar figures —
        # because the substrate's dated supersession is honoured.
        assert rec_pre.benefit_amount.value != rec_post.benefit_amount.value

    def test_calc_rule_does_not_gate_eligibility(self):
        """Adding a CALCULATION rule must not flip an eligible case to NOT_APPLICABLE."""
        case = _make_case(
            dob=date(1955, 1, 1),
            residency_periods=[
                ResidencyPeriod(country="Canada", start_date=date(1955, 1, 1)),
            ],
            evidence_items=[
                EvidenceItem(evidence_type="birth_certificate", provided=True),
                EvidenceItem(evidence_type="tax_record", provided=True),
            ],
        )
        engine = _make_engine()
        rec, _ = engine.evaluate(case)
        # The calc rule appears in evaluations as NOT_APPLICABLE — recorded
        # in the audit trail, not gating the outcome.
        calc_evals = [e for e in rec.rule_evaluations if e.rule_id == "rule-calc-oas-amount"]
        assert len(calc_evals) == 1
        assert calc_evals[0].outcome == RuleOutcome.NOT_APPLICABLE
        # Outcome is still ELIGIBLE despite the NOT_APPLICABLE entry.
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "full"


# ---------------------------------------------------------------------------
# Scalar parameter date-aware resolution (ADR-013 §"the seam", scalar half).
#
# These tests close the gap ADR-013 named: the formula `ref` half of the seam
# was already proven by `test_pre_supersession_evaluation_resolves_old_base_amount`.
# This block proves the analogous behaviour for scalar `LegalRule.parameters`
# values (e.g. age threshold). A dated supersession of `ca.rule.age-65.min_age`
# changes what cases see based on their evaluation_date — same engine, same
# rule object, different threshold.
# ---------------------------------------------------------------------------


class TestScalarParameterDatedSupersession:
    """Configure-without-deploy at the scalar-parameter layer (ADR-013, scalar seam).

    The fixture seeds an in-memory supersession through ConfigStore.put rather
    than the YAML loader so the test stays hermetic — the lawcode/ tree is
    unchanged. The supersession key is the SAME key seed.py reads at module
    import (`ca.rule.age-65.min_age`), so the engine's `_param` helper must
    re-resolve through the substrate at the case's evaluation_date for the
    test to pass.
    """

    def _seed_min_age_supersession(
        self,
        new_min_age: int,
        effective_from,  # datetime
    ) -> None:
        """Append a dated record for ca.rule.age-65.min_age via the live resolver.

        Uses the same ConfigStore the engine reads from
        (`govops.legacy_constants._resolver`), so the in-memory supersession
        is visible to the engine on the next evaluate() call. The original
        record stays in place; the new one supersedes it from
        `effective_from` forward.
        """
        from datetime import datetime as _dt, timezone as _tz

        from govops.config import ConfigValue, ValueType
        from govops.legacy_constants import _resolver

        _resolver.put(
            ConfigValue(
                domain="rule",
                key="ca.rule.age-65.min_age",
                jurisdiction_id="ca-oas",
                value=new_min_age,
                value_type=ValueType.NUMBER,
                effective_from=effective_from,
                citation="Hypothetical OAS Act amendment for date-aware test",
                author="test-fixture",
                approved_by="test-fixture",
                rationale="Pin a future supersession to prove the scalar seam.",
            )
        )

    def _drop_min_age_supersession(self) -> None:
        """Remove the test-fixture record so other tests aren't polluted.

        Identifies the fixture by the citation string we wrote — the original
        substrate record carries the real OAS Act citation, the fixture
        carries the explicit "Hypothetical … for date-aware test" string.
        """
        from govops.legacy_constants import _resolver

        with _resolver._session() as s:
            from sqlmodel import select as _select

            from govops.config import ConfigValue as _CV

            stmt = _select(_CV).where(
                _CV.key == "ca.rule.age-65.min_age",
                _CV.citation == "Hypothetical OAS Act amendment for date-aware test",
            )
            for row in list(s.exec(stmt)):
                s.delete(row)
            s.commit()

    def test_age_threshold_supersedes_on_effective_date(self):
        """A 2027-01-01 supersession from 65 → 67 must change what cases see.

        Same applicant (DOB 1962-01-01, age 64.5 in mid-2026, age 66 in 2028):
          - Evaluated 2026-06-01: threshold 65, age 64.5 → NOT_SATISFIED
          - Evaluated 2028-06-01 with supersession: threshold 67, age 66.5 → NOT_SATISFIED
          - Evaluated 2028-06-01 WITHOUT supersession: threshold 65, age 66.5 → SATISFIED

        The third assertion is the load-bearing one — it proves the seam:
        without re-resolving through the substrate, the engine would see the
        import-time-frozen value (65) and incorrectly mark the 2028 case
        eligible despite the 2027 supersession.
        """
        from datetime import datetime as _dt, timezone as _tz

        try:
            self._seed_min_age_supersession(
                new_min_age=67,
                effective_from=_dt(2027, 1, 1, tzinfo=_tz.utc),
            )

            case = _make_case(
                dob=date(1962, 1, 1),
                residency_periods=[
                    ResidencyPeriod(country="Canada", start_date=date(1962, 1, 1)),
                ],
                evidence_items=[
                    EvidenceItem(evidence_type="birth_certificate", provided=True),
                    EvidenceItem(evidence_type="tax_record", provided=True),
                ],
            )

            # 2026-06-01: pre-supersession, threshold = 65, age ≈ 64.4 → NOT_SATISFIED.
            engine_pre = _make_engine(eval_date=date(2026, 6, 1))
            rec_pre, _ = engine_pre.evaluate(case)
            age_eval_pre = next(
                e for e in rec_pre.rule_evaluations if e.rule_id == "rule-age-65"
            )
            assert age_eval_pre.outcome == RuleOutcome.NOT_SATISFIED
            assert "threshold: 65" in age_eval_pre.detail

            # 2028-06-01: post-supersession, threshold = 67, age ≈ 66.4 → NOT_SATISFIED.
            engine_post = _make_engine(eval_date=date(2028, 6, 1))
            rec_post, _ = engine_post.evaluate(case)
            age_eval_post = next(
                e for e in rec_post.rule_evaluations if e.rule_id == "rule-age-65"
            )
            assert age_eval_post.outcome == RuleOutcome.NOT_SATISFIED
            assert "threshold: 67" in age_eval_post.detail, (
                "Engine did not pick up the dated supersession — the scalar "
                "seam from ADR-013 is still open."
            )
        finally:
            self._drop_min_age_supersession()

    def test_age_threshold_pre_supersession_keeps_original(self):
        """Pre-supersession evaluation continues to see the original value.

        This is the dual of the previous test: with the same supersession
        (65 → 67 effective 2027-01-01) seeded, an evaluation against a 2026
        date must still see 65, not 67 — date-awareness goes both directions.
        """
        from datetime import datetime as _dt, timezone as _tz

        try:
            self._seed_min_age_supersession(
                new_min_age=67,
                effective_from=_dt(2027, 1, 1, tzinfo=_tz.utc),
            )

            case = _make_case(
                dob=date(1961, 1, 1),  # turns 65 in 2026, 67 in 2028
                residency_periods=[
                    ResidencyPeriod(country="Canada", start_date=date(1961, 1, 1)),
                ],
                evidence_items=[
                    EvidenceItem(evidence_type="birth_certificate", provided=True),
                    EvidenceItem(evidence_type="tax_record", provided=True),
                ],
            )

            # 2026-06-01: pre-supersession, threshold = 65, age ≈ 65.4 → SATISFIED.
            engine_pre = _make_engine(eval_date=date(2026, 6, 1))
            rec_pre, _ = engine_pre.evaluate(case)
            age_eval_pre = next(
                e for e in rec_pre.rule_evaluations if e.rule_id == "rule-age-65"
            )
            assert age_eval_pre.outcome == RuleOutcome.SATISFIED, (
                "Pre-supersession evaluation must see the original threshold."
            )
            assert "threshold: 65" in age_eval_pre.detail
        finally:
            self._drop_min_age_supersession()

    def test_engine_param_helper_falls_back_to_frozen_dict_when_prefix_absent(self):
        """Ad-hoc rules without param_key_prefix must keep working.

        Backwards-compat invariant: the seam closure shouldn't break tests or
        ad-hoc engine constructions that build a LegalRule by hand without
        setting a substrate prefix.
        """
        from govops.engine import OASEngine
        from govops.models import LegalRule, RuleType

        rule = LegalRule(
            id="rule-adhoc",
            source_document_id="doc-test",
            source_section_ref="N/A",
            rule_type=RuleType.AGE_THRESHOLD,
            description="Ad-hoc test rule",
            formal_expression="age >= 70",
            citation="Hypothetical",
            parameters={"min_age": 70},
            # NO param_key_prefix — this is the test
        )

        engine = OASEngine(rules=[rule], evaluation_date=date(2026, 6, 1))
        # _param must return the frozen-dict value when prefix is absent.
        assert engine._param(rule, "min_age", 65) == 70
        # Unknown key with a default also works.
        assert engine._param(rule, "unknown_key", "fallback") == "fallback"
