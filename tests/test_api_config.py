"""API tests for the ConfigValue endpoints (Phase 1)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from govops.api import app, config_store
from govops.config import ApprovalStatus, ConfigValue, ValueType


UTC = timezone.utc


@pytest.fixture
def client():
    config_store.clear()
    _seed_fixture()
    with TestClient(app) as c:
        yield c
    config_store.clear()


def _seed_fixture():
    """Seed a small fixture covering the cases the endpoints need to handle."""
    # Original CA-OAS minimum age, in effect since 1985.
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
    # A future-dated supersession (not yet in effect at 2026).
    config_store.put(
        ConfigValue(
            domain="rule",
            key="ca-oas.rule.age-65.min_age",
            jurisdiction_id="ca-oas",
            value=67,
            value_type=ValueType.NUMBER,
            effective_from=datetime(2030, 1, 1, tzinfo=UTC),
            citation="OAS Act amendment (illustrative)",
            author="reviewer",
            approved_by="maintainer",
            rationale="Illustrative future amendment.",
            status=ApprovalStatus.APPROVED,
        )
    )
    # A residency-related parameter under the same jurisdiction.
    config_store.put(
        ConfigValue(
            domain="rule",
            key="ca-oas.rule.residency.min_years",
            jurisdiction_id="ca-oas",
            value=10,
            value_type=ValueType.NUMBER,
            effective_from=datetime(1985, 1, 1, tzinfo=UTC),
            citation="OAS Act, s. 3(1)(a)",
            author="seed",
            approved_by="seed",
            rationale="Original residency minimum.",
        )
    )
    # A global UI label.
    config_store.put(
        ConfigValue(
            domain="ui",
            key="global.ui.label.cases.title",
            jurisdiction_id=None,
            value="Cases",
            value_type=ValueType.STRING,
            effective_from=datetime(2000, 1, 1, tzinfo=UTC),
            language="en",
            author="seed",
            approved_by="seed",
            rationale="Default English label.",
        )
    )


# ---------------------------------------------------------------------------
# /api/config/values
# ---------------------------------------------------------------------------


class TestListConfigValues:
    def test_list_all(self, client):
        r = client.get("/api/config/values")
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 4
        assert len(data["values"]) == 4

    def test_filter_by_domain(self, client):
        r = client.get("/api/config/values", params={"domain": "rule"})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 3
        assert all(v["domain"] == "rule" for v in data["values"])

    def test_filter_by_key_prefix(self, client):
        r = client.get(
            "/api/config/values", params={"key_prefix": "ca-oas.rule.age"}
        )
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 2
        assert all(v["key"].startswith("ca-oas.rule.age") for v in data["values"])

    def test_filter_by_jurisdiction(self, client):
        r = client.get("/api/config/values", params={"jurisdiction_id": "ca-oas"})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 3

    def test_filter_by_language(self, client):
        r = client.get("/api/config/values", params={"language": "en"})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 1
        assert data["values"][0]["value"] == "Cases"


# ---------------------------------------------------------------------------
# /api/config/values/{id}
# ---------------------------------------------------------------------------


class TestGetConfigValue:
    def test_get_existing(self, client):
        listing = client.get("/api/config/values").json()
        value_id = listing["values"][0]["id"]
        r = client.get(f"/api/config/values/{value_id}")
        assert r.status_code == 200
        assert r.json()["id"] == value_id

    def test_get_missing_returns_404(self, client):
        r = client.get("/api/config/values/01ABCDEFGHJKMNPQRSTVWXYZ00")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# /api/config/resolve
# ---------------------------------------------------------------------------


class TestResolveConfigValue:
    """Endpoint returns the ConfigValue directly, or JSON null if none in effect."""

    def test_resolve_picks_in_effect_version(self, client):
        r = client.get(
            "/api/config/resolve",
            params={
                "key": "ca-oas.rule.age-65.min_age",
                "evaluation_date": "2020-06-01T00:00:00+00:00",
                "jurisdiction_id": "ca-oas",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert data["value"] == 65
        assert data["key"] == "ca-oas.rule.age-65.min_age"

    def test_resolve_after_supersession(self, client):
        r = client.get(
            "/api/config/resolve",
            params={
                "key": "ca-oas.rule.age-65.min_age",
                "evaluation_date": "2031-01-01T00:00:00+00:00",
                "jurisdiction_id": "ca-oas",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert data["value"] == 67

    def test_resolve_missing_key_returns_null(self, client):
        r = client.get(
            "/api/config/resolve",
            params={
                "key": "ca-oas.rule.does-not-exist",
                "evaluation_date": "2020-01-01T00:00:00+00:00",
                "jurisdiction_id": "ca-oas",
            },
        )
        assert r.status_code == 200
        assert r.json() is None

    def test_resolve_global_fallback(self, client):
        r = client.get(
            "/api/config/resolve",
            params={
                "key": "global.ui.label.cases.title",
                "evaluation_date": "2020-06-01T00:00:00+00:00",
                "jurisdiction_id": "ca-oas",
                "language": "en",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert data["value"] == "Cases"

    def test_resolve_rejects_naive_datetime(self, client):
        r = client.get(
            "/api/config/resolve",
            params={
                "key": "ca-oas.rule.age-65.min_age",
                "evaluation_date": "2020-06-01T00:00:00",
                "jurisdiction_id": "ca-oas",
            },
        )
        assert r.status_code == 400

    def test_resolve_defaults_to_now(self, client):
        r = client.get(
            "/api/config/resolve",
            params={
                "key": "ca-oas.rule.age-65.min_age",
                "jurisdiction_id": "ca-oas",
            },
        )
        assert r.status_code == 200
        assert r.json() is not None


# ---------------------------------------------------------------------------
# /api/config/versions
# ---------------------------------------------------------------------------


class TestListVersions:
    def test_versions_for_superseded_key(self, client):
        r = client.get(
            "/api/config/versions",
            params={
                "key": "ca-oas.rule.age-65.min_age",
                "jurisdiction_id": "ca-oas",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 2
        assert data["versions"][0]["value"] == 65
        assert data["versions"][1]["value"] == 67

    def test_versions_for_unknown_key_empty(self, client):
        r = client.get(
            "/api/config/versions",
            params={"key": "nope", "jurisdiction_id": "ca-oas"},
        )
        assert r.status_code == 200
        assert r.json()["count"] == 0
