"""Phase G — multi-program citizen check tests.

`POST /api/check` runs every program registered for the jurisdiction
against a citizen-declared fact set and returns per-program eligibility.
Privacy posture identical to `/api/screen`: no case row, no audit, no
PII echoed.

PLAN-v3 §Phase G exit gate: a citizen lands on `/check`, declares facts,
and sees "you may be eligible for OAS and/or EI in CA"; clicking "I just
lost my job" surfaces an EI reassessment with a bounded-duration timeline.
These tests pin the API contract that powers both surfaces.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from govops.api import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _baseline_payload(**overrides):
    """A 67-year-old CA citizen with 49 years of CA residency — eligible
    for OAS by default. Override any field per test."""
    payload = {
        "jurisdiction_id": "ca",
        "date_of_birth": date(date.today().year - 67, 5, 15).isoformat(),
        "legal_status": "citizen",
        "country_of_birth": "CA",
        "residency_periods": [
            {
                "country": "Canada",
                "start_date": date(date.today().year - 49, 5, 15).isoformat(),
            }
        ],
        "evidence_present": {"dob": True, "residency": True, "job_loss": False},
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# Default behaviour — every program in the jurisdiction runs
# ---------------------------------------------------------------------------


class TestDefaultProgramSelection:
    def test_ca_runs_both_oas_and_ei(self, client):
        r = client.post("/api/check", json=_baseline_payload())
        assert r.status_code == 200
        body = r.json()
        program_ids = {p["program_id"] for p in body["programs"]}
        assert program_ids == {"oas", "ei"}, (
            f"CA registers both OAS and EI; got {program_ids}"
        )

    def test_jp_runs_only_oas(self, client):
        """JP is the architectural control — no EI manifest exists, so the
        citizen check returns OAS only. Nothing else."""
        payload = _baseline_payload(jurisdiction_id="jp")
        # JP residency for the contribution-based program
        payload["residency_periods"] = [
            {
                "country": "Japan",
                "start_date": date(date.today().year - 49, 5, 15).isoformat(),
            }
        ]
        payload["country_of_birth"] = "JP"
        r = client.post("/api/check", json=payload)
        assert r.status_code == 200
        body = r.json()
        program_ids = {p["program_id"] for p in body["programs"]}
        assert program_ids == {"oas"}

    def test_response_carries_jurisdiction_label(self, client):
        r = client.post("/api/check", json=_baseline_payload())
        body = r.json()
        assert body["jurisdiction_id"] == "ca"
        assert "Canada" in body["jurisdiction_label"]

    def test_response_carries_disclaimer(self, client):
        r = client.post("/api/check", json=_baseline_payload())
        assert "decision support" in r.json()["disclaimer"].lower()


# ---------------------------------------------------------------------------
# Eligibility outcomes — multi-program citizen ergonomics
# ---------------------------------------------------------------------------


class TestEligibilityOutcomes:
    def test_baseline_oas_eligible_ei_insufficient_evidence(self, client):
        """The baseline payload (no job_loss evidence) is OAS-eligible but
        EI-insufficient — citizen sees a positive OAS result and a clear
        gap for EI."""
        r = client.post("/api/check", json=_baseline_payload())
        body = r.json()
        by_pid = {p["program_id"]: p for p in body["programs"]}
        assert by_pid["oas"]["outcome"] == "eligible"
        assert by_pid["ei"]["outcome"] == "insufficient_evidence"

    def test_job_loss_unlocks_ei_eligibility(self, client):
        """Phase G headline: citizen clicks 'I just lost my job', the
        check re-runs with `job_loss: true`, and EI flips to eligible.
        OAS stays eligible — both can be claimed concurrently."""
        payload = _baseline_payload()
        payload["evidence_present"]["job_loss"] = True
        r = client.post("/api/check", json=payload)
        body = r.json()
        by_pid = {p["program_id"]: p for p in body["programs"]}
        assert by_pid["oas"]["outcome"] == "eligible"
        assert by_pid["ei"]["outcome"] == "eligible"

    def test_ei_eligible_carries_benefit_period(self, client):
        """When EI is eligible, the program result must include a
        BenefitPeriod (start, end, weeks_total, weeks_remaining) so the
        UI can render the bounded-duration timeline (PLAN-v3 §Phase G
        exit-gate visualization)."""
        payload = _baseline_payload()
        payload["evidence_present"]["job_loss"] = True
        r = client.post("/api/check", json=payload)
        body = r.json()
        ei = next(p for p in body["programs"] if p["program_id"] == "ei")
        assert ei["benefit_period"] is not None
        bp = ei["benefit_period"]
        assert bp["weeks_total"] > 0
        assert bp["weeks_remaining"] >= 0
        assert bp["start_date"] and bp["end_date"]

    def test_ei_eligible_carries_active_obligations(self, client):
        payload = _baseline_payload()
        payload["evidence_present"]["job_loss"] = True
        r = client.post("/api/check", json=payload)
        body = r.json()
        ei = next(p for p in body["programs"] if p["program_id"] == "ei")
        assert len(ei["active_obligations"]) >= 1
        assert ei["active_obligations"][0]["citation"]


# ---------------------------------------------------------------------------
# Per-jurisdiction evidence mapping (citizen says "job_loss", engine sees
# the right local term automatically)
# ---------------------------------------------------------------------------


class TestPerJurisdictionEvidenceMapping:
    @pytest.mark.parametrize(
        "jur, country, evidence_term",
        [
            ("ca", "Canada", "record_of_employment"),
            ("de", "Germany", "arbeitsbescheinigung"),
            ("fr", "France", "attestation_employeur"),
            ("ua", "Ukraine", "dovidka_zvilnennia"),
        ],
    )
    def test_job_loss_maps_to_local_evidence_term(
        self, client, jur: str, country: str, evidence_term: str
    ):
        """The citizen never knows the local term — checking 'job_loss'
        unlocks `record_of_employment` for CA, `arbeitsbescheinigung` for
        DE, etc. The proof is that EI flips eligible in every jurisdiction
        with the same checkbox."""
        payload = _baseline_payload(jurisdiction_id=jur)
        payload["country_of_birth"] = country.upper()[:2]
        payload["residency_periods"] = [
            {
                "country": country,
                "start_date": date(date.today().year - 49, 5, 15).isoformat(),
            }
        ]
        payload["evidence_present"]["job_loss"] = True
        r = client.post("/api/check", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        ei = next((p for p in body["programs"] if p["program_id"] == "ei"), None)
        assert ei is not None, f"EI program missing for {jur}"
        assert ei["outcome"] == "eligible", (
            f"{jur} EI should be eligible with job_loss=true; got {ei['outcome']}\n"
            f"  rule_results: {[(r['rule_id'], r['outcome']) for r in ei['rule_results']]}"
        )


# ---------------------------------------------------------------------------
# Explicit programs filter
# ---------------------------------------------------------------------------


class TestExplicitProgramFilter:
    def test_oas_only(self, client):
        payload = _baseline_payload()
        payload["programs"] = ["oas"]
        r = client.post("/api/check", json=payload)
        body = r.json()
        program_ids = [p["program_id"] for p in body["programs"]]
        assert program_ids == ["oas"]

    def test_ei_only(self, client):
        payload = _baseline_payload()
        payload["evidence_present"]["job_loss"] = True
        payload["programs"] = ["ei"]
        r = client.post("/api/check", json=payload)
        body = r.json()
        program_ids = [p["program_id"] for p in body["programs"]]
        assert program_ids == ["ei"]

    def test_unknown_program_returns_400(self, client):
        payload = _baseline_payload()
        payload["programs"] = ["nope"]
        r = client.post("/api/check", json=payload)
        assert r.status_code == 400

    def test_unknown_jurisdiction_returns_404(self, client):
        payload = _baseline_payload(jurisdiction_id="zz")
        r = client.post("/api/check", json=payload)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Privacy posture — no PII echoed, no case row, no audit
# ---------------------------------------------------------------------------


class TestPrivacyPosture:
    def test_response_does_not_echo_dob(self, client):
        payload = _baseline_payload()
        r = client.post("/api/check", json=payload)
        body_text = r.text
        # The synthetic DOB string MUST NOT appear in the response body.
        assert payload["date_of_birth"] not in body_text

    def test_response_carries_no_legal_name_field(self, client):
        r = client.post("/api/check", json=_baseline_payload())
        body_text = r.text
        assert "legal_name" not in body_text

    def test_repeated_calls_do_not_create_cases(self, client):
        """Stateless contract: 5 check calls should not show up as cases
        in the case list."""
        before = client.get("/api/cases").json().get("cases", [])
        for _ in range(5):
            client.post("/api/check", json=_baseline_payload())
        after = client.get("/api/cases").json().get("cases", [])
        assert len(after) == len(before)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestValidation:
    def test_future_dob_returns_422(self, client):
        payload = _baseline_payload()
        payload["date_of_birth"] = date(date.today().year + 1, 1, 1).isoformat()
        r = client.post("/api/check", json=payload)
        assert r.status_code == 422

    def test_unknown_legal_status_returns_422(self, client):
        payload = _baseline_payload(legal_status="alien")
        r = client.post("/api/check", json=payload)
        assert r.status_code == 422
