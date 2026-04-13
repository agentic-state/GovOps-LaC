"""Tests for the GovOps API layer."""

import pytest
from fastapi.testclient import TestClient

from govops.api import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestHealthAndMetadata:
    def test_health(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert "available_jurisdictions" in data
        assert len(data["available_jurisdictions"]) == 6

    def test_authority_chain(self, client):
        r = client.get("/api/authority-chain")
        assert r.status_code == 200
        data = r.json()
        assert data["jurisdiction"]["id"] == "jur-ca-federal"
        assert len(data["chain"]) >= 5

    def test_rules(self, client):
        r = client.get("/api/rules")
        assert r.status_code == 200
        rules = r.json()["rules"]
        assert len(rules) >= 4

    def test_legal_documents(self, client):
        r = client.get("/api/legal-documents")
        assert r.status_code == 200
        docs = r.json()["documents"]
        assert any("Old Age Security" in d["title"] for d in docs)


class TestCaseWorkflow:
    def test_list_cases(self, client):
        r = client.get("/api/cases")
        assert r.status_code == 200
        cases = r.json()["cases"]
        assert len(cases) == 4

    def test_get_case(self, client):
        r = client.get("/api/cases/demo-case-001")
        assert r.status_code == 200
        data = r.json()
        assert data["case"]["applicant"]["legal_name"] == "Margaret Chen"

    def test_get_missing_case(self, client):
        r = client.get("/api/cases/nonexistent")
        assert r.status_code == 404

    def test_evaluate_case(self, client):
        r = client.post("/api/cases/demo-case-001/evaluate")
        assert r.status_code == 200
        rec = r.json()["recommendation"]
        assert rec["outcome"] == "eligible"
        assert rec["pension_type"] == "full"

    def test_evaluate_ineligible(self, client):
        r = client.post("/api/cases/demo-case-002/evaluate")
        assert r.status_code == 200
        rec = r.json()["recommendation"]
        assert rec["outcome"] == "ineligible"

    def test_evaluate_partial(self, client):
        r = client.post("/api/cases/demo-case-003/evaluate")
        assert r.status_code == 200
        rec = r.json()["recommendation"]
        assert rec["outcome"] == "eligible"
        assert rec["pension_type"] == "partial"

    def test_evaluate_insufficient_evidence(self, client):
        r = client.post("/api/cases/demo-case-004/evaluate")
        assert r.status_code == 200
        rec = r.json()["recommendation"]
        assert rec["outcome"] == "insufficient_evidence"

    def test_review_case(self, client):
        client.post("/api/cases/demo-case-001/evaluate")
        r = client.post("/api/cases/demo-case-001/review", json={
            "action": "approve",
            "rationale": "All evidence verified.",
        })
        assert r.status_code == 200
        assert r.json()["review"]["action"] == "approve"

    def test_review_without_evaluation(self, client):
        r = client.post("/api/cases/demo-case-002/review", json={
            "action": "approve",
        })
        assert r.status_code == 400

    def test_audit_package(self, client):
        client.post("/api/cases/demo-case-001/evaluate")
        client.post("/api/cases/demo-case-001/review", json={
            "action": "approve",
            "rationale": "Verified",
        })
        r = client.get("/api/cases/demo-case-001/audit")
        assert r.status_code == 200
        pkg = r.json()
        assert pkg["case_id"] == "demo-case-001"
        assert pkg["jurisdiction"]["name"] == "Government of Canada"
        assert len(pkg["authority_chain"]) >= 5
        assert pkg["recommendation"]["outcome"] == "eligible"
        assert len(pkg["review_actions"]) == 1
        assert len(pkg["rules_applied"]) >= 4


class TestMultiJurisdiction:
    def test_switch_to_brazil(self, client):
        r = client.post("/api/jurisdiction/br")
        assert r.status_code == 200
        assert r.json()["jurisdiction"] == "br"
        assert "INSS" in r.json()["program"]
        # Cases should now be Brazilian
        r = client.get("/api/cases")
        cases = r.json()["cases"]
        assert any("demo-br-" in c["id"] for c in cases)

    def test_switch_to_germany(self, client):
        r = client.post("/api/jurisdiction/de")
        assert r.status_code == 200
        # Authority chain should be German
        r = client.get("/api/authority-chain")
        data = r.json()
        assert data["jurisdiction"]["country"] == "DE"
        assert any("Grundgesetz" in ref["title"] for ref in data["chain"])

    def test_switch_to_france(self, client):
        r = client.post("/api/jurisdiction/fr")
        assert r.status_code == 200
        r = client.get("/api/rules")
        rules = r.json()["rules"]
        assert any("64" in r["description"] for r in rules)

    def test_switch_to_spain(self, client):
        r = client.post("/api/jurisdiction/es")
        assert r.status_code == 200
        r = client.get("/api/cases")
        cases = r.json()["cases"]
        assert len(cases) == 4
        assert any("demo-es-" in c["id"] for c in cases)

    def test_switch_to_ukraine(self, client):
        r = client.post("/api/jurisdiction/ua")
        assert r.status_code == 200
        r = client.get("/api/authority-chain")
        data = r.json()
        assert data["jurisdiction"]["country"] == "UA"

    def test_evaluate_brazil_cases(self, client):
        client.post("/api/jurisdiction/br")
        # Case 1: eligible (full)
        r = client.post("/api/cases/demo-br-001/evaluate")
        assert r.status_code == 200
        assert r.json()["recommendation"]["outcome"] == "eligible"
        # Case 2: ineligible (too young)
        r = client.post("/api/cases/demo-br-002/evaluate")
        assert r.status_code == 200
        assert r.json()["recommendation"]["outcome"] == "ineligible"

    def test_evaluate_germany_cases(self, client):
        client.post("/api/jurisdiction/de")
        # Case 1: eligible
        r = client.post("/api/cases/demo-de-001/evaluate")
        assert r.status_code == 200
        assert r.json()["recommendation"]["outcome"] == "eligible"
        # Case 2: ineligible (too young for 67)
        r = client.post("/api/cases/demo-de-002/evaluate")
        assert r.status_code == 200
        assert r.json()["recommendation"]["outcome"] == "ineligible"

    def test_invalid_jurisdiction(self, client):
        r = client.post("/api/jurisdiction/xx")
        assert r.status_code == 400

    def test_switch_back_to_canada(self, client):
        client.post("/api/jurisdiction/de")
        client.post("/api/jurisdiction/ca")
        r = client.get("/api/cases")
        cases = r.json()["cases"]
        assert any("demo-case-" in c["id"] for c in cases)


class TestHTMLRoutes:
    def test_about_page(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert "GovOps" in r.text
        assert "What is GovOps" in r.text
        assert "Brazil" in r.text  # multi-jurisdiction table

    def test_home_page(self, client):
        r = client.get("/cases")
        assert r.status_code == 200
        assert "Margaret Chen" in r.text

    def test_i18n_french(self, client):
        r = client.get("/cases?lang=fr")
        assert r.status_code == 200
        assert "Dossiers" in r.text or "dossiers" in r.text.lower()

    def test_jurisdiction_switch_ui(self, client):
        r = client.post("/switch-jurisdiction", data={"jur_code": "br", "lang": "pt"}, follow_redirects=True)
        assert r.status_code == 200
        assert "Carlos Alberto" in r.text or "Silva" in r.text

    def test_authority_page(self, client):
        r = client.get("/authority")
        assert r.status_code == 200

    def test_case_detail_page(self, client):
        r = client.get("/cases/demo-case-001")
        assert r.status_code == 200
        assert "Margaret Chen" in r.text

    def test_evaluate_via_form(self, client):
        r = client.post("/cases/demo-case-001/evaluate", follow_redirects=True)
        assert r.status_code == 200

    def test_audit_view_page(self, client):
        client.post("/cases/demo-case-001/evaluate")
        r = client.get("/cases/demo-case-001/audit-view")
        assert r.status_code == 200

    def test_admin_page(self, client):
        r = client.get("/admin")
        assert r.status_code == 200
        assert "Glass Window" in r.text
        assert "Formalized Rules" in r.text

    def test_admin_shows_stats(self, client):
        r = client.get("/admin")
        assert r.status_code == 200
        assert "Jurisdictions" in r.text
        assert "Authority Links" in r.text

    def test_encode_page(self, client):
        r = client.get("/encode")
        assert r.status_code == 200
        assert "Encoding Pipeline" in r.text

    def test_encode_manual_ingest(self, client):
        r = client.post("/encode/ingest", data={
            "document_title": "Test Law",
            "document_citation": "Test Act, s. 1",
            "input_text": "Article 1: The minimum age is 65 years.",
            "method": "manual",
            "api_key": "",
        }, follow_redirects=True)
        assert r.status_code == 200
        assert "Test Law" in r.text
        assert "PENDING" in r.text

    def test_encode_review_and_commit(self, client):
        # Create batch
        r = client.post("/encode/ingest", data={
            "document_title": "Test Law 2",
            "document_citation": "Test Act 2",
            "input_text": "Article 1: Age threshold is 60.",
            "method": "manual",
            "api_key": "",
        }, follow_redirects=False)
        assert r.status_code == 303
        # Get the batch ID from redirect URL
        batch_url = r.headers["location"]
        batch_id = batch_url.split("/encode/")[1].split("?")[0]
        # Get the batch review page
        r = client.get(f"/encode/{batch_id}")
        assert r.status_code == 200
        # Find proposal ID in the page
        import re
        proposal_ids = re.findall(r'/review/([a-f0-9]+)', r.text)
        assert len(proposal_ids) > 0
        proposal_id = proposal_ids[0]
        # Approve the proposal
        r = client.post(f"/encode/{batch_id}/review/{proposal_id}", data={
            "status": "approved",
            "notes": "Looks correct",
        }, follow_redirects=True)
        assert r.status_code == 200
        assert "APPROVED" in r.text
        # Commit to engine
        r = client.post(f"/encode/{batch_id}/commit", follow_redirects=True)
        assert r.status_code == 200
