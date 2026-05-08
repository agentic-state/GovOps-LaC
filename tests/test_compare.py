"""Phase F — cross-jurisdiction comparison endpoint tests.

Endpoint: ``GET /api/programs/{program_id}/compare?jurisdictions=ca,br,...``

PLAN-v3 §Phase F exit gate: ``http://localhost:8080/compare/ei`` renders
the 6-jurisdiction comparison with parameter diffs. The frontend reads
this endpoint; these tests pin the contract so the UI is rendering off
something stable.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from govops.api import _seed_jurisdiction, app


@pytest.fixture
def client():
    with TestClient(app) as c:
        _seed_jurisdiction("ca")
        yield c


# ---------------------------------------------------------------------------
# Default selection — all 7 jurisdictions, EI present in 6, JP excluded
# ---------------------------------------------------------------------------


class TestDefaultSelection:
    def test_default_returns_all_seven_jurisdictions(self, client):
        r = client.get("/api/programs/ei/compare")
        assert r.status_code == 200
        body = r.json()
        codes = [j["code"] for j in body["jurisdictions"]]
        assert codes == ["ca", "br", "es", "fr", "de", "ua", "jp"]

    def test_six_active_jurisdictions_have_ei(self, client):
        r = client.get("/api/programs/ei/compare")
        body = r.json()
        avail = {j["code"]: j["available"] for j in body["jurisdictions"]}
        assert avail["ca"] is True
        assert avail["br"] is True
        assert avail["es"] is True
        assert avail["fr"] is True
        assert avail["de"] is True
        assert avail["ua"] is True

    def test_jp_excluded_with_charter_reason(self, client):
        r = client.get("/api/programs/ei/compare")
        body = r.json()
        jp = next(j for j in body["jurisdictions"] if j["code"] == "jp")
        assert jp["available"] is False
        assert "architectural control" in jp["unavailable_reason"]

    def test_canonical_shape_is_unemployment_insurance(self, client):
        r = client.get("/api/programs/ei/compare")
        assert r.json()["shape"] == "unemployment_insurance"


# ---------------------------------------------------------------------------
# Per-jurisdiction payload — manifest contents flow through verbatim
# ---------------------------------------------------------------------------


class TestPerJurisdictionPayload:
    def test_available_jurisdiction_carries_authority_chain(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca")
        ca = r.json()["jurisdictions"][0]
        assert ca["available"] is True
        assert len(ca["authority_chain"]) >= 4  # constitution + act + program + service

    def test_available_jurisdiction_carries_rules(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca")
        ca = r.json()["jurisdictions"][0]
        rule_ids = {rule["id"] for rule in ca["rules"]}
        # Phase D's canonical EI rule set
        assert "rule-ei-contribution" in rule_ids
        assert "rule-ei-evidence" in rule_ids
        assert "rule-ei-duration" in rule_ids
        assert "rule-ei-job-search" in rule_ids

    def test_label_resolves_from_jurisdiction_registry(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca,fr")
        slots = {j["code"]: j["label"] for j in r.json()["jurisdictions"]}
        assert "Canada" in slots["ca"]
        # French label is "République française" or similar — non-empty + Latin
        assert slots["fr"]


# ---------------------------------------------------------------------------
# Comparison rows — symmetric rule alignment + per-jurisdiction values
# ---------------------------------------------------------------------------


class TestComparisonRows:
    def test_rule_ids_aligned_across_jurisdictions(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca,br,fr,de")
        rule_ids = r.json()["comparison"]["rule_ids"]
        # Phase D guarantees symmetric rule_ids across the 6 active jurisdictions
        for expected in (
            "rule-ei-contribution",
            "rule-ei-legal-status",
            "rule-ei-evidence",
            "rule-ei-duration",
            "rule-ei-job-search",
        ):
            assert expected in rule_ids

    def test_contribution_row_has_min_years_per_jurisdiction(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca,br,fr,de")
        rows = r.json()["comparison"]["rows"]
        contrib = next(row for row in rows if row["rule_id"] == "rule-ei-contribution")
        min_years = contrib["parameters"]["min_years"]
        # Every queried jurisdiction must have a value
        assert set(min_years.keys()) == {"ca", "br", "fr", "de"}
        for v in min_years.values():
            assert isinstance(v, (int, float))

    def test_duration_row_has_weeks_total_per_jurisdiction(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca,br,es,fr,de,ua")
        rows = r.json()["comparison"]["rows"]
        duration = next(row for row in rows if row["rule_id"] == "rule-ei-duration")
        weeks = duration["parameters"]["weeks_total"]
        # All 6 active jurisdictions should have a positive integer weeks_total
        assert set(weeks.keys()) == {"ca", "br", "es", "fr", "de", "ua"}
        for v in weeks.values():
            assert isinstance(v, int) and v > 0

    def test_citations_present_per_jurisdiction(self, client):
        """Every value in the comparison table is auditable — each row
        carries the source citation per jurisdiction so the UI can trace
        any cell back to the statute that backs it."""
        r = client.get("/api/programs/ei/compare?jurisdictions=ca,br,de")
        rows = r.json()["comparison"]["rows"]
        for row in rows:
            cits = row["citation_per_jurisdiction"]
            assert "ca" in cits and cits["ca"]
            assert "br" in cits and cits["br"]
            assert "de" in cits and cits["de"]

    def test_jp_does_not_appear_in_comparison_rows(self, client):
        """JP has no EI manifest; comparison rows MUST NOT show a value
        for it (the architectural control would otherwise leak into the
        side-by-side surface)."""
        r = client.get("/api/programs/ei/compare")
        rows = r.json()["comparison"]["rows"]
        for row in rows:
            for param_values in row["parameters"].values():
                assert "jp" not in param_values


# ---------------------------------------------------------------------------
# Filtered queries
# ---------------------------------------------------------------------------


class TestFilteredQueries:
    def test_only_one_jurisdiction(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca")
        body = r.json()
        assert len(body["jurisdictions"]) == 1
        assert body["jurisdictions"][0]["code"] == "ca"

    def test_two_jurisdictions(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca,fr")
        body = r.json()
        codes = [j["code"] for j in body["jurisdictions"]]
        assert codes == ["ca", "fr"]

    def test_unknown_jurisdiction_code_returns_400(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=ca,zz")
        assert r.status_code == 400
        assert "zz" in r.json()["detail"]

    def test_empty_jurisdictions_param_falls_back_to_default(self, client):
        r = client.get("/api/programs/ei/compare?jurisdictions=")
        codes = [j["code"] for j in r.json()["jurisdictions"]]
        assert codes == ["ca", "br", "es", "fr", "de", "ua", "jp"]


# ---------------------------------------------------------------------------
# Unknown program — every jurisdiction lacks a manifest
# ---------------------------------------------------------------------------


class TestUnknownProgram:
    def test_unknown_program_returns_200_with_all_unavailable(self, client):
        """An unknown program is not a 404 — the comparison surface still
        lists every jurisdiction with `available: false`. Treats "the
        program isn't authored anywhere yet" as a real query result, not
        a client error."""
        r = client.get("/api/programs/does-not-exist/compare?jurisdictions=ca,fr")
        assert r.status_code == 200
        body = r.json()
        assert all(not j["available"] for j in body["jurisdictions"])
        assert body["comparison"]["rule_ids"] == []
        assert body["shape"] is None
