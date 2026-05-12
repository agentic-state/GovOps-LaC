"""ADR-022 authoring substrate -- DraftStore lifecycle + /api/authoring/* tests.

Covers:
- create / get / list / approve (idempotent) / reject (idempotent) / discard
- commit_approved: writes the draft to lawcode/<code>/... on disk AND
  re-reads through build_registry_from_lawcode so the new jurisdiction
  is discoverable through the registry without a process restart.
- file-per-draft persistence under lawcode/.drafts/ so a fresh
  DraftStore on the same lawcode_root rehydrates the prior session.
- HTTP wiring: every endpoint shape, 404/409/400 refusal codes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from govops.authoring import (
    AuthoringError,
    Draft,
    DraftStatus,
    DraftStore,
    DraftType,
)


# ---------------------------------------------------------------------------
# DraftStore direct tests (no HTTP)
# ---------------------------------------------------------------------------


class TestDraftStoreLifecycle:
    def test_create_pending_draft(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {"id": "jur-pl-national", "country": "PL"}},
            author="alice",
            rationale="Initial PL onboarding.",
        )
        assert d.status == DraftStatus.PENDING
        assert d.id
        assert store.get(d.id) is d

    def test_approve_is_idempotent(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {"id": "jur-pl-national", "country": "PL"}},
            author="alice",
        )
        a1 = store.approve(d.id, approver="bob")
        a2 = store.approve(d.id, approver="bob")
        assert a1.status == DraftStatus.APPROVED
        assert a2.id == a1.id
        assert a2.status == DraftStatus.APPROVED
        # approved_at preserved across the idempotent call
        assert a2.approved_at == a1.approved_at

    def test_reject_blocks_subsequent_approve(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {"id": "jur-pl-national"}},
            author="alice",
        )
        store.reject(d.id, rejector="bob", reason="missing legal_tradition")
        with pytest.raises(AuthoringError, match="cannot approve"):
            store.approve(d.id, approver="carol")

    def test_reject_requires_reason(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {"id": "jur-pl-national"}},
            author="alice",
        )
        with pytest.raises(AuthoringError, match="reason required"):
            store.reject(d.id, rejector="bob", reason="   ")

    def test_target_path_discipline_by_type(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        # Jurisdiction drafts must end with config/jurisdiction.yaml
        with pytest.raises(AuthoringError, match="jurisdiction"):
            store.create(
                type=DraftType.JURISDICTION,
                target_path="pl/programs/oas.yaml",
                content={},
                author="alice",
            )
        # Program drafts must contain /programs/
        with pytest.raises(AuthoringError, match="program"):
            store.create(
                type=DraftType.PROGRAM,
                target_path="pl/config/jurisdiction.yaml",
                content={},
                author="alice",
            )

    def test_target_path_rejects_traversal(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        with pytest.raises(AuthoringError, match="relative"):
            store.create(
                type=DraftType.JURISDICTION,
                target_path="../pl/config/jurisdiction.yaml",
                content={},
                author="alice",
            )

    def test_discard_pending_draft(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {}},
            author="alice",
        )
        assert store.discard(d.id) is True
        assert store.get(d.id) is None
        # The on-disk persisted file is also gone.
        assert not (tmp_path / ".drafts" / f"{d.id}.yaml").exists()


# ---------------------------------------------------------------------------
# Commit + registry rehydration
# ---------------------------------------------------------------------------


def _minimal_program_manifest(code: str) -> dict:
    """Build a schema-valid OAS-shape program manifest for a fictional jurisdiction
    suitable for the registry loader to ingest. Mirrors what govops init scaffolds,
    minus the TODO markers (test fixtures need concrete values)."""
    return {
        "schema_version": "1.0",
        "program_id": "oas",
        "jurisdiction_id": f"jur-{code}-national",
        "shape": "old_age_pension",
        "status": "active",
        "name": {"en": f"{code.upper()} Old-Age Pension (test)"},
        "description": {"en": "Test fixture."},
        "authority_chain": [
            {
                "id": f"auth-{code}-oas-constitution",
                "layer": "constitution",
                "title": "Constitution",
                "citation": "Constitution",
                "effective_date": "1900-01-01",
                "url": "https://example.org/constitution",
            },
            {
                "id": f"auth-{code}-oas-act",
                "layer": "act",
                "title": "Pension Act",
                "citation": "Pension Act",
                "effective_date": "1900-01-01",
                "url": "https://example.org/act",
                "parent": f"auth-{code}-oas-constitution",
            },
        ],
        "legal_documents": [],
        "rules": [],
        "demo_cases": [],
    }


def _minimal_jurisdiction_metadata(code: str) -> dict:
    """ADR-019 metadata block for a fictional jurisdiction."""
    return {
        "jurisdiction": {
            "id": f"jur-{code}-national",
            "country": code.upper(),
            "level": "national",
            "parent_id": None,
            "name": {"en": f"Test Jurisdiction {code.upper()}"},
            "legal_tradition": "civil_law",
            "language_regime": "en",
            "default_language": "en",
        },
        "defaults": {
            "domain": "ui",
            "jurisdiction_id": f"{code}-oas",
            "effective_from": "1900-01-01",
        },
        "values": [],
    }


class TestCommitWritesToDiskAndRehydrates:
    def test_commit_writes_yaml_at_target_path(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        meta = _minimal_jurisdiction_metadata("xx")
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content=meta,
            author="alice",
        )
        store.approve(d.id, approver="bob")

        committed = store.commit_approved(committer="carol")
        assert [c.id for c in committed] == [d.id]
        on_disk = tmp_path / "xx" / "config" / "jurisdiction.yaml"
        assert on_disk.exists()
        re_read = yaml.safe_load(on_disk.read_text(encoding="utf-8"))
        assert re_read["jurisdiction"]["country"] == "XX"

    def test_commit_marks_drafts_committed(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content=_minimal_jurisdiction_metadata("xx"),
            author="alice",
        )
        store.approve(d.id, approver="bob")
        store.commit_approved(committer="carol")
        post = store.get(d.id)
        assert post is not None
        assert post.status == DraftStatus.COMMITTED
        assert post.committed_by == "carol"
        assert post.committed_at is not None

    def test_committed_draft_cannot_be_discarded(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content=_minimal_jurisdiction_metadata("xx"),
            author="alice",
        )
        store.approve(d.id, approver="bob")
        store.commit_approved(committer="carol")
        with pytest.raises(AuthoringError, match="committed"):
            store.discard(d.id)

    def test_commit_no_approved_returns_empty(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        store.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content=_minimal_jurisdiction_metadata("xx"),
            author="alice",
        )
        # No approve() call -> commit returns empty
        assert store.commit_approved(committer="carol") == []

    def test_jurisdiction_plus_program_commit_is_discoverable_by_loader(
        self, tmp_path: Path
    ):
        """The end-to-end ADR-022 promise: an operator can draft +
        approve + commit a brand-new jurisdiction, and the registry
        loader picks it up. This is the v3.1 'in-app adoption' promise
        encoded as an automated test.
        """
        from govops.jurisdictions import build_registry_from_lawcode

        store = DraftStore(tmp_path)
        # Jurisdiction metadata draft
        jd = store.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content=_minimal_jurisdiction_metadata("xx"),
            author="alice",
        )
        store.approve(jd.id, approver="bob")
        # OAS program manifest draft
        pd = store.create(
            type=DraftType.PROGRAM,
            target_path="xx/programs/oas.yaml",
            content=_minimal_program_manifest("xx"),
            author="alice",
        )
        store.approve(pd.id, approver="bob")

        store.commit_approved(committer="carol")

        registry = build_registry_from_lawcode(tmp_path)
        assert "xx" in registry, (
            "ADR-022 regression: committed jurisdiction not discoverable by loader"
        )
        pack = registry["xx"]
        assert pack.jurisdiction.id == "jur-xx-national"
        assert pack.jurisdiction.country == "XX"


# ---------------------------------------------------------------------------
# File-per-draft persistence
# ---------------------------------------------------------------------------


class TestDraftPersistenceAcrossRestart:
    def test_pending_drafts_survive_a_fresh_store_instance(self, tmp_path: Path):
        s1 = DraftStore(tmp_path)
        d = s1.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content=_minimal_jurisdiction_metadata("xx"),
            author="alice",
        )
        # Simulate process restart: build a fresh store from the same root.
        s2 = DraftStore(tmp_path)
        rehydrated = s2.get(d.id)
        assert rehydrated is not None
        assert rehydrated.status == DraftStatus.PENDING
        assert rehydrated.author == "alice"
        assert rehydrated.content["jurisdiction"]["country"] == "XX"

    def test_approved_and_committed_states_survive_too(self, tmp_path: Path):
        s1 = DraftStore(tmp_path)
        d = s1.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content=_minimal_jurisdiction_metadata("xx"),
            author="alice",
        )
        s1.approve(d.id, approver="bob")
        s1.commit_approved(committer="carol")

        s2 = DraftStore(tmp_path)
        post = s2.get(d.id)
        assert post is not None
        assert post.status == DraftStatus.COMMITTED
        assert post.approved_by == "bob"
        assert post.committed_by == "carol"

    def test_discarded_drafts_do_not_resurrect(self, tmp_path: Path):
        s1 = DraftStore(tmp_path)
        d = s1.create(
            type=DraftType.JURISDICTION,
            target_path="xx/config/jurisdiction.yaml",
            content={"jurisdiction": {}},
            author="alice",
        )
        s1.discard(d.id)
        s2 = DraftStore(tmp_path)
        assert s2.get(d.id) is None


# ---------------------------------------------------------------------------
# HTTP wiring
# ---------------------------------------------------------------------------


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A TestClient backed by a fresh DraftStore rooted at tmp_path. The
    module-level ``draft_store`` is monkeypatched so HTTP routes see the
    sandbox and we don't pollute the real lawcode/.drafts/ directory.

    The commit endpoint calls ``reload_registry()`` which mutates the
    GLOBAL ``JURISDICTION_REGISTRY`` dict in place; pointing
    ``_LAWCODE_ROOT`` at tmp_path means the rebuild only finds the test
    fixture's ``xx/`` jurisdiction and wipes the 7 real ones. We
    snapshot the live registry on fixture setup and restore it on
    teardown, otherwise subsequent tests in the same pytest run fail.
    """
    from govops import api as api_mod
    from govops import jurisdictions as jur_mod

    fresh = DraftStore(tmp_path)
    monkeypatch.setattr(api_mod, "draft_store", fresh)
    monkeypatch.setattr(jur_mod, "_LAWCODE_ROOT", tmp_path)

    # Snapshot the live registry so teardown can put back the 7 real
    # jurisdictions the rest of the suite depends on.
    snapshot = dict(jur_mod.JURISDICTION_REGISTRY)
    try:
        with TestClient(api_mod.app) as c:
            yield c
    finally:
        jur_mod.JURISDICTION_REGISTRY.clear()
        jur_mod.JURISDICTION_REGISTRY.update(snapshot)
        # The /compare manifest cache was busted by commit; reset it so
        # the next test sees a clean cache against the restored registry.
        api_mod.clear_compare_program_cache()


