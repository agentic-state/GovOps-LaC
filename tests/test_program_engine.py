"""Tests for v3 Phase B engine generalization (per ADR-016).

The Phase B exit gate is a three-constructor byte-identical regression:
``ProgramEngine(program=ca_oas)``, ``ProgramEngine(rules=oas_rules)``, and
``OASEngine(rules=oas_rules)`` (deprecated alias) must produce identical
recommendations against every demo case in seed.py.
"""

from __future__ import annotations

import warnings
from datetime import date
from pathlib import Path

import pytest

from govops import seed
from govops.engine import OASEngine, ProgramEngine
from govops.models import DecisionOutcome, RuleType
from govops.programs import Program, load_program_manifest
from govops.shapes import (
    EligibleDetails,
    SHAPE_REGISTRY,
    ShapeEvaluator,
    get_shape,
    register_shape,
)
from govops.shapes.old_age_pension import OldAgePensionEvaluator

REPO_ROOT = Path(__file__).resolve().parent.parent
CA_OAS_MANIFEST = REPO_ROOT / "lawcode" / "ca" / "programs" / "oas.yaml"


# ---------------------------------------------------------------------------
# Shape registry
# ---------------------------------------------------------------------------


class TestShapeRegistry:
    def test_old_age_pension_registered(self):
        evaluator = get_shape("old_age_pension")
        assert evaluator.shape_id == "old_age_pension"
        assert evaluator.version == "1.0"

    def test_get_shape_unknown_raises(self):
        with pytest.raises(KeyError, match="not in registry"):
            get_shape("definitely_not_a_real_shape")

    def test_evaluator_satisfies_protocol(self):
        evaluator = get_shape("old_age_pension")
        assert isinstance(evaluator, ShapeEvaluator)

    def test_register_shape_is_idempotent(self):
        before = SHAPE_REGISTRY["old_age_pension"]
        register_shape(OldAgePensionEvaluator())
        after = SHAPE_REGISTRY["old_age_pension"]
        assert after is not before  # new instance
        assert after.shape_id == before.shape_id


# ---------------------------------------------------------------------------
# Constructor shapes (per ADR-016)
# ---------------------------------------------------------------------------


class TestConstructorShapes:
    def test_legacy_rules_only_uses_default_shape(self):
        engine = ProgramEngine(rules=seed.OAS_RULES)
        assert engine._shape_id == "old_age_pension"
        assert engine._program_id is None

    def test_explicit_shape_kwarg(self):
        engine = ProgramEngine(rules=seed.OAS_RULES, shape="old_age_pension")
        assert engine._shape_id == "old_age_pension"

    def test_program_kwarg_picks_shape_from_manifest(self):
        program = load_program_manifest(CA_OAS_MANIFEST)
        engine = ProgramEngine(program=program)
        assert engine._shape_id == "old_age_pension"
        assert engine._program_id == "oas"

    def test_both_program_and_rules_raises(self):
        program = load_program_manifest(CA_OAS_MANIFEST)
        with pytest.raises(ValueError, match="not both"):
            ProgramEngine(program=program, rules=seed.OAS_RULES)

    def test_neither_program_nor_rules_raises(self):
        with pytest.raises(ValueError, match="Must pass either"):
            ProgramEngine()

    def test_unknown_shape_raises(self):
        with pytest.raises(KeyError, match="not in registry"):
            ProgramEngine(rules=seed.OAS_RULES, shape="nonexistent_shape")


# ---------------------------------------------------------------------------
# Three-constructor byte-identical regression — Phase B exit gate
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def ca_oas_program() -> Program:
    return load_program_manifest(CA_OAS_MANIFEST)


@pytest.fixture(scope="module")
def demo_cases():
    return seed.make_demo_cases()


def _evaluate_three_ways(case, program: Program):
    """Run the same case through all three constructor shapes."""
    rec_program, _ = ProgramEngine(program=program).evaluate(case)
    rec_rules, _ = ProgramEngine(rules=seed.OAS_RULES).evaluate(case)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        rec_legacy, _ = OASEngine(rules=seed.OAS_RULES).evaluate(case)
    return rec_program, rec_rules, rec_legacy


class TestThreeConstructorRegression:
    """All three constructor paths must produce identical eligible-branch output."""

    @pytest.mark.parametrize("case_id", ["demo-case-001", "demo-case-002", "demo-case-003", "demo-case-004"])
    def test_outcome_matches_across_constructors(self, ca_oas_program, demo_cases, case_id):
        case = next(c for c in demo_cases if c.id == case_id)
        rec_program, rec_rules, rec_legacy = _evaluate_three_ways(case, ca_oas_program)
        # All three must agree on the substantive fields.
        for field_name in ("outcome", "pension_type", "partial_ratio", "missing_evidence", "flags"):
            assert getattr(rec_program, field_name) == getattr(rec_rules, field_name) == getattr(
                rec_legacy, field_name
            ), f"Mismatch on {field_name} for {case_id}"

    @pytest.mark.parametrize("case_id", ["demo-case-001", "demo-case-003"])
    def test_benefit_amount_matches_across_constructors(self, ca_oas_program, demo_cases, case_id):
        case = next(c for c in demo_cases if c.id == case_id)
        rec_program, rec_rules, rec_legacy = _evaluate_three_ways(case, ca_oas_program)
        # Eligible cases have a BenefitAmount via the formula AST.
        assert rec_program.benefit_amount is not None
        assert rec_rules.benefit_amount is not None
        assert rec_legacy.benefit_amount is not None
        assert rec_program.benefit_amount.value == rec_rules.benefit_amount.value == rec_legacy.benefit_amount.value
        assert (
            rec_program.benefit_amount.citations
            == rec_rules.benefit_amount.citations
            == rec_legacy.benefit_amount.citations
        )

    def test_rule_evaluations_align(self, ca_oas_program, demo_cases):
        case = demo_cases[0]
        rec_program, rec_rules, rec_legacy = _evaluate_three_ways(case, ca_oas_program)
        # Rule evaluations come out in dict-iteration order — stable across runs
        # and the same for all three constructors since they all wrap the same
        # underlying rule list.
        assert [e.rule_id for e in rec_program.rule_evaluations] == [
            e.rule_id for e in rec_rules.rule_evaluations
        ] == [e.rule_id for e in rec_legacy.rule_evaluations]


