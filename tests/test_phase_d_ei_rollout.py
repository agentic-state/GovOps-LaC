"""Phase D — EI rollout parity + per-jurisdiction smoke tests.

Phase D exit gate: a CA-EI demo case, BR Seguro-Desemprego, ES Prestación,
FR Allocations, DE Arbeitslosengeld, and UA Допомога all evaluate cleanly
through the engine and return a BenefitPeriod + obligation list.

JP is intentionally excluded — `lawcode/jp/programs/ei.yaml` MUST NOT exist
(architectural control per the v3 charter §"The proof").
"""

from __future__ import annotations

from pathlib import Path

import pytest

from govops.engine import ProgramEngine
from govops.models import BenefitPeriod, DecisionOutcome, RuleType
from govops.programs import Program, load_program_manifest

REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE = REPO_ROOT / "lawcode"

# The 6 jurisdictions in scope for symmetric EI extension per charter.
EI_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua"]
# JP is the architectural control — explicitly excluded.
EXCLUDED_JURISDICTIONS = ["jp"]


def _ei_manifest_path(jur: str) -> Path:
    return LAWCODE / jur / "programs" / "ei.yaml"


# ---------------------------------------------------------------------------
# Symmetry parity: all 6 active jurisdictions have an EI manifest
# ---------------------------------------------------------------------------


class TestSymmetryRule:
    """Per the charter's symmetry rule: add a program once, all 6 jurisdictions get it."""

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_ei_manifest_present(self, jur: str):
        path = _ei_manifest_path(jur)
        assert path.exists(), (
            f"{path.relative_to(REPO_ROOT)} missing — Phase D requires EI manifests "
            f"in all 6 active jurisdictions"
        )

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_ei_config_present(self, jur: str):
        config_path = LAWCODE / jur / "config" / "ei-rules.yaml"
        assert config_path.exists(), (
            f"{config_path.relative_to(REPO_ROOT)} missing — substrate values "
            f"required for EI rule resolution"
        )

    @pytest.mark.parametrize("excluded_jur", EXCLUDED_JURISDICTIONS)
    def test_excluded_jurisdiction_has_no_ei_manifest(self, excluded_jur: str):
        """JP stays as the architectural control — extending v3 to JP requires
        explicit user re-approval per the charter."""
        path = _ei_manifest_path(excluded_jur)
        assert not path.exists(), (
            f"{path.relative_to(REPO_ROOT)} exists — JP must remain unextended "
            f"in v3 (architectural control per charter §'The proof')"
        )


# ---------------------------------------------------------------------------
# Manifest structural integrity
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def loaded_ei_programs() -> dict[str, Program]:
    return {jur: load_program_manifest(_ei_manifest_path(jur)) for jur in EI_JURISDICTIONS}


class TestManifestStructure:
    """Each EI manifest must conform to ADR-014 + ADR-017's contract."""

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_program_id_is_ei(self, loaded_ei_programs, jur: str):
        assert loaded_ei_programs[jur].program_id == "ei"

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_shape_is_unemployment_insurance(self, loaded_ei_programs, jur: str):
        assert loaded_ei_programs[jur].shape == "unemployment_insurance"

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_has_authority_chain(self, loaded_ei_programs, jur: str):
        assert len(loaded_ei_programs[jur].authority_chain) >= 3, (
            f"{jur} EI manifest needs at least constitution → act → service"
        )

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_has_required_rule_types(self, loaded_ei_programs, jur: str):
        """unemployment_insurance shape requires 5 rule types (per ADR-015 +
        ADR-017): residency_minimum (contribution period), legal_status,
        evidence_required, benefit_duration_bounded, active_obligation."""
        rule_types = {r.rule_type for r in loaded_ei_programs[jur].rules}
        required = {
            RuleType.RESIDENCY_MINIMUM,
            RuleType.LEGAL_STATUS,
            RuleType.EVIDENCE_REQUIRED,
            RuleType.BENEFIT_DURATION_BOUNDED,
            RuleType.ACTIVE_OBLIGATION,
        }
        assert required.issubset(rule_types), (
            f"{jur} EI manifest missing required rule types: {required - rule_types}"
        )

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_has_four_demo_cases(self, loaded_ei_programs, jur: str):
        """Phase D requires 4 demo cases per jurisdiction covering eligible /
        ineligible / second-eligible / insufficient-evidence paths."""
        assert len(loaded_ei_programs[jur].demo_cases) == 4, (
            f"{jur} EI manifest must have exactly 4 demo cases (got "
            f"{len(loaded_ei_programs[jur].demo_cases)})"
        )

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_localized_program_name_present(self, loaded_ei_programs, jur: str):
        """Each EI manifest carries a locale-keyed name dict (en + at least
        one local language)."""
        program = loaded_ei_programs[jur]
        assert program.name.get("en"), f"{jur} EI manifest missing English name"
        assert len(program.name) >= 2, (
            f"{jur} EI manifest should localize beyond English alone"
        )