class TestAuthoringHTTP:
    def test_create_then_get(self, client):
        body = {
            "type": "jurisdiction",
            "target_path": "xx/config/jurisdiction.yaml",
            "content": _minimal_jurisdiction_metadata("xx"),
            "author": "alice",
            "rationale": "test",
        }
        r = client.post("/api/authoring/drafts", json=body)
        assert r.status_code == 200, r.text
        draft_id = r.json()["id"]

        g = client.get(f"/api/authoring/drafts/{draft_id}")
        assert g.status_code == 200
        assert g.json()["status"] == "pending"

    def test_unknown_type_400(self, client):
        r = client.post(
            "/api/authoring/drafts",
            json={
                "type": "not_a_type",
                "target_path": "xx/config/jurisdiction.yaml",
                "content": {},
                "author": "alice",
            },
        )
        assert r.status_code == 400

    def test_list_filters_by_status(self, client):
        for code in ("aa", "bb", "cc"):
            client.post(
                "/api/authoring/drafts",
                json={
                    "type": "jurisdiction",
                    "target_path": f"{code}/config/jurisdiction.yaml",
                    "content": _minimal_jurisdiction_metadata(code),
                    "author": "alice",
                },
            )
        # Approve one
        all_pending = client.get("/api/authoring/drafts?status=pending").json()["drafts"]
        assert len(all_pending) == 3
        client.post(
            f"/api/authoring/drafts/{all_pending[0]['id']}/approve",
            json={"approver": "bob"},
        )
        pending = client.get("/api/authoring/drafts?status=pending").json()["drafts"]
        approved = client.get("/api/authoring/drafts?status=approved").json()["drafts"]
        assert len(pending) == 2
        assert len(approved) == 1

    def test_approve_unknown_returns_404(self, client):
        r = client.post(
            "/api/authoring/drafts/does-not-exist/approve",
            json={"approver": "bob"},
        )
        assert r.status_code == 404

    def test_reject_then_approve_returns_409(self, client):
        body = {
            "type": "jurisdiction",
            "target_path": "xx/config/jurisdiction.yaml",
            "content": _minimal_jurisdiction_metadata("xx"),
            "author": "alice",
        }
        draft_id = client.post("/api/authoring/drafts", json=body).json()["id"]
        client.post(
            f"/api/authoring/drafts/{draft_id}/reject",
            json={"rejector": "bob", "reason": "nope"},
        )
        r = client.post(
            f"/api/authoring/drafts/{draft_id}/approve",
            json={"approver": "carol"},
        )
        assert r.status_code == 409

    def test_discard_pending_204(self, client):
        body = {
            "type": "jurisdiction",
            "target_path": "xx/config/jurisdiction.yaml",
            "content": _minimal_jurisdiction_metadata("xx"),
            "author": "alice",
        }
        draft_id = client.post("/api/authoring/drafts", json=body).json()["id"]
        r = client.delete(f"/api/authoring/drafts/{draft_id}")
        assert r.status_code == 204
        # The draft is gone
        assert client.get(f"/api/authoring/drafts/{draft_id}").status_code == 404

    def test_commit_writes_disk_and_reloads_registry(self, client, tmp_path):
        # Stage the metadata + program in the sandbox lawcode root.
        jd_id = client.post(
            "/api/authoring/drafts",
            json={
                "type": "jurisdiction",
                "target_path": "xx/config/jurisdiction.yaml",
                "content": _minimal_jurisdiction_metadata("xx"),
                "author": "alice",
            },
        ).json()["id"]
        pd_id = client.post(
            "/api/authoring/drafts",
            json={
                "type": "program",
                "target_path": "xx/programs/oas.yaml",
                "content": _minimal_program_manifest("xx"),
                "author": "alice",
            },
        ).json()["id"]
        client.post(
            f"/api/authoring/drafts/{jd_id}/approve",
            json={"approver": "bob"},
        )
        client.post(
            f"/api/authoring/drafts/{pd_id}/approve",
            json={"approver": "bob"},
        )

        r = client.post("/api/authoring/commit", json={"committer": "carol"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["committed"]) == 2
        assert body["reloaded"] is True

        # Files exist on disk inside the test sandbox.
        assert (tmp_path / "xx" / "config" / "jurisdiction.yaml").exists()
        assert (tmp_path / "xx" / "programs" / "oas.yaml").exists()

        # Registry now contains the new jurisdiction.
        from govops.jurisdictions import JURISDICTION_REGISTRY
        assert "xx" in JURISDICTION_REGISTRY

    def test_commit_with_no_approved_returns_empty(self, client):
        # Pending-only draft -> commit returns empty + reloaded=False.
        client.post(
            "/api/authoring/drafts",
            json={
                "type": "jurisdiction",
                "target_path": "xx/config/jurisdiction.yaml",
                "content": _minimal_jurisdiction_metadata("xx"),
                "author": "alice",
            },
        )
        r = client.post("/api/authoring/commit", json={"committer": "carol"})
        assert r.status_code == 200
        assert r.json() == {"committed": [], "reloaded": False}