# ---------------------------------------------------------------------------
# New Recommendation fields (program_id + program_outcome_detail)
# ---------------------------------------------------------------------------


class TestRecommendationFields:
    def test_program_kwarg_populates_program_id(self, ca_oas_program, demo_cases):
        case = demo_cases[0]
        rec, _ = ProgramEngine(program=ca_oas_program).evaluate(case)
        assert rec.program_id == "oas"

    def test_legacy_rules_only_leaves_program_id_none(self, demo_cases):
        case = demo_cases[0]
        rec, _ = ProgramEngine(rules=seed.OAS_RULES).evaluate(case)
        assert rec.program_id is None

    def test_program_outcome_detail_empty_for_oas_shape(self, ca_oas_program, demo_cases):
        """OAS shape uses top-level pension_type / partial_ratio (per ADR-016).
        program_outcome_detail is reserved for non-OAS shapes (Phase C+).
        """
        case = next(c for c in demo_cases if c.id == "demo-case-001")
        rec, _ = ProgramEngine(program=ca_oas_program).evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "full"
        assert rec.program_outcome_detail == {}

    def test_program_outcome_detail_default_empty(self, demo_cases):
        case = demo_cases[0]
        rec, _ = ProgramEngine(rules=seed.OAS_RULES).evaluate(case)
        assert isinstance(rec.program_outcome_detail, dict)


# ---------------------------------------------------------------------------
# OASEngine deprecation alias still works
# ---------------------------------------------------------------------------


class TestOASEngineDeprecationAlias:
    def test_oasengine_emits_deprecation_warning(self):
        with pytest.warns(DeprecationWarning, match="ProgramEngine"):
            OASEngine(rules=seed.OAS_RULES)

    def test_oasengine_is_subclass_of_program_engine(self):
        assert issubclass(OASEngine, ProgramEngine)

    def test_oasengine_evaluate_works(self, demo_cases):
        case = demo_cases[0]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            rec, audit = OASEngine(rules=seed.OAS_RULES).evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "full"
        assert audit  # audit trail populated


# ---------------------------------------------------------------------------
# Shape evaluator direct invocation (sanity)
# ---------------------------------------------------------------------------


class TestOldAgePensionEvaluator:
    def test_compute_formula_fields_returns_oas_vocabulary(self, demo_cases):
        evaluator = get_shape("old_age_pension")
        case = next(c for c in demo_cases if c.id == "demo-case-001")
        engine = ProgramEngine(rules=seed.OAS_RULES, evaluation_date=date(2026, 4, 13))
        fields = evaluator.compute_formula_fields(
            list(engine.rules.values()),
            case,
            engine.evaluation_date,
            engine._param,
        )
        assert "eligible_years_oas" in fields
        assert "full_years_oas" in fields
        assert fields["full_years_oas"] == 40.0
        # demo-case-001 has been resident in CA from 1955 — well over 40 years
        # by the 2026 evaluation date, so the eligible_years cap kicks in.
        assert fields["eligible_years_oas"] == 40.0

    def test_determine_eligible_details_full_pension(self, demo_cases):
        evaluator = get_shape("old_age_pension")
        case = next(c for c in demo_cases if c.id == "demo-case-001")
        engine = ProgramEngine(rules=seed.OAS_RULES, evaluation_date=date(2026, 4, 13))
        details = evaluator.determine_eligible_details(
            list(engine.rules.values()),
            case,
            engine.evaluation_date,
            engine._param,
        )
        assert isinstance(details, EligibleDetails)
        assert details.pension_type == "full"
        assert details.partial_ratio == "40/40"

    def test_determine_eligible_details_partial_pension(self, demo_cases):
        evaluator = get_shape("old_age_pension")
        # demo-case-003 (Amara Osei) immigrated 1993 — partial pension as of 2026.
        case = next(c for c in demo_cases if c.id == "demo-case-003")
        engine = ProgramEngine(rules=seed.OAS_RULES, evaluation_date=date(2026, 4, 13))
        details = evaluator.determine_eligible_details(
            list(engine.rules.values()),
            case,
            engine.evaluation_date,
            engine._param,
        )
        assert details.pension_type == "partial"
        assert details.partial_ratio is not None
        # ratio shape is "qualified/full_years"
        qualified, full = details.partial_ratio.split("/")
        assert int(full) == 40
        assert 10 <= int(qualified) < 40