# ---------------------------------------------------------------------------
# Substrate parameter resolution — every {ref:} resolves to a real value
# ---------------------------------------------------------------------------


class TestSubstrateRefsResolve:
    """Each EI manifest's substrate refs must resolve through the substrate
    (loaded from lawcode/<jur>/config/ei-rules.yaml at module import)."""

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_contribution_min_years_resolved(self, loaded_ei_programs, jur: str):
        rule = next(
            r for r in loaded_ei_programs[jur].rules
            if r.id == "rule-ei-contribution"
        )
        assert isinstance(rule.parameters["min_years"], (int, float))
        assert rule.parameters["min_years"] >= 1

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_duration_weeks_total_resolved(self, loaded_ei_programs, jur: str):
        rule = next(
            r for r in loaded_ei_programs[jur].rules
            if r.id == "rule-ei-duration"
        )
        weeks = rule.parameters["weeks_total"]
        assert isinstance(weeks, (int, float))
        assert weeks > 0, f"{jur} EI weeks_total must be positive"

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_evidence_required_types_resolved(self, loaded_ei_programs, jur: str):
        rule = next(
            r for r in loaded_ei_programs[jur].rules
            if r.id == "rule-ei-evidence"
        )
        types = rule.parameters["required_types"]
        assert isinstance(types, list)
        assert len(types) >= 1


# ---------------------------------------------------------------------------
# Per-jurisdiction smoke: end-to-end engine evaluation produces BenefitPeriod
# ---------------------------------------------------------------------------


class TestPerJurisdictionSmoke:
    """The Phase D exit gate: each EI demo case (the first one — the canonical
    eligible scenario) must produce a BenefitPeriod + obligation list."""

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_eligible_demo_case_produces_benefit_period(self, loaded_ei_programs, jur: str):
        program = loaded_ei_programs[jur]
        # The first demo case in each manifest is the canonical eligible scenario.
        case = program.demo_cases[0]
        from datetime import date
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE, (
            f"{jur} demo case {case.id} should be eligible; got {rec.outcome}\n"
            f"  flags: {rec.flags}\n  missing: {rec.missing_evidence}\n"
            f"  rule_evaluations: {[(e.rule_id, e.outcome.value) for e in rec.rule_evaluations]}"
        )
        assert rec.benefit_period is not None, (
            f"{jur} eligible demo case should produce a BenefitPeriod"
        )
        assert isinstance(rec.benefit_period, BenefitPeriod)
        assert rec.benefit_period.weeks_total > 0
        assert len(rec.active_obligations) >= 1, (
            f"{jur} eligible demo case should carry at least one ActiveObligation"
        )
        assert rec.program_id == "ei"

    @pytest.mark.parametrize("jur", EI_JURISDICTIONS)
    def test_insufficient_evidence_demo_case(self, loaded_ei_programs, jur: str):
        """The 4th demo case in each manifest is the insufficient-evidence path
        (missing the EI-specific evidence type — ROE / certificado / Bescheinigung / etc)."""
        program = loaded_ei_programs[jur]
        case = program.demo_cases[3]
        from datetime import date
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 29))
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.INSUFFICIENT_EVIDENCE, (
            f"{jur} demo case {case.id} should be insufficient_evidence; "
            f"got {rec.outcome}"
        )
        assert rec.benefit_period is None, (
            f"{jur} insufficient-evidence case should not produce a BenefitPeriod"
        )
        assert rec.active_obligations == [], (
            f"{jur} insufficient-evidence case should carry no obligations"
        )


# ---------------------------------------------------------------------------
# OAS shape unaffected — Phase B + C regression safeguard
# ---------------------------------------------------------------------------


class TestOasUnaffectedByPhaseD:
    """Phase D adds only EI manifests and their substrate values — OAS programs
    must continue to work byte-identically."""

    def test_ca_oas_still_loads(self):
        oas_path = LAWCODE / "ca" / "programs" / "oas.yaml"
        program = load_program_manifest(oas_path)
        assert program.program_id == "oas"
        assert program.shape == "old_age_pension"

    def test_ca_oas_still_evaluates_eligible_full(self):
        oas_path = LAWCODE / "ca" / "programs" / "oas.yaml"
        program = load_program_manifest(oas_path)
        case = next(c for c in program.demo_cases if c.id == "demo-case-001")
        from datetime import date
        engine = ProgramEngine(program=program, evaluation_date=date(2026, 4, 13))
        rec, _ = engine.evaluate(case)
        assert rec.outcome == DecisionOutcome.ELIGIBLE
        assert rec.pension_type == "full"
        # New fields default for OAS shape
        assert rec.benefit_period is None
        assert rec.active_obligations == []
