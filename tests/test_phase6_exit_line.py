"""Phase 6 exit-line E2E test.

Per [PLAN.md §Phase 6](../PLAN.md):

    > a maintainer can change `ca-oas.rule.age-65.min_age` from 65 to 67
    > effective 2027-01-01 entirely through the UI, and a case evaluated
    > on 2027-01-02 picks up the new value

This is the literal acceptance criterion. The test:
1. Seeds the original 65-effective-1985 record (the "today" value)
2. POSTs a new draft ConfigValue with value=67, effective_from=2027-01-01
3. POSTs /approve to flip status to APPROVED
4. Verifies /resolve returns 65 for an evaluation_date in 2026
5. Verifies /resolve returns 67 for an evaluation_date in 2027

A second test exercises persistence across "process restart" (drop the engine,
recreate against the same SQLite file, verify state survives) — proving the
configure-without-deploy promise per ADR-010.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from govops.api import app, config_store
from govops.config import ApprovalStatus, ConfigStore, ConfigValue, ValueType


UTC = timezone.utc


@pytest.fixture
def client():
    config_store.clear()
    # Seed the "today" value: the existing 1985 minimum age.
    config_store.put(
        ConfigValue(
            domain="rule",
            key="ca-oas.rule.age-65.min_age",
            jurisdiction_id="ca-oas",
            value=65,
            value_type=ValueType.NUMBER,
            effective_from=datetime(1985, 1, 1, tzinfo=UTC),
            citation="OAS Act, R.S.C. 1985, c. O-9, s. 3(1)",
            author="seed",
            approved_by="seed",
            rationale="Original statutory minimum age.",
        )
    )
    with TestClient(app) as c:
        yield c
    config_store.clear()


def test_phase6_exit_line_admin_changes_min_age(client):
    """The literal Phase 6 exit-line scenario, end to end through the API."""
    # 1. Maintainer drafts the new value via the admin UI write endpoint.
    create_resp = client.post(
        "/api/config/values",
        json={
            "domain": "rule",
            "key": "ca-oas.rule.age-65.min_age",
            "jurisdiction_id": "ca-oas",
            "value": 67,
            "value_type": "number",
            "effective_from": "2027-01-01T00:00:00+00:00",
            "effective_to": None,
            "citation": "Hypothetical 2027 OAS amendment",
            "author": "policy-author",
            "rationale": "Phase 6 exit-line scenario",
            "supersedes": None,
            "language": None,
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    draft = create_resp.json()
    assert draft["status"] == "draft"
    new_id = draft["id"]

    # 2. Reviewer approves.
    approve_resp = client.post(
        f"/api/config/values/{new_id}/approve",
        json={"approved_by": "policy-reviewer", "comment": "Looks good."},
    )
    assert approve_resp.status_code == 200, approve_resp.text
    assert approve_resp.json()["status"] == "approved"
    assert approve_resp.json()["approved_by"] == "policy-reviewer"

    # 3. A case evaluated in 2026 still sees the 1985 value.
    pre_resp = client.get(
        "/api/config/resolve",
        params={
            "key": "ca-oas.rule.age-65.min_age",
            "evaluation_date": "2026-06-01T00:00:00+00:00",
            "jurisdiction_id": "ca-oas",
        },
    )
    assert pre_resp.status_code == 200
    assert pre_resp.json()["value"] == 65

    # 4. A case evaluated on 2027-01-02 picks up the new value.
    post_resp = client.get(
        "/api/config/resolve",
        params={
            "key": "ca-oas.rule.age-65.min_age",
            "evaluation_date": "2027-01-02T00:00:00+00:00",
            "jurisdiction_id": "ca-oas",
        },
    )
    assert post_resp.status_code == 200
    assert post_resp.json()["value"] == 67


def test_phase6_audit_trail_is_persisted(client):
    """Each approval-flow event is recorded in the audit table."""
    create_resp = client.post(
        "/api/config/values",
        json={
            "domain": "rule",
            "key": "ca-oas.rule.test-audit",
            "jurisdiction_id": "ca-oas",
            "value": 1,
            "value_type": "number",
            "effective_from": "2027-01-01T00:00:00+00:00",
            "effective_to": None,
            "citation": None,
            "author": "alice",
            "rationale": "test",
            "supersedes": None,
            "language": None,
        },
    )
    new_id = create_resp.json()["id"]
    client.post(
        f"/api/config/values/{new_id}/approve",
        json={"approved_by": "bob", "comment": "ok"},
    )

    audit = config_store.list_audit(config_value_id=new_id)
    events = [(e.event, e.actor) for e in audit]
    assert events == [("draft_created", "alice"), ("approved", "bob")]


def test_phase6_persistence_survives_process_restart(tmp_path):
    """ADR-010: runtime writes survive process restart.

    Simulates a restart by dropping the ConfigStore (which holds the engine)
    and recreating it against the same SQLite file. The post-restart store
    must resolve the new value correctly.
    """
    db_file = tmp_path / "phase6_restart.db"

    # First "process": create + approve a future-dated value.
    s1 = ConfigStore(db_path=str(db_file))
    s1.put(
        ConfigValue(
            domain="rule",
            key="ca-oas.rule.age-65.min_age",
            jurisdiction_id="ca-oas",
            value=65,
            value_type=ValueType.NUMBER,
            effective_from=datetime(1985, 1, 1, tzinfo=UTC),
            author="seed",
            approved_by="seed",
        )
    )
    new = ConfigValue(
        domain="rule",
        key="ca-oas.rule.age-65.min_age",
        jurisdiction_id="ca-oas",
        value=67,
        value_type=ValueType.NUMBER,
        effective_from=datetime(2027, 1, 1, tzinfo=UTC),
        author="alice",
        approved_by="bob",
        status=ApprovalStatus.APPROVED,
    )
    s1.put(new)
    del s1

    # Second "process": fresh store, same file. State must survive.
    s2 = ConfigStore(db_path=str(db_file))
    resolved_2026 = s2.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2026, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    resolved_2027 = s2.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2027, 1, 2, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert resolved_2026 is not None and resolved_2026.value == 65
    assert resolved_2027 is not None and resolved_2027.value == 67
