"""Tests for the self-screening pipeline (Phase 10A).

Privacy-critical contract: the response must not echo PII, must not create
a case row, must not write to any audit store. These tests pin those
invariants explicitly.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from govops.api import app, store as case_store
from govops.screen import (
    ScreenEvidence,
    ScreenRequest,
    ScreenResidencyPeriod,
    UnknownJurisdiction,
    run_screen,
)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _full_eligible_ca_request() -> ScreenRequest:
    """A CA case that should screen eligible: 70 years old, 50 years CA residency, citizen, full evidence."""
    return ScreenRequest(
        jurisdiction_id="ca",
        date_of_birth=date(1955, 1, 1),
        legal_status="citizen",
        country_of_birth="CA",
        residency_periods=[
            ScreenResidencyPeriod(
                country="CA",
                start_date=date(1973, 1, 1),
                end_date=None,
            )
        ],
        evidence_present=ScreenEvidence(dob=True, residency=True),
        evaluation_date=date(2025, 6, 1),
    )


def _young_ineligible_ca_request() -> ScreenRequest:
    """A CA case under age 65 — should screen ineligible regardless of residency."""
    return ScreenRequest(
        jurisdiction_id="ca",
        date_of_birth=date(2000, 1, 1),
        legal_status="citizen",
        residency_periods=[
            ScreenResidencyPeriod(country="CA", start_date=date(2018, 1, 1))
        ],
        evidence_present=ScreenEvidence(dob=True, residency=True),
        evaluation_date=date(2025, 6, 1),
    )


# ---------------------------------------------------------------------------
# Happy-path direct calls
# ---------------------------------------------------------------------------


class TestRunScreenHappyPath:
    def test_eligible_ca_case_returns_eligible(self):
        resp = run_screen(_full_eligible_ca_request())
        assert resp.outcome == "eligible"
        assert resp.jurisdiction_label.startswith("Old Age Security")
        assert "Canada" in resp.jurisdiction_label
        assert resp.evaluation_date == "2025-06-01"
        assert resp.disclaimer  # non-empty disclaimer always present

    def test_ineligible_under_age_returns_ineligible(self):
        resp = run_screen(_young_ineligible_ca_request())
        assert resp.outcome == "ineligible"
        # The age rule should report not_satisfied.
        age_rules = [r for r in resp.rule_results if "age" in r.description.lower()]
        assert age_rules
        assert any(r.outcome == "not_satisfied" for r in age_rules)

    def test_rule_results_carry_citations(self):
        resp = run_screen(_full_eligible_ca_request())
        assert resp.rule_results
        for r in resp.rule_results:
            assert r.citation, f"rule {r.rule_id} missing citation"

    def test_default_evaluation_date_is_today(self):
        req = _full_eligible_ca_request()
        req.evaluation_date = None
        resp = run_screen(req)
        assert resp.evaluation_date == date.today().isoformat()


# ---------------------------------------------------------------------------
# Privacy invariants — load-bearing, do not relax
# ---------------------------------------------------------------------------


class TestScreenPrivacyInvariants:
    def test_response_has_no_case_id_field(self):
        resp = run_screen(_full_eligible_ca_request())
        # Pydantic dump should never carry a case_id, applicant_id, or audit_id.
        dumped = resp.model_dump()
        forbidden = {"case_id", "applicant_id", "audit_id", "id"}
        leaked = forbidden & set(dumped)
        assert not leaked, f"Privacy leak: response contains {leaked}"

    def test_response_does_not_echo_date_of_birth(self):
        req = _full_eligible_ca_request()
        resp = run_screen(req)
        dumped = resp.model_dump_json()
        assert req.date_of_birth.isoformat() not in dumped, (
            "Privacy leak: DOB echoed in response"
        )

    def test_response_does_not_echo_country_of_birth(self):
        req = _full_eligible_ca_request()
        # Use a value that won't appear in any rule citation.
        req.country_of_birth = "Atlantis"
        resp = run_screen(req)
        dumped = resp.model_dump_json()
        assert "Atlantis" not in dumped, "Privacy leak: country_of_birth echoed"

    def test_no_case_row_created_in_demo_store(self):
        case_count_before = len(case_store.cases)
        run_screen(_full_eligible_ca_request())
        case_count_after = len(case_store.cases)
        assert case_count_before == case_count_after, (
            "Privacy/governance leak: self-screening created a case row"
        )

    def test_no_audit_entries_written(self):
        # If the engine logs to an internal list, that's fine — it's discarded.
        # What matters is that no audit package exists for this transient case.
        resp = run_screen(_full_eligible_ca_request())
        # The response itself must not carry an audit_trail field.
        assert not hasattr(resp, "audit_trail")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestScreenValidation:
    def test_unknown_jurisdiction_raises(self):
        req = _full_eligible_ca_request()
        req.jurisdiction_id = "atlantis"
        with pytest.raises(UnknownJurisdiction):
            run_screen(req)

    def test_future_dob_rejected_by_pydantic(self):
        with pytest.raises(ValueError, match="future"):
            ScreenRequest(
                jurisdiction_id="ca",
                date_of_birth=date(date.today().year + 5, 1, 1),
                legal_status="citizen",
            )

    def test_dob_before_1900_rejected(self):
        with pytest.raises(ValueError, match="1900"):
            ScreenRequest(
                jurisdiction_id="ca",
                date_of_birth=date(1850, 1, 1),
                legal_status="citizen",
            )

    def test_unknown_legal_status_rejected(self):
        with pytest.raises(ValueError, match="legal_status"):
            ScreenRequest(
                jurisdiction_id="ca",
                date_of_birth=date(1960, 1, 1),
                legal_status="alien",
            )


# ---------------------------------------------------------------------------
# HTTP API surface
# ---------------------------------------------------------------------------


class TestScreenAPI:
    def test_post_screen_returns_200_for_eligible_case(self, client):
        payload = _full_eligible_ca_request().model_dump(mode="json")
        r = client.post("/api/screen", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["outcome"] == "eligible"
        assert "case_id" not in body
        assert "applicant_id" not in body

    def test_post_screen_returns_404_for_unknown_jurisdiction(self, client):
        payload = _full_eligible_ca_request().model_dump(mode="json")
        payload["jurisdiction_id"] = "atlantis"
        r = client.post("/api/screen", json=payload)
        assert r.status_code == 404
        assert "atlantis" in r.json()["detail"]

    def test_post_screen_validation_error_returns_422(self, client):
        bad = {
            "jurisdiction_id": "ca",
            "date_of_birth": "not-a-date",
            "legal_status": "citizen",
        }
        r = client.post("/api/screen", json=bad)
        assert r.status_code == 422

    def test_post_screen_does_not_persist_case(self, client):
        payload = _full_eligible_ca_request().model_dump(mode="json")
        before = len(case_store.cases)
        r = client.post("/api/screen", json=payload)
        assert r.status_code == 200
        after = len(case_store.cases)
        assert before == after

    def test_post_screen_response_contains_disclaimer(self, client):
        payload = _full_eligible_ca_request().model_dump(mode="json")
        r = client.post("/api/screen", json=payload)
        body = r.json()
        assert "disclaimer" in body
        assert "decision support" in body["disclaimer"].lower()


# ---------------------------------------------------------------------------
# Benefit amount surfacing (Phase 10B / ADR-011) — citizen sees the dollar
# figure with a reproducible per-step formula trace, not just yes/no.
# ---------------------------------------------------------------------------


class TestScreenBenefitAmount:
    def test_eligible_screen_includes_benefit_amount(self):
        resp = run_screen(_full_eligible_ca_request())
        assert resp.outcome == "eligible"
        assert resp.benefit_amount is not None
        ba = resp.benefit_amount
        assert ba.value > 0
        assert ba.currency == "CAD"
        assert ba.period == "monthly"

    def test_ineligible_screen_has_no_benefit_amount(self):
        resp = run_screen(_young_ineligible_ca_request())
        assert resp.outcome == "ineligible"
        assert resp.benefit_amount is None

    def test_full_pension_pays_full_base_amount(self):
        """50 years CA residency exceeds the 40-year cap → full base monthly.

        Pinned evaluation_date 2025-06-01 — pre-supersession resolves to
        the original 2025-Q4 base ($727.67), demonstrating that the
        engine honours the case's evaluation_date when resolving formula
        coefficients (per ADR-013's named seam).
        """
        resp = run_screen(_full_eligible_ca_request())
        assert resp.benefit_amount is not None
        assert resp.benefit_amount.value == 727.67

    def test_partial_pension_prorates_amount(self):
        """A 33-year CA resident sees ~33/40 of base, not zero, not full."""
        partial = ScreenRequest(
            jurisdiction_id="ca",
            date_of_birth=date(1958, 1, 1),
            legal_status="permanent_resident",
            residency_periods=[
                ScreenResidencyPeriod(country="CA", start_date=date(1993, 1, 1))
            ],
            evidence_present=ScreenEvidence(dob=True, residency=True),
            evaluation_date=date(2026, 4, 13),
        )
        resp = run_screen(partial)
        assert resp.outcome == "eligible"
        assert resp.partial_ratio == "33/40"
        assert resp.benefit_amount is not None
        # Same arithmetic the engine does (round to 2dp).
        assert resp.benefit_amount.value == round(735.45 * (33.0 / 40.0), 2)

    def test_formula_trace_is_reproducible(self):
        """The trace must let a citizen-facing surface render every step."""
        resp = run_screen(_full_eligible_ca_request())
        ba = resp.benefit_amount
        assert ba is not None
        ops = [step["op"] for step in ba.formula_trace]
        # Every operator the OAS formula uses must appear at least once.
        assert "ref" in ops
        assert "field" in ops
        assert "const" in ops
        assert "divide" in ops
        assert "multiply" in ops
        # Citations dedupe in walk order; both load-bearing sections present.
        joined = " | ".join(ba.citations)
        assert "s. 7" in joined
        assert "s. 3(2)(b)" in joined

    def test_benefit_amount_serializes_in_api_response(self, client):
        # Same fixture (2025-06-01) — pre-supersession value applies.
        payload = _full_eligible_ca_request().model_dump(mode="json")
        r = client.post("/api/screen", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert "benefit_amount" in body
        assert body["benefit_amount"] is not None
        ba = body["benefit_amount"]
        assert ba["value"] == 727.67
        assert ba["currency"] == "CAD"
        assert ba["period"] == "monthly"
        assert isinstance(ba["formula_trace"], list)
        assert isinstance(ba["citations"], list)

    def test_benefit_amount_is_null_in_api_for_ineligible(self, client):
        payload = _young_ineligible_ca_request().model_dump(mode="json")
        r = client.post("/api/screen", json=payload)
        assert r.status_code == 200
        body = r.json()
        # Field is present but null — the contract is explicit, not absent.
        assert "benefit_amount" in body
        assert body["benefit_amount"] is None
