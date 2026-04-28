"""Tests for the admin federation HTTP surface (Phase 8 / govops-020).

Coverage:
  - GET /api/admin/federation/registry → publisher list with trust_state
  - GET /api/admin/federation/packs → imported packs with provenance + enabled
  - POST /api/admin/federation/fetch/{publisher_id} → success + every fail-closed
    path produces the right HTTP status
  - POST /api/admin/federation/packs/{publisher_id}/enabled → toggle state
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from govops.federation import (
    FederationFile,
    FederationManifest,
    generate_keypair,
    sha256_hex,
    sign_manifest,
)


# ---------------------------------------------------------------------------
# Sandbox lawcode directory: each test sets GOVOPS_LAWCODE_DIR to a tmp_path
# so the API endpoints read the test's REGISTRY/keys/packs without touching
# the real lawcode/.
# ---------------------------------------------------------------------------


@pytest.fixture
def lawcode_sandbox(tmp_path, monkeypatch):
    """Create a writable lawcode-shaped directory tree under tmp_path."""
    sandbox = tmp_path / "lawcode"
    (sandbox / "global").mkdir(parents=True)
    (sandbox / ".federated").mkdir()
    monkeypatch.setenv("GOVOPS_LAWCODE_DIR", str(sandbox))
    return sandbox


@pytest.fixture
def client(lawcode_sandbox):
    # Import after monkeypatch so the env var is in scope (even though the
    # endpoint reads at request time, this is defensive).
    from govops.api import app
    with TestClient(app) as c:
        yield c


def _write_registry(sandbox: Path, entries: list[dict]) -> None:
    import yaml
    doc = {"values": entries}
    (sandbox / "REGISTRY.yaml").write_text(yaml.safe_dump(doc), encoding="utf-8")


def _write_trusted_keys(sandbox: Path, keys: dict[str, str]) -> None:
    import yaml
    values = []
    for pid, pk in keys.items():
        values.append({
            "key": f"global.federation.trusted_key.{pid}",
            "value": {"public_key_b64": pk},
            "value_type": "object",
        })
    doc = {
        "defaults": {
            "domain": "federation",
            "jurisdiction_id": "global",
            "effective_from": "1900-01-01",
            "value_type": "object",
        },
        "values": values,
    }
    (sandbox / "global" / "trusted_keys.yaml").write_text(
        yaml.safe_dump(doc), encoding="utf-8"
    )


def _write_pack(sandbox: Path, publisher_id: str, *, signed: bool = True, version: str = "1.0.0") -> None:
    pack_dir = sandbox / ".federated" / publisher_id
    pack_dir.mkdir(parents=True)
    (pack_dir / "lawcode" / "jp" / "config").mkdir(parents=True)
    (pack_dir / "lawcode" / "jp" / "config" / "rules.yaml").write_text(
        "values: []\n", encoding="utf-8"
    )
    provenance = {
        "publisher_id": publisher_id,
        "pack_name": "test-pack",
        "version": version,
        "published_at": "2026-04-27T12:00:00+00:00",
        "fetched_at": "2026-04-28T12:00:00+00:00",
        "manifest_url": f"https://example.org/{publisher_id}/manifest.yaml",
        "signed": signed,
        "files": [{"path": "lawcode/jp/config/rules.yaml", "sha256": "abc"}],
    }
    (pack_dir / ".provenance.json").write_text(
        json.dumps(provenance, indent=2), encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# GET /api/admin/federation/registry
# ---------------------------------------------------------------------------


class TestRegistryEndpoint:
    def test_empty_registry_returns_empty_publishers(self, client, lawcode_sandbox):
        _write_registry(lawcode_sandbox, [])
        r = client.get("/api/admin/federation/registry")
        assert r.status_code == 200
        assert r.json() == {"publishers": []}

    def test_publisher_with_trusted_key_marked_trusted(self, client, lawcode_sandbox):
        _, pub_b64 = generate_keypair()
        _write_registry(lawcode_sandbox, [{
            "publisher_id": "alice",
            "name": "Alice's Pack",
            "manifest_url": "https://example.org/alice/manifest.yaml",
        }])
        _write_trusted_keys(lawcode_sandbox, {"alice": pub_b64})
        r = client.get("/api/admin/federation/registry")
        assert r.status_code == 200
        body = r.json()
        assert len(body["publishers"]) == 1
        assert body["publishers"][0]["publisher_id"] == "alice"
        assert body["publishers"][0]["trust_state"] == "trusted"

    def test_publisher_without_trusted_key_marked_unsigned_only(self, client, lawcode_sandbox):
        _write_registry(lawcode_sandbox, [{
            "publisher_id": "bob",
            "name": "Bob's Pack",
            "manifest_url": "https://example.org/bob/manifest.yaml",
        }])
        _write_trusted_keys(lawcode_sandbox, {})
        r = client.get("/api/admin/federation/registry")
        body = r.json()
        assert body["publishers"][0]["trust_state"] == "unsigned_only"


# ---------------------------------------------------------------------------
# GET /api/admin/federation/packs
# ---------------------------------------------------------------------------


class TestPacksEndpoint:
    def test_empty_federated_dir_returns_empty(self, client):
        r = client.get("/api/admin/federation/packs")
        assert r.status_code == 200
        assert r.json() == {"packs": []}

    def test_imported_pack_surfaces_with_enabled_true(self, client, lawcode_sandbox):
        _write_pack(lawcode_sandbox, "alice", signed=True)
        r = client.get("/api/admin/federation/packs")
        body = r.json()
        assert len(body["packs"]) == 1
        pack = body["packs"][0]
        assert pack["publisher_id"] == "alice"
        assert pack["signed"] is True
        assert pack["enabled"] is True

    def test_disabled_sentinel_flips_enabled_false(self, client, lawcode_sandbox):
        _write_pack(lawcode_sandbox, "alice")
        (lawcode_sandbox / ".federated" / "alice" / ".disabled").write_text("disabled\n")
        r = client.get("/api/admin/federation/packs")
        body = r.json()
        assert body["packs"][0]["enabled"] is False


# ---------------------------------------------------------------------------
# POST /api/admin/federation/fetch/{publisher_id}
# ---------------------------------------------------------------------------


class TestFetchEndpoint:
    def test_unknown_publisher_returns_403(self, client, lawcode_sandbox):
        _write_registry(lawcode_sandbox, [])
        r = client.post("/api/admin/federation/fetch/nobody")
        assert r.status_code == 403
        assert "not in the registry" in r.json()["detail"]

    def test_unsigned_without_allow_returns_400(self, client, lawcode_sandbox, monkeypatch):
        # Stub HTTP loaders so the test doesn't make a real request.
        from govops import api as api_module
        from govops import federation as fed
        sample_files = {"lawcode/jp/config/rules.yaml": b"values: []\n"}
        manifest = FederationManifest(
            publisher_id="alice",
            pack_name="test",
            version="1.0.0",
            published_at=datetime(2026, 4, 27, tzinfo=timezone.utc),
            files=[FederationFile(path=p, sha256=sha256_hex(b)) for p, b in sample_files.items()],
        )
        manifest_url = "https://example.org/alice/manifest.yaml"
        _write_registry(lawcode_sandbox, [{
            "publisher_id": "alice",
            "manifest_url": manifest_url,
        }])
        _write_trusted_keys(lawcode_sandbox, {})

        def fake_manifest_loader(url):
            return manifest.model_dump(mode="json")

        def fake_file_loader(url):
            for path, data in sample_files.items():
                if url.endswith(path):
                    return data
            raise AssertionError(url)

        monkeypatch.setattr(fed, "http_manifest_loader", fake_manifest_loader)
        monkeypatch.setattr(fed, "http_file_loader", fake_file_loader)

        r = client.post("/api/admin/federation/fetch/alice")
        assert r.status_code == 400
        assert "unsigned" in r.json()["detail"]

    def test_signed_happy_path_returns_200(self, client, lawcode_sandbox, monkeypatch):
        from govops import federation as fed
        priv, pub_b64 = generate_keypair()
        sample_files = {"lawcode/jp/config/rules.yaml": b"values: []\n"}
        manifest = sign_manifest(
            FederationManifest(
                publisher_id="alice",
                pack_name="test",
                version="1.0.0",
                published_at=datetime(2026, 4, 27, tzinfo=timezone.utc),
                files=[FederationFile(path=p, sha256=sha256_hex(b)) for p, b in sample_files.items()],
            ),
            priv,
        )
        _write_registry(lawcode_sandbox, [{
            "publisher_id": "alice",
            "manifest_url": "https://example.org/alice/manifest.yaml",
        }])
        _write_trusted_keys(lawcode_sandbox, {"alice": pub_b64})

        def fake_manifest_loader(url):
            return manifest.model_dump(mode="json")

        def fake_file_loader(url):
            for path, data in sample_files.items():
                if url.endswith(path):
                    return data
            raise AssertionError(url)

        monkeypatch.setattr(fed, "http_manifest_loader", fake_manifest_loader)
        monkeypatch.setattr(fed, "http_file_loader", fake_file_loader)

        r = client.post("/api/admin/federation/fetch/alice")
        assert r.status_code == 200
        body = r.json()
        assert body["result"]["publisher_id"] == "alice"
        assert body["result"]["signed"] is True

    def test_dry_run_query_param_is_propagated(self, client, lawcode_sandbox, monkeypatch):
        from govops import federation as fed
        priv, pub_b64 = generate_keypair()
        sample_files = {"lawcode/jp/config/rules.yaml": b"values: []\n"}
        manifest = sign_manifest(
            FederationManifest(
                publisher_id="alice",
                pack_name="test",
                version="1.0.0",
                published_at=datetime(2026, 4, 27, tzinfo=timezone.utc),
                files=[FederationFile(path=p, sha256=sha256_hex(b)) for p, b in sample_files.items()],
            ),
            priv,
        )
        _write_registry(lawcode_sandbox, [{
            "publisher_id": "alice",
            "manifest_url": "https://example.org/alice/manifest.yaml",
        }])
        _write_trusted_keys(lawcode_sandbox, {"alice": pub_b64})

        monkeypatch.setattr(fed, "http_manifest_loader", lambda url: manifest.model_dump(mode="json"))
        monkeypatch.setattr(fed, "http_file_loader", lambda url: sample_files["lawcode/jp/config/rules.yaml"])

        r = client.post("/api/admin/federation/fetch/alice?dry_run=true")
        assert r.status_code == 200
        # dry_run produces no files written → nothing on disk.
        assert not (lawcode_sandbox / ".federated" / "alice").exists()


# ---------------------------------------------------------------------------
# POST /api/admin/federation/packs/{publisher_id}/enabled
# ---------------------------------------------------------------------------


class TestEnabledEndpoint:
    def test_disable_an_enabled_pack(self, client, lawcode_sandbox):
        _write_pack(lawcode_sandbox, "alice")
        r = client.post(
            "/api/admin/federation/packs/alice/enabled",
            json={"enabled": False},
        )
        assert r.status_code == 200
        assert r.json() == {"publisher_id": "alice", "enabled": False, "changed": True}
        assert (lawcode_sandbox / ".federated" / "alice" / ".disabled").exists()

    def test_enable_a_disabled_pack(self, client, lawcode_sandbox):
        _write_pack(lawcode_sandbox, "alice")
        sentinel = lawcode_sandbox / ".federated" / "alice" / ".disabled"
        sentinel.write_text("disabled\n")
        r = client.post(
            "/api/admin/federation/packs/alice/enabled",
            json={"enabled": True},
        )
        assert r.status_code == 200
        assert r.json()["enabled"] is True
        assert not sentinel.exists()

    def test_no_change_when_already_in_state(self, client, lawcode_sandbox):
        _write_pack(lawcode_sandbox, "alice")
        r = client.post(
            "/api/admin/federation/packs/alice/enabled",
            json={"enabled": True},
        )
        assert r.json() == {"publisher_id": "alice", "enabled": True, "changed": False}

    def test_unknown_pack_returns_404(self, client):
        r = client.post(
            "/api/admin/federation/packs/nonexistent/enabled",
            json={"enabled": False},
        )
        assert r.status_code == 404
