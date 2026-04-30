"""Phase E — cross-program evaluation API tests (per ADR-018).

PLAN-v3 §Phase E exit gate: one case, one POST, returns per-program
eligibility + warnings if any. The headline test target is *"a case
eligible for both OAS and EI in CA produces both recommendations + the
program-interaction warning."*

These tests exercise the API surface end-to-end via the FastAPI
TestClient — including the lifespan that seeds the default jurisdiction
and registers programs from `lawcode/<jur>/programs/`.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from govops.api import _seed_jurisdiction, app, store
from govops.models import (
    Applicant,
    CaseBundle,
    DecisionOutcome,
    EvidenceItem,
    ResidencyPeriod,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    """TestClient with the default CA jurisdiction seeded — both OAS and EI
    programs are registered automatically because `lawcode/ca/programs/`
    contains both `oas.yaml` and `ei.yaml`.
    """
    with TestClient(app) as c:
        # Force-seed CA — other tests may have switched the jurisdiction
        # before us in the same process.
        _seed_jurisdiction("ca")
        yield c


@pytest.fixture
def dual_eligible_case_id(client):
    """Inject a synthetic case that satisfies both OAS (age 65+, 40+ years
    home residency) and EI (record_of_employment evidence, citizen status,
    home country contribution period).
    """
    today = date.today()
    dob = date(today.year - 67, 5, 15)  # 67 years old → over 65 OAS threshold
    case = CaseBundle(
        id="phase-e-dual-eligible-001",
        jurisdiction_id="jur-ca-federal",
        applicant=Applicant(
            date_of_birth=dob,
            legal_name="Phase E Dual Eligible",
            legal_status="citizen",
            country_of_birth="CA",
        ),
        residency_periods=[
            ResidencyPeriod(
                country="Canada",
                start_date=date(dob.year + 18, 5, 15),  # since age 18
                verified=True,
            )
        ],
        evidence_items=[
            EvidenceItem(
                evidence_type="birth_certificate",
                description="Canadian birth certificate",
                provided=True,
                verified=True,
            ),
            EvidenceItem(
                evidence_type="tax_record",
                description="Recent CRA tax record",
                provided=True,
                verified=True,
            ),
            EvidenceItem(
                evidence_type="record_of_employment",
                description="Record of Employment from former employer",
                provided=True,
                verified=True,
            ),
        ],
    )
    store.cases[case.id] = case
    yield case.id
    # Cleanup so the synthetic case doesn't bleed into adjacent tests
    store.cases.pop(case.id, None)
    store.recommendations.pop(case.id, None)
    store.recommendation_history.pop(case.id, None)
    store.program_recommendations.pop(case.id, None)
    store.program_warnings.pop(case.id, None)


# ---------------------------------------------------------------------------
# Default behaviour — no body, runs all registered programs
# ---------------------------------------------------------------------------


class TestDefaultProgramSelection:
    """When the caller POSTs no body, every program registered for the
    jurisdiction runs (per ADR-018)."""

    def test_default_runs_all_registered_programs_for_ca(self, client):
        r = client.post("/api/cases/demo-case-001/evaluate")
        assert r.status_code == 200
        body = r.json()
        evals = body["program_evaluations"]
        program_ids = {e["program_id"] for e in evals}
        assert program_ids == {"oas", "ei"}, (
            f"CA registers both OAS and EI, expected both to run; got {program_ids}"
        )

    def test_default_back_compat_recommendation_is_oas(self, client):
        """Pre-v3 callers read `recommendation` (singular). When OAS is in
        the program list, that field MUST point at the OAS rec — preserves
        the 30+ tests in test_api.py / test_events.py / test_notices.py
        that assert on OAS-shaped output."""
        r = client.post("/api/cases/demo-case-001/evaluate")
        rec = r.json()["recommendation"]
        assert rec["program_id"] == "oas"
        assert rec["outcome"] == "eligible"
        assert rec["pension_type"] == "full"

    def test_empty_programs_list_treated_as_default(self, client):
        """`programs: []` is a foot-gun if it meant "no programs" — ADR-018
        treats it as "default to all" instead."""
        r = client.post(
            "/api/cases/demo-case-001/evaluate", json={"programs": []}
        )
        assert r.status_code == 200
        evals = r.json()["program_evaluations"]
        program_ids = {e["program_id"] for e in evals}
        assert program_ids == {"oas", "ei"}


# ---------------------------------------------------------------------------
# Explicit program selection
# ---------------------------------------------------------------------------


class TestExplicitProgramSelection:
    def test_oas_only(self, client):
        r = client.post(
            "/api/cases/demo-case-001/evaluate", json={"programs": ["oas"]}
        )
        assert r.status_code == 200
        evals = r.json()["program_evaluations"]
        assert len(evals) == 1
        assert evals[0]["program_id"] == "oas"

    def test_ei_only(self, client):
        r = client.post(
            "/api/cases/demo-case-001/evaluate", json={"programs": ["ei"]}
        )
        assert r.status_code == 200
        evals = r.json()["program_evaluations"]
        assert len(evals) == 1
        assert evals[0]["program_id"] == "ei"

    def test_unknown_program_returns_400(self, client):
        r = client.post(
            "/api/cases/demo-case-001/evaluate",
            json={"programs": ["does-not-exist"]},
        )
        assert r.status_code == 400
        assert "does-not-exist" in r.json()["detail"]

    def test_partially_unknown_program_returns_400(self, client):
        """Mixed valid + invalid still 400s — we don't silently drop the
        bad id and run the rest, since that masks data integrity issues."""
        r = client.post(
            "/api/cases/demo-case-001/evaluate",
            json={"programs": ["oas", "bogus"]},
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# OAS+EI dual eligibility — the headline Phase E exit-gate test target
# ---------------------------------------------------------------------------


class TestDualEligibilityWarning:
    """PLAN-v3 §Phase E test target: a case eligible for both OAS and EI
    in CA produces both recommendations + the program-interaction warning."""

    def test_both_programs_eligible(self, client, dual_eligible_case_id):
        r = client.post(f"/api/cases/{dual_eligible_case_id}/evaluate")
        assert r.status_code == 200
        body = r.json()
        evals = {e["program_id"]: e for e in body["program_evaluations"]}
        assert evals["oas"]["outcome"] == "eligible"
        assert evals["ei"]["outcome"] == "eligible"

    def test_dual_eligibility_emits_interaction_warning(
        self, client, dual_eligible_case_id
    ):
        r = client.post(f"/api/cases/{dual_eligible_case_id}/evaluate")
        warnings = r.json()["warnings"]
        assert len(warnings) == 1
        w = warnings[0]
        assert w["severity"] == "info"
        assert set(w["programs"]) == {"oas", "ei"}
        assert "concurrently" in w["description"].lower() or (
            "independent" in w["description"].lower()
        )

    def test_demo_case_001_does_not_emit_warning(self, client):
        """demo-case-001 (Margaret Chen) is OAS-eligible but EI is
        insufficient_evidence (no record_of_employment) — no dual
        eligibility, so no warning fires."""
        r = client.post("/api/cases/demo-case-001/evaluate")
        assert r.json()["warnings"] == []

    def test_oas_only_run_emits_no_warning(self, client, dual_eligible_case_id):
        """Interaction rules need both programs in the result set; running
        OAS alone never emits the dual-eligibility note even if the case
        would have been EI-eligible too."""
        r = client.post(
            f"/api/cases/{dual_eligible_case_id}/evaluate",
            json={"programs": ["oas"]},
        )
        assert r.json()["warnings"] == []


# ---------------------------------------------------------------------------
# program_id population
# ---------------------------------------------------------------------------


class TestProgramIdPopulation:
    """Every Recommendation produced through the cross-program API carries
    a non-empty `program_id`. v3 consumers route by program_id, not array
    index, so a missing id is a contract violation."""

    def test_every_rec_carries_program_id(self, client):
        r = client.post("/api/cases/demo-case-001/evaluate")
        for rec in r.json()["program_evaluations"]:
            assert rec["program_id"], (
                "program_id missing — cross-program consumers can't route"
            )


# ---------------------------------------------------------------------------
# Audit package extension
# ---------------------------------------------------------------------------


class TestAuditPackageProgramSlots:
    """ADR-018 — `AuditPackage.program_evaluations` exposes per-program
    recs to audit consumers; `program_warnings` exposes interactions."""

    def test_audit_carries_program_evaluations(self, client):
        client.post("/api/cases/demo-case-001/evaluate")
        r = client.get("/api/cases/demo-case-001/audit")
        assert r.status_code == 200
        pkg = r.json()
        assert "program_evaluations" in pkg
        program_ids = {e["program_id"] for e in pkg["program_evaluations"]}
        assert program_ids == {"oas", "ei"}

    def test_audit_carries_program_warnings_field(self, client):
        client.post("/api/cases/demo-case-001/evaluate")
        r = client.get("/api/cases/demo-case-001/audit")
        pkg = r.json()
        assert "program_warnings" in pkg
        assert isinstance(pkg["program_warnings"], list)

    def test_audit_dual_eligibility_warning_present(
        self, client, dual_eligible_case_id
    ):
        client.post(f"/api/cases/{dual_eligible_case_id}/evaluate")
        r = client.get(f"/api/cases/{dual_eligible_case_id}/audit")
        pkg = r.json()
        assert len(pkg["program_warnings"]) == 1
        assert set(pkg["program_warnings"][0]["programs"]) == {"oas", "ei"}


# ---------------------------------------------------------------------------
# JP — architectural control: only OAS registered, EI unknown
# ---------------------------------------------------------------------------


class TestJpExclusion:
    """The charter's architectural-control rule: JP must NOT have an EI
    program registered (no `lawcode/jp/programs/ei.yaml`). Asking for EI
    in JP returns 400."""

    def test_jp_default_runs_only_oas(self, client):
        client.post("/api/jurisdiction/jp")
        r = client.post("/api/cases/demo-jp-001/evaluate")
        assert r.status_code == 200
        evals = r.json()["program_evaluations"]
        assert {e["program_id"] for e in evals} == {"oas"}

    def test_jp_explicit_ei_request_returns_400(self, client):
        client.post("/api/jurisdiction/jp")
        r = client.post(
            "/api/cases/demo-jp-001/evaluate", json={"programs": ["ei"]}
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Per-program supersession — re-evaluating preserves per-program prior
# ---------------------------------------------------------------------------


class TestPerProgramSupersession:
    """Each program's chain is independent: re-evaluating CA OAS+EI twice
    in a row produces a second EI rec whose `supersedes` points at the
    prior EI rec, not at the prior OAS rec."""

    def test_ei_rec_supersedes_prior_ei_rec(self, client):
        r1 = client.post("/api/cases/demo-case-001/evaluate")
        ei_rec_1 = next(
            e for e in r1.json()["program_evaluations"] if e["program_id"] == "ei"
        )
        r2 = client.post("/api/cases/demo-case-001/evaluate")
        ei_rec_2 = next(
            e for e in r2.json()["program_evaluations"] if e["program_id"] == "ei"
        )
        assert ei_rec_2["supersedes"] == ei_rec_1["id"]
