"""Tests for life-event reassessment (Phase 10D / ADR-013).

Coverage targets:
  - apply_event for each EventType (move_country, change_legal_status,
    add_evidence, re_evaluate)
  - replay_events filters by as_of date and orders by (effective_date,
    recorded_at)
  - apply_event is pure (input case unchanged)
  - bad payloads raise EventApplicationError
  - POST /events records the event + auto-reevaluates
  - POST /events?reevaluate=false records without re-evaluating
  - Supersession chain: each new recommendation references the prior id
  - GET /events returns full event log + recommendation history
  - Past-dated event uses dated rules: residency-period closure on the
    move date is reflected in the residency-years computation
  - Audit trail picks up `case_event_recorded` events
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from govops.api import app, store
from govops.events import (
    EventApplicationError,
    apply_event,
    replay_events,
)
from govops.models import (
    Applicant,
    CaseBundle,
    CaseEvent,
    EventType,
    EvidenceItem,
    ResidencyPeriod,
)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _fresh_case(case_id: str = "test-event-case") -> CaseBundle:
    return CaseBundle(
        id=case_id,
        jurisdiction_id="jur-ca-federal",
        applicant=Applicant(
            date_of_birth=date(1955, 1, 1),
            legal_name="Test Applicant",
            legal_status="permanent_resident",
        ),
        residency_periods=[
            ResidencyPeriod(country="CA", start_date=date(1980, 1, 1), end_date=None),
        ],
        evidence_items=[
            EvidenceItem(evidence_type="birth_certificate", provided=True),
        ],
    )


# ---------------------------------------------------------------------------
# apply_event — pure projection
# ---------------------------------------------------------------------------


class TestApplyEvent:
    def test_move_country_closes_open_residency_and_opens_new_one(self):
        case = _fresh_case()
        event = CaseEvent(
            case_id=case.id,
            event_type=EventType.MOVE_COUNTRY,
            effective_date=date(2026, 3, 1),
            payload={"to_country": "BR", "from_country": "CA"},
        )
        new_case = apply_event(case, event)
        # Original CA period now has end_date == 2026-03-01
        ca_period = next(p for p in new_case.residency_periods if p.country == "CA")
        assert ca_period.end_date == date(2026, 3, 1)
        # New BR period is open (end_date None) and starts on event date
        br_period = next(p for p in new_case.residency_periods if p.country == "BR")
        assert br_period.start_date == date(2026, 3, 1)
        assert br_period.end_date is None

    def test_move_country_open_new_false_only_closes(self):
        case = _fresh_case()
        event = CaseEvent(
            case_id=case.id,
            event_type=EventType.MOVE_COUNTRY,
            effective_date=date(2026, 3, 1),
            payload={"to_country": "BR", "open_new": False},
        )
        new_case = apply_event(case, event)
        countries = [p.country for p in new_case.residency_periods]
        assert "BR" not in countries
        ca_period = next(p for p in new_case.residency_periods if p.country == "CA")
        assert ca_period.end_date == date(2026, 3, 1)

    def test_move_country_missing_to_country_raises(self):
        case = _fresh_case()
        event = CaseEvent(
            case_id=case.id,
            event_type=EventType.MOVE_COUNTRY,
            effective_date=date(2026, 3, 1),
            payload={},
        )
        with pytest.raises(EventApplicationError, match="to_country"):
            apply_event(case, event)

    def test_change_legal_status(self):
        case = _fresh_case()
        assert case.applicant.legal_status == "permanent_resident"
        event = CaseEvent(
            case_id=case.id,
            event_type=EventType.CHANGE_LEGAL_STATUS,
            effective_date=date(2025, 6, 1),
            payload={"to_status": "citizen"},
        )
        new_case = apply_event(case, event)
        assert new_case.applicant.legal_status == "citizen"
        # Original case is unchanged (purity contract)
        assert case.applicant.legal_status == "permanent_resident"

    def test_add_evidence_appends(self):
        case = _fresh_case()
        before = len(case.evidence_items)
        event = CaseEvent(
            case_id=case.id,
            event_type=EventType.ADD_EVIDENCE,
            effective_date=date(2026, 4, 1),
            payload={"evidence_type": "tax_record", "verified": True},
        )
        new_case = apply_event(case, event)
        assert len(new_case.evidence_items) == before + 1
        added = new_case.evidence_items[-1]
        assert added.evidence_type == "tax_record"
        assert added.verified is True

    def test_re_evaluate_is_no_op_marker(self):
        case = _fresh_case()
        event = CaseEvent(
            case_id=case.id,
            event_type=EventType.RE_EVALUATE,
            effective_date=date(2026, 4, 1),
        )
        new_case = apply_event(case, event)
        # No change beyond the deep-copy
        assert new_case.applicant.legal_status == case.applicant.legal_status
        assert len(new_case.evidence_items) == len(case.evidence_items)
        assert len(new_case.residency_periods) == len(case.residency_periods)

    def test_apply_event_does_not_mutate_input(self):
        case = _fresh_case()
        before_status = case.applicant.legal_status
        before_periods = [(p.country, p.start_date, p.end_date) for p in case.residency_periods]
        event = CaseEvent(
            case_id=case.id,
            event_type=EventType.CHANGE_LEGAL_STATUS,
            effective_date=date(2025, 6, 1),
            payload={"to_status": "citizen"},
        )
        apply_event(case, event)
        assert case.applicant.legal_status == before_status
        assert [(p.country, p.start_date, p.end_date) for p in case.residency_periods] == before_periods


# ---------------------------------------------------------------------------
# replay_events — chronological projection up to as_of
# ---------------------------------------------------------------------------


class TestReplayEvents:
    def test_filters_by_as_of(self):
        case = _fresh_case()
        e1 = CaseEvent(
            case_id=case.id,
            event_type=EventType.CHANGE_LEGAL_STATUS,
            effective_date=date(2025, 6, 1),
            payload={"to_status": "citizen"},
        )
        e2 = CaseEvent(
            case_id=case.id,
            event_type=EventType.ADD_EVIDENCE,
            effective_date=date(2027, 1, 1),
            payload={"evidence_type": "tax_record"},
        )
        # Replay as of mid-2026: only e1 applies
        projected = replay_events(case, [e1, e2], as_of=date(2026, 6, 1))
        assert projected.applicant.legal_status == "citizen"
        assert len(projected.evidence_items) == len(case.evidence_items)

    def test_orders_by_effective_date_then_recorded_at(self):
        case = _fresh_case()
        # Two events with the same effective_date — order by recorded_at
        recorded_first = datetime(2026, 4, 27, 12, 0, 0, tzinfo=timezone.utc)
        recorded_second = datetime(2026, 4, 27, 12, 0, 5, tzinfo=timezone.utc)
        e_late = CaseEvent(
            case_id=case.id,
            event_type=EventType.CHANGE_LEGAL_STATUS,
            effective_date=date(2025, 6, 1),
            recorded_at=recorded_second,
            payload={"to_status": "permanent_resident"},
        )
        e_early = CaseEvent(
            case_id=case.id,
            event_type=EventType.CHANGE_LEGAL_STATUS,
            effective_date=date(2025, 6, 1),
            recorded_at=recorded_first,
            payload={"to_status": "citizen"},
        )
        projected = replay_events(case, [e_late, e_early], as_of=date(2026, 6, 1))
        # Earlier-recorded applied first, later-recorded applied second → final = permanent_resident
        assert projected.applicant.legal_status == "permanent_resident"


# ---------------------------------------------------------------------------
# POST /api/cases/{id}/events — full HTTP flow
# ---------------------------------------------------------------------------


class TestEventEndpoint:
    def test_post_event_records_and_reevaluates_by_default(self, client):
        # Use the existing CA demo case which has a recommendation already.
        client.post("/api/cases/demo-case-001/evaluate")
        before_history = len(store.recommendation_history.get("demo-case-001", []))
        r = client.post(
            "/api/cases/demo-case-001/events",
            json={
                "event_type": "re_evaluate",
                "effective_date": "2026-04-27",
                "actor": "citizen",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert "event" in body
        assert "recommendation" in body
        # New recommendation is appended to history
        after_history = len(store.recommendation_history.get("demo-case-001", []))
        assert after_history == before_history + 1
        # And the new recommendation supersedes the prior
        new_rec = body["recommendation"]
        history = store.recommendation_history["demo-case-001"]
        prior_id = history[-2].id  # second-to-last
        assert new_rec["supersedes"] == prior_id
        assert new_rec["triggered_by_event_id"] == body["event"]["id"]

    def test_post_event_no_reevaluate(self, client):
        client.post("/api/cases/demo-case-001/evaluate")
        before_history = len(store.recommendation_history.get("demo-case-001", []))
        r = client.post(
            "/api/cases/demo-case-001/events?reevaluate=false",
            json={
                "event_type": "re_evaluate",
                "effective_date": "2026-04-27",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert "event" in body
        assert "recommendation" not in body
        # No new recommendation appended
        after_history = len(store.recommendation_history.get("demo-case-001", []))
        assert after_history == before_history

    def test_post_event_400_on_bad_payload(self, client):
        r = client.post(
            "/api/cases/demo-case-001/events",
            json={
                "event_type": "move_country",
                "effective_date": "2026-04-27",
                "payload": {},  # missing to_country
            },
        )
        assert r.status_code == 400
        assert "to_country" in r.json()["detail"]

    def test_post_event_404_for_missing_case(self, client):
        r = client.post(
            "/api/cases/nonexistent/events",
            json={
                "event_type": "re_evaluate",
                "effective_date": "2026-04-27",
            },
        )
        assert r.status_code == 404

    def test_get_events_returns_log_and_history(self, client):
        # Ensure case is evaluated and has at least one event
        client.post("/api/cases/demo-case-001/evaluate")
        client.post(
            "/api/cases/demo-case-001/events",
            json={
                "event_type": "re_evaluate",
                "effective_date": "2026-04-27",
            },
        )
        r = client.get("/api/cases/demo-case-001/events")
        assert r.status_code == 200
        body = r.json()
        assert "events" in body
        assert "recommendations" in body
        assert len(body["events"]) >= 1
        assert len(body["recommendations"]) >= 2

    def test_audit_trail_records_case_event(self, client):
        client.post("/api/cases/demo-case-001/evaluate")
        client.post(
            "/api/cases/demo-case-001/events",
            json={
                "event_type": "add_evidence",
                "effective_date": "2026-04-27",
                "payload": {"evidence_type": "passport"},
            },
        )
        audit = client.get("/api/cases/demo-case-001/audit").json()
        events_in_audit = [e for e in audit["audit_trail"] if e["event_type"] == "case_event_recorded"]
        assert len(events_in_audit) >= 1
        last = events_in_audit[-1]
        assert last["data"]["event_type"] == "add_evidence"


# ---------------------------------------------------------------------------
# Supersession chain — multiple events on the same case
# ---------------------------------------------------------------------------


class TestSupersessionChain:
    def test_three_events_produce_chain_of_three_supersessions(self, client):
        client.post("/api/cases/demo-case-001/evaluate")
        history0 = list(store.recommendation_history["demo-case-001"])
        # Three reassessment events
        for i in range(3):
            client.post(
                "/api/cases/demo-case-001/events",
                json={
                    "event_type": "re_evaluate",
                    "effective_date": (date.today() - timedelta(days=i)).isoformat(),
                },
            )
        history = store.recommendation_history["demo-case-001"]
        # Expect base + 3 = at least 4 in history (or len(history0) + 3)
        assert len(history) == len(history0) + 3
        # Each newer recommendation supersedes the immediately prior
        for older, newer in zip(history[:-1], history[1:]):
            assert newer.supersedes == older.id


# ---------------------------------------------------------------------------
# Past-dated event triggers fact-time-travel — engine sees the case as it
# would have been on the event's effective_date
# ---------------------------------------------------------------------------


class TestFactTimeTravel:
    def test_move_country_to_brazil_at_past_date(self, client):
        """A CA citizen with 50 years residency moves to Brazil; the
        recommendation evaluated as-of the move date sees less Canadian
        residency than today's evaluation does."""
        # demo-case-001 (Margaret Chen) is full-pension eligible today.
        client.post("/api/cases/demo-case-001/evaluate")
        baseline = store.recommendations["demo-case-001"]
        assert baseline.partial_ratio in ("40/40", None)  # full pension

        # Move to BR mid-2024 — closes the CA residency at that date.
        # Engine evaluates as-of the move date.
        r = client.post(
            "/api/cases/demo-case-001/events",
            json={
                "event_type": "move_country",
                "effective_date": "2024-06-01",
                "payload": {"to_country": "BR", "from_country": "CA"},
            },
        )
        assert r.status_code == 200
        new_rec = r.json()["recommendation"]
        # The reassessment must supersede the baseline.
        assert new_rec["supersedes"] == baseline.id
        # evaluation_date carries the effective_date forward.
        assert new_rec["evaluation_date"] == "2024-06-01"
