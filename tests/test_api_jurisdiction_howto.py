"""Backend prelude tests for govops-022 (per PLAN §12 10A.x.9).

GET /api/jurisdiction/{jur_code} exposes a substrate-resolved
``howto_url`` field per jurisdiction. The Lovable spec govops-022
moves the per-jurisdiction "How to apply" URL out of a hardcoded
table in ScreenResult.tsx into ConfigValue records keyed
``jurisdiction.<code>.howto_url``.

These tests assert:
- The GET endpoint returns the standard JurisdictionResponse shape
  with ``howto_url`` populated for every seeded jurisdiction
- Unknown jurisdictions return 404
- A jurisdiction with no substrate record returns ``howto_url=null``
  (the UI falls back to its preview-mode table)
- The substrate-as-truth invariant: writing a new approved record
  via the admin/draft path flips the GET response without restart
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from govops.api import app, config_store
from govops.config import ApprovalStatus


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestJurisdictionGet:
    """govops-022 prelude: GET /api/jurisdiction/{code}."""

    def test_returns_program_metadata_for_each_jurisdiction(self, client):
        # All 6 supported jurisdictions resolve through the registry.
        for code in ("ca", "br", "es", "fr", "de", "ua"):
            r = client.get(f"/api/jurisdiction/{code}")
            assert r.status_code == 200, f"GET /api/jurisdiction/{code} → {r.status_code}: {r.text}"
            data = r.json()
            assert set(data.keys()) >= {
                "id",
                "jurisdiction_label",
                "program_name",
                "default_language",
                "howto_url",
            }, f"missing fields for {code}: {set(data.keys())}"
            assert data["program_name"], f"program_name empty for {code}"
            assert data["default_language"], f"default_language empty for {code}"

    def test_howto_url_is_populated_from_substrate_for_each_jurisdiction(self, client):
        # The seeded `jurisdiction.<code>.howto_url` records under
        # lawcode/<jur>/config/jurisdiction.yaml must round-trip through
        # the GET endpoint for every jurisdiction.
        expected_hosts = {
            "ca": "canada.ca",
            "br": "gov.br",
            "es": "seg-social.es",
            "fr": "service-public.fr",
            "de": "deutsche-rentenversicherung.de",
            "ua": "pfu.gov.ua",
        }
        for code, host in expected_hosts.items():
            r = client.get(f"/api/jurisdiction/{code}")
            assert r.status_code == 200
            url = r.json()["howto_url"]
            assert isinstance(url, str) and url.startswith("https://"), (
                f"howto_url for {code} is not an HTTPS URL: {url!r}"
            )
            assert host in url, f"howto_url for {code} ({url!r}) does not point to {host}"

    def test_unknown_jurisdiction_returns_404(self, client):
        r = client.get("/api/jurisdiction/xx")
        assert r.status_code == 404
        assert "Unknown jurisdiction" in r.json()["detail"]

    def test_howto_url_field_is_string_or_null(self, client):
        # Strict shape contract: never absent, always present as string|null.
        r = client.get("/api/jurisdiction/ca")
        data = r.json()
        assert "howto_url" in data
        assert data["howto_url"] is None or isinstance(data["howto_url"], str)

    def test_howto_url_is_null_when_substrate_record_missing(self, client):
        # Close the existing CA record so the resolver finds no candidate.
        # Use a far-past effective_to to ensure no past evaluation_date
        # could ever satisfy the window.
        existing = config_store.list_versions(
            "jurisdiction.ca.howto_url", jurisdiction_id="ca-oas"
        )
        try:
            for cv in existing:
                cv.effective_to = datetime(1900, 1, 1, tzinfo=timezone.utc)
                config_store.put(cv)
            r = client.get("/api/jurisdiction/ca")
            assert r.status_code == 200
            assert r.json()["howto_url"] is None
        finally:
            # Restore: reopen the records (effective_to back to None).
            for cv in existing:
                cv.effective_to = None
                config_store.put(cv)

    def test_substrate_change_flips_response_without_restart(self, client):
        # Configure-without-deploy invariant: mutating the existing
        # approved record via ConfigStore.put() must be visible on the
        # next GET without re-importing the app.
        records = [
            cv
            for cv in config_store.list_versions(
                "jurisdiction.ca.howto_url", jurisdiction_id="ca-oas"
            )
            if cv.effective_to is None and cv.status == ApprovalStatus.APPROVED
        ]
        assert records, "expected an open-ended ca howto_url substrate record"
        original_url = records[0].value
        new_url = "https://example.gov.ca/oas-substrate-flip-test"
        try:
            records[0].value = new_url
            config_store.put(records[0])
            r = client.get("/api/jurisdiction/ca")
            assert r.status_code == 200
            assert r.json()["howto_url"] == new_url
        finally:
            records[0].value = original_url
            config_store.put(records[0])
            # Confirm the restore landed before the next test runs.
            r = client.get("/api/jurisdiction/ca")
            assert r.json()["howto_url"] == original_url

    def test_post_endpoint_response_unchanged(self, client):
        # The pre-existing POST /api/jurisdiction/{code} (switch_jurisdiction)
        # is left intact by govops-022: same shape, same fields. The new
        # GET sits alongside it.
        r = client.post("/api/jurisdiction/ca")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == {"jurisdiction", "name", "program"}
