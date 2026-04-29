"""Tests for v3 program manifest loader (Phase A Do).

The Phase A exit gate is byte-identical parity between the seed.py-built CA
OAS objects and the manifest-loaded ones. These tests assert that gate.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from govops import seed
from govops.engine import ProgramEngine
from govops.models import RuleType
from govops.programs import (
    Program,
    ProgramManifestError,
    discover_program_manifests,
    load_program_manifest,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
LAWCODE = REPO_ROOT / "lawcode"
SCHEMA_PATH = REPO_ROOT / "schema" / "program-manifest-v1.0.json"
CA_OAS_MANIFEST = LAWCODE / "ca" / "programs" / "oas.yaml"


# ---------------------------------------------------------------------------
# Loader basics
# ---------------------------------------------------------------------------


class TestManifestLoad:
    def test_ca_oas_manifest_exists(self):
        assert CA_OAS_MANIFEST.exists(), f"Expected manifest at {CA_OAS_MANIFEST}"

    def test_load_returns_program(self):
        program = load_program_manifest(CA_OAS_MANIFEST)
        assert isinstance(program, Program)
        assert program.program_id == "oas"
        assert program.shape == "old_age_pension"
        assert program.jurisdiction_id == "jur-ca-federal"
        assert program.status == "active"
        assert program.name["en"] == "Old Age Security"
        assert program.name["fr"] == "Sécurité de la vieillesse"

    def test_load_missing_path_raises(self):
        with pytest.raises(ProgramManifestError):
            load_program_manifest("/nonexistent/path-that-does-not-exist.yaml")

    def test_load_malformed_top_level_raises(self, tmp_path: Path):
        bad = tmp_path / "bad.yaml"
        bad.write_text("- not a mapping\n", encoding="utf-8")
        with pytest.raises(ProgramManifestError):
            load_program_manifest(bad)

    def test_load_missing_required_field_raises(self, tmp_path: Path):
        bad = tmp_path / "bad.yaml"
        bad.write_text(
            "schema_version: '1.0'\nprogram_id: ei\njurisdiction_id: ca\n"
            "shape: unemployment_insurance\n",  # rules: missing
            encoding="utf-8",
        )
        with pytest.raises(ProgramManifestError, match="rules"):
            load_program_manifest(bad)


# ---------------------------------------------------------------------------
# Round-trip parity with seed.py — Phase A exit gate
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def loaded_program() -> Program:
    return load_program_manifest(CA_OAS_MANIFEST)


class TestRoundTripParityWithSeed:
    """The Phase A exit gate: manifest-loaded objects must equal seed.py-built objects."""

    def test_authority_chain_matches_seed(self, loaded_program: Program):
        loaded_dump = [a.model_dump() for a in loaded_program.authority_chain]
        seed_dump = [a.model_dump() for a in seed.AUTHORITY_CHAIN]
        assert loaded_dump == seed_dump

    def test_legal_documents_match_seed(self, loaded_program: Program):
        loaded_dump = [d.model_dump() for d in loaded_program.legal_documents]
        seed_dump = [d.model_dump() for d in seed.LEGAL_DOCUMENTS]
        assert loaded_dump == seed_dump

    def test_rules_match_seed(self, loaded_program: Program):
        loaded_rules = {r.id: r for r in loaded_program.rules}
        seed_rules = {r.id: r for r in seed.OAS_RULES}
        assert set(loaded_rules.keys()) == set(seed_rules.keys()), (
            "Rule id sets diverged between manifest and seed"
        )
        for rid, lr in loaded_rules.items():
            sr = seed_rules[rid]
            assert lr.model_dump() == sr.model_dump(), (
                f"Rule {rid} mismatch:\n  loaded={lr.model_dump()}\n  seed={sr.model_dump()}"
            )

    def test_demo_cases_match_seed(self, loaded_program: Program):
        loaded_cases = {c.id: c for c in loaded_program.demo_cases}
        seed_cases = {c.id: c for c in seed.make_demo_cases()}
        assert set(loaded_cases.keys()) == set(seed_cases.keys())
        for cid, lc in loaded_cases.items():
            sc = seed_cases[cid]
            ld = lc.model_dump()
            sd = sc.model_dump()
            # CaseBundle.created_at uses default_factory=_utcnow — auto-set per
            # construction, will differ between the two objects. Strip before
            # comparison; it's not part of the structural identity.
            ld.pop("created_at", None)
            sd.pop("created_at", None)
            assert ld == sd, (
                f"Demo case {cid} mismatch:\n  loaded={ld}\n  seed={sd}"
            )


# ---------------------------------------------------------------------------
# Substrate ref + include resolution
# ---------------------------------------------------------------------------


class TestParameterResolution:
    def test_substrate_refs_resolved_to_values(self, loaded_program: Program):
        """A {ref: '<key>'} in the manifest must resolve to the substrate value."""
        age_rule = next(r for r in loaded_program.rules if r.id == "rule-age-65")
        assert age_rule.parameters["min_age"] == 65
        assert age_rule.param_key_prefix == "ca.rule.age-65"

    def test_residency_home_countries_list_resolved(self, loaded_program: Program):
        rule = next(r for r in loaded_program.rules if r.id == "rule-residency-10")
        assert rule.parameters["min_years"] == 10
        assert "CA" in rule.parameters["home_countries"]

    def test_calc_rule_formula_loaded_via_include(self, loaded_program: Program):
        calc = next(
            r for r in loaded_program.rules if r.rule_type == RuleType.CALCULATION
        )
        formula = calc.parameters["formula"]
        assert isinstance(formula, dict)
        assert formula["op"] == "multiply"
        # First arg must be a ref node pointing at the dated coefficient.
        assert formula["args"][0]["op"] == "ref"
        assert formula["args"][0]["ref_key"] == "ca.calc.oas.base_monthly_amount"
        # Second arg is the divide(eligible_years, 40) sub-tree.
        assert formula["args"][1]["op"] == "divide"

    def test_calc_rule_formula_matches_seed(self, loaded_program: Program):
        loaded_calc = next(
            r for r in loaded_program.rules if r.rule_type == RuleType.CALCULATION
        )
        seed_calc = next(
            r for r in seed.OAS_RULES if r.rule_type == RuleType.CALCULATION
        )
        assert loaded_calc.parameters["formula"] == seed_calc.parameters["formula"]


# ---------------------------------------------------------------------------
# Engine equivalence
# ---------------------------------------------------------------------------


class TestEngineEquivalence:
    """Engine produces identical recommendations against manifest-loaded vs. seed.py rules."""

    def test_demo_case_001_full_pension(self, loaded_program: Program):
        loaded_case = next(
            c for c in loaded_program.demo_cases if c.id == "demo-case-001"
        )
        seed_case = next(
            c for c in seed.make_demo_cases() if c.id == "demo-case-001"
        )
        loaded_rec, _ = ProgramEngine(rules=loaded_program.rules).evaluate(loaded_case)
        seed_rec, _ = ProgramEngine(rules=seed.OAS_RULES).evaluate(seed_case)
        assert loaded_rec.outcome == seed_rec.outcome
        assert loaded_rec.pension_type == seed_rec.pension_type
        assert loaded_rec.partial_ratio == seed_rec.partial_ratio
        assert loaded_rec.missing_evidence == seed_rec.missing_evidence
        assert loaded_rec.flags == seed_rec.flags

    def test_all_demo_cases_engine_match(self, loaded_program: Program):
        seed_cases = {c.id: c for c in seed.make_demo_cases()}
        for case in loaded_program.demo_cases:
            sc = seed_cases[case.id]
            lr, _ = ProgramEngine(rules=loaded_program.rules).evaluate(case)
            sr, _ = ProgramEngine(rules=seed.OAS_RULES).evaluate(sc)
            assert lr.outcome == sr.outcome, f"Outcome mismatch for {case.id}"
            assert lr.pension_type == sr.pension_type, (
                f"pension_type mismatch for {case.id}: "
                f"loaded={lr.pension_type!r} seed={sr.pension_type!r}"
            )
            assert lr.partial_ratio == sr.partial_ratio, (
                f"partial_ratio mismatch for {case.id}"
            )

    def test_benefit_amount_matches_seed(self, loaded_program: Program):
        """The eligible-full case (demo-case-001) produces a BenefitAmount via the
        formula AST. Loaded and seed paths must produce the same monthly value
        and citation list (modulo trace step ids)."""
        loaded_case = next(
            c for c in loaded_program.demo_cases if c.id == "demo-case-001"
        )
        seed_case = next(
            c for c in seed.make_demo_cases() if c.id == "demo-case-001"
        )
        loaded_rec, _ = ProgramEngine(rules=loaded_program.rules).evaluate(loaded_case)
        seed_rec, _ = ProgramEngine(rules=seed.OAS_RULES).evaluate(seed_case)
        assert loaded_rec.benefit_amount is not None
        assert seed_rec.benefit_amount is not None
        assert loaded_rec.benefit_amount.value == seed_rec.benefit_amount.value
        assert loaded_rec.benefit_amount.currency == seed_rec.benefit_amount.currency
        assert loaded_rec.benefit_amount.period == seed_rec.benefit_amount.period
        assert loaded_rec.benefit_amount.citations == seed_rec.benefit_amount.citations


# ---------------------------------------------------------------------------
# JSON Schema validation
# ---------------------------------------------------------------------------


class TestSchemaValidation:
    """Walk lawcode/*/programs/*.yaml and validate against program-manifest-v1.0.json."""

    @pytest.fixture(scope="class")
    def schema(self) -> dict:
        with SCHEMA_PATH.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    def test_schema_is_loadable(self, schema: dict):
        assert schema["title"] == "Program manifest v1.0"

    def test_all_program_manifests_validate(self, schema: dict):
        import jsonschema

        manifests = discover_program_manifests(LAWCODE)
        assert len(manifests) >= 1, "Expected at least one program manifest"
        for path in manifests:
            with path.open("r", encoding="utf-8") as fh:
                data = yaml.safe_load(fh)
            # Round-trip through JSON to normalize PyYAML's native date/datetime
            # objects into ISO-8601 strings — JSON has no native date type, so
            # JSON Schema's `format: date` expects strings. This mirrors how
            # the v2 lawcode-v1.0 schema gate runs in CI.
            normalized = json.loads(json.dumps(data, default=str))
            try:
                jsonschema.validate(normalized, schema)
            except jsonschema.ValidationError as exc:
                pytest.fail(f"{path}: {exc.message}\n  path: {list(exc.path)}")

    def test_discover_finds_ca_oas(self):
        manifests = discover_program_manifests(LAWCODE)
        rels = [
            str(p.relative_to(LAWCODE)).replace("\\", "/") for p in manifests
        ]
        assert "ca/programs/oas.yaml" in rels

    def test_discover_excludes_formula_includes(self):
        """formulas/ subdirs hold sibling-relative includes, not manifests."""
        manifests = discover_program_manifests(LAWCODE)
        rels = [
            str(p.relative_to(LAWCODE)).replace("\\", "/") for p in manifests
        ]
        assert not any("formulas" in r for r in rels), (
            "discover_program_manifests should not return files under formulas/"
        )

    def test_discover_skips_underscore_drafts(self, tmp_path: Path):
        """Files starting with _ are draft/work-in-progress and excluded."""
        # Synthesize a fake lawcode tree with a draft manifest.
        fake_lawcode = tmp_path / "lawcode"
        (fake_lawcode / "ca" / "programs").mkdir(parents=True)
        (fake_lawcode / "ca" / "programs" / "_wip-ei.yaml").write_text(
            "schema_version: '1.0'\nprogram_id: ei\njurisdiction_id: ca\n"
            "shape: unemployment_insurance\nrules: []\n",
            encoding="utf-8",
        )
        manifests = discover_program_manifests(fake_lawcode)
        assert manifests == [], "Draft manifests should be excluded"
