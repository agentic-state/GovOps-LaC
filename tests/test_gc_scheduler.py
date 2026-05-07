"""Tests for the v2.1 daily age-based GC.

Coverage:
  - ConfigStore.gc_old_user_records preserves seeded rows + deletes user
    drafts older than the cutoff
  - gc_scheduler.run_gc updates the last_gc_at timestamp
  - gc_scheduler.maybe_run_catchup is a no-op when not in demo mode and
    when the last run is recent; fires on cold-wake when stale
  - admin endpoint requires the token + reports deletion count
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from govops import gc_scheduler
from govops.config import ApprovalStatus, ConfigStore, ConfigValue, ValueType


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def store(tmp_path):
    """Fresh in-memory ConfigStore with no fixtures."""
    db = tmp_path / "gc-test.db"
    s = ConfigStore(db_path=str(db))
    yield s


def _make_cv(
    *,
    key: str,
    author: str,
    created_at: datetime,
) -> ConfigValue:
    """Build a ConfigValue with a forced created_at — the SQLModel default
    factory would otherwise stamp it as now()."""
    cv = ConfigValue(
        domain="rule",
        key=key,
        jurisdiction_id="ca-oas",
        value=42,
        value_type=ValueType.NUMBER,
        effective_from=datetime(2026, 1, 1, tzinfo=timezone.utc),
        author=author,
        rationale="test",
        status=ApprovalStatus.APPROVED,
    )
    cv.created_at = created_at
    return cv


@pytest.fixture(autouse=True)
def _reset_scheduler_state():
    """Each test starts with no last_gc_at and no running scheduler."""
    gc_scheduler.reset_state_for_tests()
    yield
    gc_scheduler.reset_state_for_tests()


# ---------------------------------------------------------------------------
# ConfigStore.gc_old_user_records
# ---------------------------------------------------------------------------


def test_gc_preserves_seeded_records(store):
    now = datetime.now(timezone.utc)
    old = now - timedelta(days=10)

    seed_cv = _make_cv(key="ca.rule.age", author="system:seed:rules.yaml", created_at=old)
    user_cv = _make_cv(key="ca.rule.draft", author="reviewer@example.com", created_at=old)

    store.put(seed_cv)
    store.put(user_cv)

    deleted = store.gc_old_user_records(max_age_days=7)
    assert deleted == 1

    remaining_keys = {cv.key for cv in store.all()}
    assert "ca.rule.age" in remaining_keys  # seeded → kept
    assert "ca.rule.draft" not in remaining_keys  # user → deleted


def test_gc_preserves_recent_user_records(store):
    now = datetime.now(timezone.utc)
    recent = now - timedelta(days=2)
    old = now - timedelta(days=10)

    store.put(_make_cv(key="ca.rule.recent", author="reviewer@example.com", created_at=recent))
    store.put(_make_cv(key="ca.rule.stale", author="reviewer@example.com", created_at=old))

    deleted = store.gc_old_user_records(max_age_days=7)
    assert deleted == 1
    keys = {cv.key for cv in store.all()}
    assert "ca.rule.recent" in keys
    assert "ca.rule.stale" not in keys


def test_gc_preserves_all_system_authors(store):
    """`system:` prefix in author covers seed, demo, yaml-fallback, etc."""
    now = datetime.now(timezone.utc)
    old = now - timedelta(days=10)

    for author in ["system:seed:rules.yaml", "system:demo", "system:yaml", "system"]:
        store.put(_make_cv(
            key=f"k.{author.replace(':', '.')}",
            author=author,
            created_at=old,
        ))

    deleted = store.gc_old_user_records(max_age_days=7)
    assert deleted == 0
    assert len(store.all()) == 4


def test_gc_returns_zero_when_nothing_old(store):
    now = datetime.now(timezone.utc)
    store.put(_make_cv(key="ca.rule.fresh", author="user@example.com", created_at=now))

    deleted = store.gc_old_user_records(max_age_days=7)
    assert deleted == 0


# ---------------------------------------------------------------------------
# gc_scheduler.run_gc + maybe_run_catchup
# ---------------------------------------------------------------------------


def test_run_gc_updates_last_gc_at(store):
    assert gc_scheduler.get_last_gc_at() is None
    gc_scheduler.run_gc(store)
    last = gc_scheduler.get_last_gc_at()
    assert last is not None
    # Should be very recent (within 5s)
    delta = abs((datetime.now(timezone.utc) - last).total_seconds())
    assert delta < 5


def test_maybe_run_catchup_skips_when_not_demo(store, monkeypatch):
    monkeypatch.delenv("GOVOPS_DEMO_MODE", raising=False)
    fired = gc_scheduler.maybe_run_catchup(store)
    assert fired is False
    assert gc_scheduler.get_last_gc_at() is None


def test_maybe_run_catchup_fires_when_stale(store, monkeypatch):
    monkeypatch.setenv("GOVOPS_DEMO_MODE", "1")
    # No prior GC → catch-up should fire
    fired = gc_scheduler.maybe_run_catchup(store)
    assert fired is True
    assert gc_scheduler.get_last_gc_at() is not None


def test_maybe_run_catchup_skips_when_recent(store, monkeypatch):
    monkeypatch.setenv("GOVOPS_DEMO_MODE", "1")
    gc_scheduler.run_gc(store)  # baseline
    # Immediate second call should be skipped (last run < 24h ago)
    fired = gc_scheduler.maybe_run_catchup(store)
    assert fired is False


# ---------------------------------------------------------------------------
# Admin /api/admin/gc endpoint
# ---------------------------------------------------------------------------


def test_admin_gc_returns_403_without_token_configured(monkeypatch):
    """When DEMO_ADMIN_TOKEN is unset on the server, endpoint refuses."""
    monkeypatch.delenv("DEMO_ADMIN_TOKEN", raising=False)
    from govops.api import app
    client = TestClient(app)
    r = client.post("/api/admin/gc?token=anything")
    assert r.status_code == 403
    assert "DEMO_ADMIN_TOKEN" in r.json()["detail"]


def test_admin_gc_requires_correct_token(monkeypatch):
    monkeypatch.setenv("DEMO_ADMIN_TOKEN", "secret-xyz")
    from govops.api import app
    client = TestClient(app)
    # Missing token
    r = client.post("/api/admin/gc")
    assert r.status_code == 401
    # Wrong token
    r = client.post("/api/admin/gc?token=wrong")
    assert r.status_code == 401
    # Correct token → 200
    r = client.post("/api/admin/gc?token=secret-xyz")
    assert r.status_code == 200
    body = r.json()
    assert body["max_age_days"] == 7
    assert "deleted" in body
    assert body["ran_at"] is not None
