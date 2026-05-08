"""Hermetic tests for the unemployment_insurance shape (Phase C, per ADR-017).

These tests build synthetic LegalRule + CaseBundle objects directly in
Python — no manifest, no lawcode/, no jurisdiction. Phase D handles the
6-jurisdiction rollout with real manifests.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

import pytest

from govops.engine import ProgramEngine
from govops.models import (
    ActiveObligation,
    Applicant,
    BenefitPeriod,
    CaseBundle,
    DecisionOutcome,
    EvidenceItem,
    LegalRule,
    LegalSection,
    LegalDocument,
    DocumentType,
    ResidencyPeriod,
    RuleType,
)
from govops.programs import Program
from govops.shapes import EligibleDetails, get_shape
from govops.shapes.unemployment_insurance import UnemploymentInsuranceEvaluator


# ---------------------------------------------------------------------------
# Fixtures — synthetic EI program
# ---------------------------------------------------------------------------


def _make_synthetic_ei_rules(weeks_total: int = 35) -> list[LegalRule]:
    """Build a minimal EI rule set with all five canonical pieces.

    Shape: contribution period (residency_minimum), legal status, evidence,
    bounded benefit duration, and one active obligation.
    """
    return [
        LegalRule(
            id="rule-contribution",
            source_document_id="doc-ei-act",
            source_section_ref="s. 7(2)",
            rule_type=RuleType.RESIDENCY_MINIMUM,
            description="Minimum 600 hours of insurable employment in the qualifying period",
            formal_expression="contribution_hours >= 600",
            citation="Employment Insurance Act, S.C. 1996, c. 23, s. 7(2)",
            parameters={
                "min_years": 1,  # synthetic: 1 year of contribution
                "home_countries": ["TESTLAND"],
            },
        ),
        LegalRule(
            id="rule-legal-status",
            source_document_id="doc-ei-act",
            source_section_ref="s. 6(1)",
            rule_type=RuleType.LEGAL_STATUS,
            description="Applicant must be authorized to work",
            formal_expression="applicant.legal_status in ['citizen', 'permanent_resident']",
            citation="Employment Insurance Act, S.C. 1996, c. 23, s. 6(1)",
            parameters={"accepted_statuses": ["citizen", "permanent_resident"]},
        ),
        LegalRule(
            id="rule-evidence-job-loss",
            source_document_id="doc-ei-act",
            source_section_ref="s. 50(1)",
            rule_type=RuleType.EVIDENCE_REQUIRED,
            description="Record of Employment from former employer",
            formal_expression="has_evidence('record_of_employment')",
            citation="Employment Insurance Act, S.C. 1996, c. 23, s. 50(1)",
            parameters={"required_types": ["record_of_employment"]},
        ),
        LegalRule(
            id="rule-benefit-duration",
            source_document_id="doc-ei-act",
            source_section_ref="s. 12(2)",
            rule_type=RuleType.BENEFIT_DURATION_BOUNDED,
            description="Maximum weeks of regular benefits",
            formal_expression="weeks = f(contribution_hours, regional_unemployment_rate)",
            citation="Employment Insurance Act, S.C. 1996, c. 23, s. 12(2)",
            parameters={"weeks_total": weeks_total, "start_offset_days": 0},
        ),
        LegalRule(
            id="rule-active-job-search",
            source_document_id="doc-ei-act",
            source_section_ref="s. 18(1)(a)",
            rule_type=RuleType.ACTIVE_OBLIGATION,
            description="Recipient must be available for and actively seeking suitable employment",
            formal_expression="must remain available + actively seeking",
            citation="Employment Insurance Act, S.C. 1996, c. 23, s. 18(1)(a)",
            parameters={
                "obligation_id": "ei-job-search",
                "cadence": "biweekly",
            },
        ),
    ]


def _make_synthetic_ei_program(weeks_total: int = 35) -> Program:
    return Program(
        program_id="ei-synthetic",
        jurisdiction_id="testland-federal",
        shape="unemployment_insurance",
        status="active",
        name={"en": "Synthetic Employment Insurance"},
        rules=_make_synthetic_ei_rules(weeks_total),
        legal_documents=[
            LegalDocument(
                id="doc-ei-act",
                jurisdiction_id="testland-federal",
                document_type=DocumentType.STATUTE,
                title="Employment Insurance Act",
                citation="S.C. 1996, c. 23",
                sections=[
                    LegalSection(section_ref="s. 7(2)", heading="Qualifying period"),
                    LegalSection(section_ref="s. 12(2)", heading="Maximum weeks"),
                    LegalSection(section_ref="s. 18(1)(a)", heading="Availability for work"),
                ],
            ),
        ],
        demo_cases=[],
    )


def _make_eligible_case() -> CaseBundle:
    """Synthetic case: 35-year-old citizen with 5 years of contribution and an ROE."""
    return CaseBundle(
        id="ei-test-001",
        jurisdiction_id="testland-federal",
        applicant=Applicant(
            id="ei-app-001",
            date_of_birth=date(1990, 5, 15),
            legal_name="Test Applicant",
            legal_status="citizen",
            country_of_birth="TESTLAND",
        ),
        residency_periods=[
            ResidencyPeriod(
                country="Testland",
                start_date=date(2020, 1, 1),
                end_date=None,
                verified=True,
            ),
        ],
        evidence_items=[
            # Provide DOB + residency evidence so the engine's pre-check passes.
            EvidenceItem(id="ei-ev-001", evidence_type="birth_certificate", provided=True, verified=True),
            EvidenceItem(id="ei-ev-002", evidence_type="tax_record", provided=True, verified=True),
            EvidenceItem(id="ei-ev-003", evidence_type="record_of_employment", provided=True, verified=True),
        ],
    )


def _make_ineligible_case() -> CaseBundle:
    """Synthetic case missing the required ROE — INSUFFICIENT_EVIDENCE."""
    return CaseBundle(
        id="ei-test-002",
        jurisdiction_id="testland-federal",
        applicant=Applicant(
            id="ei-app-002",
            date_of_birth=date(1990, 5, 15),
            legal_name="Missing ROE",
            legal_status="citizen",
            country_of_birth="TESTLAND",
        ),
        residency_periods=[
            ResidencyPeriod(country="Testland", start_date=date(2020, 1, 1), verified=True),
        ],
        evidence_items=[
            EvidenceItem(id="ei-ev-101", evidence_type="birth_certificate", provided=True, verified=True),
            EvidenceItem(id="ei-ev-102", evidence_type="tax_record", provided=True, verified=True),
            # No record_of_employment — triggers INSUFFICIENT_EVIDENCE
        ],
    )


# ---------------------------------------------------------------------------
# Shape registration
# ---------------------------------------------------------------------------


class TestShapeRegistration:
    def test_unemployment_insurance_in_registry(self):
        evaluator = get_shape("unemployment_insurance")
        assert evaluator.shape_id == "unemployment_insurance"
        assert evaluator.version == "1.0"

    def test_evaluator_class_is_correct_type(self):
        assert isinstance(get_shape("unemployment_insurance"), UnemploymentInsuranceEvaluator)


# ---------------------------------------------------------------------------
# Engine dispatch for new RuleTypes
# ---------------------------------------------------------------------------


class TestNewRuleTypeDispatch:
    """Both new RuleTypes must report NOT_APPLICABLE in the rule loop (paralleling CALCULATION)."""

    def test_benefit_duration_bounded_evaluates_not_applicable(self):
        rules = _make_synthetic_ei_rules()
        case = _make_eligible_case()
        engine = ProgramEngine(rules=rules, shape="unemployment_insurance",
                               evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        bd_eval = next(e for e in rec.rule_evaluations if e.rule_id == "rule-benefit-duration")
        assert bd_eval.outcome.value == "not_applicable"
        assert "benefit_period" in bd_eval.detail

    def test_active_obligation_evaluates_not_applicable(self):
        rules = _make_synthetic_ei_rules()
        case = _make_eligible_case()
        engine = ProgramEngine(rules=rules, shape="unemployment_insurance",
                               evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        obl_eval = next(e for e in rec.rule_evaluations if e.rule_id == "rule-active-job-search")
        assert obl_eval.outcome.value == "not_applicable"
        assert "active_obligations" in obl_eval.detail


# ---------------------------------------------------------------------------
# End-to-end: synthetic EI program → ProgramEngine → BenefitPeriod + obligations
# ---------------------------------------------------------------------------


class TestEndToEndSyntheticEI:
    """Phase C exit gate: a synthetic EI program produces a BenefitPeriod + obligation list."""

    def test_eligible_case_produces_benefit_period(self):
        program = _make_synthetic_ei_program(weeks_total=35)
        case = _make_eligible_case()
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.benefit_period is not None
        assert isinstance(rec.benefit_period, BenefitPeriod)
        assert rec.benefit_period.weeks_total == 35
        assert rec.benefit_period.start_date == date(2026, 4, 29)
        assert rec.benefit_period.end_date == date(2026, 4, 29) + timedelta(weeks=35)
        # Citation flowed through from the rule.
        assert any("Employment Insurance Act" in c for c in rec.benefit_period.citations)

    def test_eligible_case_produces_active_obligations(self):
        program = _make_synthetic_ei_program()
        case = _make_eligible_case()
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert len(rec.active_obligations) == 1
        obl = rec.active_obligations[0]
        assert isinstance(obl, ActiveObligation)
        assert obl.obligation_id == "ei-job-search"
        assert obl.cadence == "biweekly"
        assert "actively seeking" in obl.description

    def test_eligible_case_program_id_populated(self):
        program = _make_synthetic_ei_program()
        case = _make_eligible_case()
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        assert rec.program_id == "ei-synthetic"

    def test_pension_type_empty_for_ei_shape(self):
        """OAS-shape fields stay empty for bounded-benefit shapes."""
        program = _make_synthetic_ei_program()
        case = _make_eligible_case()
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        assert rec.pension_type == ""
        assert rec.partial_ratio is None

    def test_ineligible_case_no_benefit_period(self):
        """Cases that don't reach ELIGIBLE shouldn't get a BenefitPeriod or obligations."""
        program = _make_synthetic_ei_program()
        case = _make_ineligible_case()
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INSUFFICIENT_EVIDENCE
        assert rec.benefit_period is None
        assert rec.active_obligations == []


# ---------------------------------------------------------------------------
# BenefitPeriod weeks_remaining math
# ---------------------------------------------------------------------------


class TestBenefitPeriodWeeksRemaining:
    """weeks_remaining is derived from evaluation_date so a re-eval mid-benefit
    shows accurate remaining duration without back-end state."""

    def _eval_with_offset(
        self, eval_date: date, start_offset_days: int, weeks_total: int = 35,
    ) -> Optional[BenefitPeriod]:
        """Build a program whose benefit started ``start_offset_days`` ago
        and evaluate it at ``eval_date``. Negative offset = past start."""
        program = _make_synthetic_ei_program(weeks_total=weeks_total)
        for rule in program.rules:
            if rule.rule_type == RuleType.BENEFIT_DURATION_BOUNDED:
                rule.parameters["start_offset_days"] = start_offset_days
        case = _make_eligible_case()
        engine = ProgramEngine(program=program, evaluation_date=eval_date)
        rec, _ = engine.evaluate(case)
        return rec.benefit_period

    def test_at_start_all_weeks_remain(self):
        # Default offset 0: start = evaluation_date, so all weeks remain.
        bp = self._eval_with_offset(date(2026, 4, 29), 0, weeks_total=35)
        assert bp is not None
        assert bp.weeks_remaining == 35

    def test_at_end_zero_weeks_remain(self):
        # Offset benefit start 35 weeks before evaluation_date — evaluation lands
        # exactly at end, so weeks_remaining = 0.
        bp = self._eval_with_offset(date(2026, 4, 29), -35 * 7, weeks_total=35)
        assert bp is not None
        assert bp.weeks_remaining == 0

    def test_past_end_weeks_remain_zero(self):
        # Offset start 50 weeks before; benefit ended 15 weeks before evaluation.
        bp = self._eval_with_offset(date(2026, 4, 29), -50 * 7, weeks_total=35)
        assert bp is not None
        assert bp.weeks_remaining == 0

    def test_midway_remaining_decreases(self):
        # Benefit started 10 weeks ago; 25 of 35 weeks remain.
        bp = self._eval_with_offset(date(2026, 4, 29), -10 * 7, weeks_total=35)
        assert bp is not None
        assert bp.weeks_total == 35
        # 35 - 10 = 25 weeks remain (give or take a day from rounding)
        assert 24 <= bp.weeks_remaining <= 25


# ---------------------------------------------------------------------------
# Direct evaluator invocation (sanity)
# ---------------------------------------------------------------------------


class TestUnemploymentInsuranceEvaluatorDirect:
    def test_determine_eligible_details_returns_typed_fields(self):
        evaluator = UnemploymentInsuranceEvaluator()
        rules = _make_synthetic_ei_rules()
        case = _make_eligible_case()
        engine = ProgramEngine(rules=rules, shape="unemployment_insurance",
                               evaluation_date=date(2026, 4, 29))
        details = evaluator.determine_eligible_details(
            list(engine.rules.values()),
            case,
            engine.evaluation_date,
            engine._param,
        )
        assert isinstance(details, EligibleDetails)
        assert details.pension_type == ""
        assert details.partial_ratio is None
        assert details.benefit_period is not None
        assert details.benefit_period.weeks_total == 35
        assert len(details.active_obligations) == 1

    def test_compute_formula_fields_empty_in_phase_c(self):
        """Phase C ships no field vocabulary for the EI shape; Phase D may extend."""
        evaluator = UnemploymentInsuranceEvaluator()
        rules = _make_synthetic_ei_rules()
        case = _make_eligible_case()
        fields = evaluator.compute_formula_fields(
            rules, case, date(2026, 4, 29), lambda r, n, d=None: d,
        )
        assert fields == {}

    def test_no_benefit_duration_rule_returns_none_period(self):
        """A program without a benefit_duration_bounded rule produces no BenefitPeriod."""
        evaluator = UnemploymentInsuranceEvaluator()
        rules_no_duration = [
            r for r in _make_synthetic_ei_rules()
            if r.rule_type != RuleType.BENEFIT_DURATION_BOUNDED
        ]
        case = _make_eligible_case()
        engine = ProgramEngine(rules=rules_no_duration, shape="unemployment_insurance",
                               evaluation_date=date(2026, 4, 29))
        details = evaluator.determine_eligible_details(
            list(engine.rules.values()),
            case,
            engine.evaluation_date,
            engine._param,
        )
        assert details.benefit_period is None

    def test_zero_weeks_total_returns_none_period(self):
        """A degenerate weeks_total=0 produces no BenefitPeriod (defensive)."""
        evaluator = UnemploymentInsuranceEvaluator()
        rules = _make_synthetic_ei_rules(weeks_total=0)
        case = _make_eligible_case()
        engine = ProgramEngine(rules=rules, shape="unemployment_insurance",
                               evaluation_date=date(2026, 4, 29))
        details = evaluator.determine_eligible_details(
            list(engine.rules.values()),
            case,
            engine.evaluation_date,
            engine._param,
        )
        assert details.benefit_period is None


# ---------------------------------------------------------------------------
# OAS shape unaffected (regression safeguard)
# ---------------------------------------------------------------------------


class TestOasShapeUnaffected:
    """Adding the new RuleTypes + Recommendation fields must not change OAS behavior."""

    def test_oas_eligible_case_leaves_new_fields_default(self):
        from govops import seed
        case = next(c for c in seed.make_demo_cases() if c.id == "demo-case-001")
        engine = ProgramEngine(rules=seed.OAS_RULES, evaluation_date=date(2026, 4, 13))
        rec, _ = engine.evaluate(case)
        # OAS-shape sets pension_type / partial_ratio (top-level)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "full"
        # But leaves the new EI-shape fields at their defaults
        assert rec.benefit_period is None
        assert rec.active_obligations == []
