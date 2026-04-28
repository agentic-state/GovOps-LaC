"""Tests for citizen-facing decision-notice rendering (Phase 10C / ADR-012).

Coverage targets:
  - HTML renders for each outcome: eligible (full), eligible (partial),
    ineligible, insufficient_evidence
  - benefit_amount section appears only when benefit_amount is non-null
  - formula_trace renders one row per step with citation
  - audit event carries the right shape (template_key, template_version,
    sha256, language, rendered_at_utc)
  - sha256 stability: same inputs (with pinned timestamp) → same hash
  - sha256 sensitivity: different language → different hash
  - i18n fallback (FR locale renders FR strings; missing locale falls to EN)
  - missing template raises NoticeRenderError
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from govops.api import app
from govops.notices import NoticeRenderError, render_html
from govops.store import DemoStore


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def fresh_demo_state(client):
    """Each test starts with a clean evaluated full-pension demo case."""
    client.post("/api/cases/demo-case-001/evaluate")
    return "demo-case-001"


PINNED_UTC = "2026-04-27T12:00:00+00:00"


# ---------------------------------------------------------------------------
# Direct rendering — bypass HTTP layer for unit-level coverage
# ---------------------------------------------------------------------------


class TestRenderHtmlDirectly:
    def _build_inputs(self, store: DemoStore, case_id: str):
        case = store.get_case(case_id)
        rec = store.recommendations[case_id]
        jur = store.jurisdictions[case.jurisdiction_id]
        return case, rec, jur

    def test_full_pension_renders_amount_and_trace(self, client, fresh_demo_state):
        from govops.api import store
        case, rec, jur = self._build_inputs(store, fresh_demo_state)
        rendered = render_html(
            case=case,
            recommendation=rec,
            jurisdiction=jur,
            program_name="Old Age Security",
            template_key="global.template.notice.ca-oas-decision",
            language="en",
            evaluation_date="2026-04-27",
            rendered_at_utc=PINNED_UTC,
        )
        html = rendered.html
        assert "<!DOCTYPE html>" in html
        assert 'lang="en"' in html
        # Verdict section reflects ELIGIBLE
        assert "eligible" in html.lower()
        # Amount section present + base monthly figure
        assert "735.45" in html
        assert "CAD" in html
        # Formula trace rendered — operator labels are i18n-translated, so
        # check for their EN values (not the raw op enum strings).
        assert "lookup" in html.lower()      # notice.op.ref EN
        assert "multiply" in html.lower()    # notice.op.multiply EN
        # Citations rendered alongside trace steps
        assert "OAS Act" in html or "Old Age Security Act" in html
        # Disclaimer present (load-bearing)
        assert "decision support" in html.lower() or "official determination" in html.lower()

    def test_ineligible_renders_no_amount_section(self, client):
        from govops.api import store
        client.post("/api/cases/demo-case-002/evaluate")
        case, rec, jur = self._build_inputs(store, "demo-case-002")
        rendered = render_html(
            case=case,
            recommendation=rec,
            jurisdiction=jur,
            program_name="Old Age Security",
            template_key="global.template.notice.ca-oas-decision",
            language="en",
            evaluation_date="2026-04-27",
            rendered_at_utc=PINNED_UTC,
        )
        html = rendered.html
        # Ineligible verdict surfaces; amount heading does not
        assert "ineligible" in html.lower()
        # The amount-heading i18n key is "Projected amount" (EN); not present
        # for ineligible cases because benefit_amount is None.
        assert "Projected amount" not in html

    def test_partial_pension_renders_prorated_amount(self, client):
        from govops.api import store
        client.post("/api/cases/demo-case-003/evaluate")
        case, rec, jur = self._build_inputs(store, "demo-case-003")
        rendered = render_html(
            case=case,
            recommendation=rec,
            jurisdiction=jur,
            program_name="Old Age Security",
            template_key="global.template.notice.ca-oas-decision",
            language="en",
            evaluation_date="2026-04-27",
            rendered_at_utc=PINNED_UTC,
        )
        html = rendered.html
        assert "Partial pension" in html or "partial" in html.lower()
        # The final benefit_amount.value is strictly less than the full base
        # (the base figure 727.67 may still appear in the trace's ref step,
        # but the headline figure must reflect the prorated amount).
        prorated = f"{rec.benefit_amount.value:.2f}"
        assert prorated != "735.45"
        assert prorated in html
        assert "Projected amount" in html

    def test_audit_event_carries_render_metadata(self, client, fresh_demo_state):
        from govops.api import store
        case, rec, jur = self._build_inputs(store, fresh_demo_state)
        rendered = render_html(
            case=case,
            recommendation=rec,
            jurisdiction=jur,
            program_name="Old Age Security",
            template_key="global.template.notice.ca-oas-decision",
            language="en",
            evaluation_date="2026-04-27",
            rendered_at_utc=PINNED_UTC,
        )
        ev = rendered.audit_event
        assert ev.event_type == "notice_generated"
        assert ev.actor == "system:notices"
        assert ev.data["case_id"] == fresh_demo_state
        assert ev.data["template_key"] == "global.template.notice.ca-oas-decision"
        assert ev.data["language"] == "en"
        assert ev.data["sha256"] == rendered.sha256
        assert len(ev.data["sha256"]) == 64  # sha256 hex digest

    def test_sha256_is_stable_with_pinned_timestamp(self, client, fresh_demo_state):
        """Same case + same template + same lang + same rendered_at → same hash."""
        from govops.api import store
        case, rec, jur = self._build_inputs(store, fresh_demo_state)
        kwargs = dict(
            case=case,
            recommendation=rec,
            jurisdiction=jur,
            program_name="Old Age Security",
            template_key="global.template.notice.ca-oas-decision",
            language="en",
            evaluation_date="2026-04-27",
            rendered_at_utc=PINNED_UTC,
        )
        first = render_html(**kwargs)
        second = render_html(**kwargs)
        assert first.sha256 == second.sha256
        assert first.html == second.html

    def test_sha256_changes_with_language(self, client, fresh_demo_state):
        from govops.api import store
        case, rec, jur = self._build_inputs(store, fresh_demo_state)
        en = render_html(
            case=case, recommendation=rec, jurisdiction=jur,
            program_name="Old Age Security",
            template_key="global.template.notice.ca-oas-decision",
            language="en", rendered_at_utc=PINNED_UTC,
        )
        fr = render_html(
            case=case, recommendation=rec, jurisdiction=jur,
            program_name="Old Age Security",
            template_key="global.template.notice.ca-oas-decision",
            language="fr", rendered_at_utc=PINNED_UTC,
        )
        assert en.sha256 != fr.sha256
        assert "Avis de décision" in fr.html  # FR title rendered

    def test_unknown_template_raises_render_error(self, client, fresh_demo_state):
        from govops.api import store
        case, rec, jur = self._build_inputs(store, fresh_demo_state)
        with pytest.raises(NoticeRenderError, match="no template record"):
            render_html(
                case=case, recommendation=rec, jurisdiction=jur,
                program_name="Old Age Security",
                template_key="global.template.notice.atlantis-decision",
                language="en", rendered_at_utc=PINNED_UTC,
            )


# ---------------------------------------------------------------------------
# HTTP endpoint
# ---------------------------------------------------------------------------


class TestNoticeEndpoint:
    def test_get_notice_returns_html_for_evaluated_case(self, client, fresh_demo_state):
        r = client.get(f"/api/cases/{fresh_demo_state}/notice")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/html")
        body = r.text
        assert "<!DOCTYPE html>" in body
        assert "735.45" in body  # full pension figure

    def test_get_notice_carries_sha256_header(self, client, fresh_demo_state):
        r = client.get(f"/api/cases/{fresh_demo_state}/notice")
        sha = r.headers.get("x-notice-sha256")
        assert sha is not None
        assert len(sha) == 64
        # Header sha must match a sha256 of the body bytes
        import hashlib
        assert hashlib.sha256(r.text.encode("utf-8")).hexdigest() == sha

    def test_get_notice_appends_audit_event(self, client, fresh_demo_state):
        # Render once
        client.get(f"/api/cases/{fresh_demo_state}/notice")
        # Inspect the audit trail
        audit = client.get(f"/api/cases/{fresh_demo_state}/audit").json()
        events = [e for e in audit["audit_trail"] if e["event_type"] == "notice_generated"]
        assert len(events) >= 1
        last = events[-1]
        assert last["data"]["case_id"] == fresh_demo_state
        assert last["data"]["template_key"] == "global.template.notice.ca-oas-decision"

    def test_get_notice_lang_param_changes_output(self, client, fresh_demo_state):
        en = client.get(f"/api/cases/{fresh_demo_state}/notice").text
        fr = client.get(f"/api/cases/{fresh_demo_state}/notice", params={"lang": "fr"}).text
        assert en != fr
        assert "Avis de décision" in fr

    def test_notice_404_for_missing_case(self, client):
        r = client.get("/api/cases/nonexistent-case/notice")
        assert r.status_code == 404

    def test_post_screen_notice_renders_for_non_ca_jurisdiction(self, client):
        """The notice template is keyed per jurisdiction slug — BR / ES /
        FR / DE / UA all need rendering paths that don't 404. Generic
        Jinja body shared with CA-OAS at v1.0; the test exercises one
        non-CA jurisdiction to lock the template-key construction."""
        payload = {
            "jurisdiction_id": "br",
            "date_of_birth": "1955-01-01",
            "legal_status": "citizen",
            "country_of_birth": "BR",
            "residency_periods": [
                {"country": "BR", "start_date": "1980-01-01"}
            ],
            "evidence_present": {"dob": True, "residency": True},
            "evaluation_date": "2025-06-01",
        }
        r = client.post("/api/screen/notice", json=payload)
        # Must NOT be 404 (template missing) — must render real HTML.
        assert r.status_code == 200
        body = r.text
        assert "<!DOCTYPE html>" in body
        # Brazilian program name should surface (either via i18n label or
        # the EN fallback in JURISDICTION_REGISTRY).
        assert "INSS" in body or "Aposentadoria" in body or "Brazil" in body

    def test_post_screen_notice_returns_html_for_eligible_request(self, client):
        """POST /api/screen/notice — privacy-equivalent path for citizens
        who came through /screen rather than the officer flow."""
        payload = {
            "jurisdiction_id": "ca",
            "date_of_birth": "1955-01-01",
            "legal_status": "citizen",
            "country_of_birth": "CA",
            "residency_periods": [
                {"country": "CA", "start_date": "1973-01-01", "end_date": None}
            ],
            "evidence_present": {"dob": True, "residency": True},
            "evaluation_date": "2025-06-01",
        }
        r = client.post("/api/screen/notice", json=payload)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/html")
        body = r.text
        assert "<!DOCTYPE html>" in body
        assert "735.45" in body
        assert "X-Notice-Sha256".lower() in [h.lower() for h in r.headers.keys()]

    def test_post_screen_notice_does_not_persist_case(self, client):
        """The screen-notice path must not create case rows or audit events."""
        from govops.api import store
        before_cases = len(store.cases)
        before_audits = sum(len(v) for v in store.audit_trails.values())
        payload = {
            "jurisdiction_id": "ca",
            "date_of_birth": "1955-01-01",
            "legal_status": "citizen",
            "residency_periods": [{"country": "CA", "start_date": "1973-01-01"}],
            "evidence_present": {"dob": True, "residency": True},
            "evaluation_date": "2025-06-01",
        }
        client.post("/api/screen/notice", json=payload)
        after_cases = len(store.cases)
        after_audits = sum(len(v) for v in store.audit_trails.values())
        assert before_cases == after_cases
        assert before_audits == after_audits

    def test_post_screen_notice_carries_no_pii_in_headers(self, client):
        """No applicant-identifying data should leak into response headers."""
        payload = {
            "jurisdiction_id": "ca",
            "date_of_birth": "1955-01-01",
            "legal_status": "citizen",
            "residency_periods": [{"country": "CA", "start_date": "1973-01-01"}],
            "evidence_present": {"dob": True, "residency": True},
        }
        r = client.post("/api/screen/notice", json=payload)
        # The body itself contains the case id — but it's the transient
        # marker, not a uuid that could be cross-referenced.
        assert "transient-screen-render" in r.text
        # Response headers must not include any applicant-identifying field.
        forbidden = {"x-applicant-id", "x-case-id", "x-applicant-name"}
        for h in r.headers.keys():
            assert h.lower() not in forbidden

    def test_notice_400_when_case_not_evaluated(self, client):
        # demo-case-004 is loaded but not evaluated by this fixture
        # We need to craft a case that has no recommendation. Use a fresh
        # case_id that exists in store.cases but has no entry in
        # store.recommendations.
        from govops.api import store
        cases_without_rec = [c for c in store.cases.keys() if c not in store.recommendations]
        if not cases_without_rec:
            # Reset by creating a transient case that won't be evaluated
            from govops.models import Applicant, CaseBundle
            store.cases["test-not-evaluated"] = CaseBundle(
                id="test-not-evaluated",
                jurisdiction_id="jur-ca-federal",
                applicant=Applicant(date_of_birth=date(1960, 1, 1)),
            )
        target = next(c for c in store.cases.keys() if c not in store.recommendations)
        r = client.get(f"/api/cases/{target}/notice")
        assert r.status_code == 400
        assert "evaluat" in r.json()["detail"].lower()
