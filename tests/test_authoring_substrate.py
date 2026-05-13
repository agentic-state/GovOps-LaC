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

from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from govops.authoring import (
    AuthoringError,
    DraftStatus,
    DraftStore,
    DraftType,
    TargetPathConflict,
    _render_yaml_for_commit,
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

    def test_open_draft_holds_target_path_against_second_create(self, tmp_path: Path):
        """ADR-023: a PENDING draft holds its target_path; a second
        create() against the same path raises TargetPathConflict
        carrying the colliding draft id."""
        store = DraftStore(tmp_path)
        first = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {"id": "jur-pl-federal"}},
            author="alice",
        )
        with pytest.raises(TargetPathConflict) as exc:
            store.create(
                type=DraftType.JURISDICTION,
                target_path="pl/config/jurisdiction.yaml",
                content={"jurisdiction": {"id": "jur-pl-federal"}},
                author="bob",
            )
        assert exc.value.conflicting_draft_id == first.id
        assert exc.value.target_path == "pl/config/jurisdiction.yaml"

    def test_approved_draft_still_holds_target_path(self, tmp_path: Path):
        """APPROVED counts as 'open' for conflict purposes -- the path
        is committed-bound, not free."""
        store = DraftStore(tmp_path)
        first = store.create(
            type=DraftType.PROGRAM,
            target_path="pl/programs/oas.yaml",
            content={"program_id": "oas"},
            author="alice",
        )
        store.approve(first.id, approver="approver")
        with pytest.raises(TargetPathConflict) as exc:
            store.create(
                type=DraftType.PROGRAM,
                target_path="pl/programs/oas.yaml",
                content={"program_id": "oas"},
                author="bob",
            )
        assert exc.value.conflicting_draft_id == first.id

    def test_rejected_draft_releases_target_path(self, tmp_path: Path):
        """Rejecting clears the hold -- the next create() succeeds on
        the same path."""
        store = DraftStore(tmp_path)
        first = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {"id": "jur-pl-federal"}},
            author="alice",
        )
        store.reject(first.id, rejector="reviewer", reason="not yet")
        # Should succeed, not raise.
        second = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {"id": "jur-pl-federal"}},
            author="bob",
        )
        assert second.id != first.id

    def test_discarded_draft_releases_target_path(self, tmp_path: Path):
        """Discarding clears the hold the same way rejection does."""
        store = DraftStore(tmp_path)
        first = store.create(
            type=DraftType.PROGRAM,
            target_path="pl/programs/oas.yaml",
            content={"program_id": "oas"},
            author="alice",
        )
        # CodeQL py/assert-side-effect: keep the side-effecting call
        # outside the assert so the assertion checks a pure value.
        discarded = store.discard(first.id)
        assert discarded is True
        # Path is now free.
        second = store.create(
            type=DraftType.PROGRAM,
            target_path="pl/programs/oas.yaml",
            content={"program_id": "oas"},
            author="bob",
        )
        assert second.id != first.id

    def test_target_path_rejects_traversal(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        with pytest.raises(AuthoringError, match="relative"):
            store.create(
                type=DraftType.JURISDICTION,
                target_path="../pl/config/jurisdiction.yaml",
                content={},
                author="alice",
            )

    def test_update_pending_draft_replaces_content(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.PROGRAM,
            target_path="xx/programs/oas.yaml",
            content={"program_id": "oas", "authority_chain": []},
            author="alice",
        )
        updated = store.update_content(
            d.id,
            content={
                "program_id": "oas",
                "authority_chain": [
                    {"id": "auth-1", "layer": "constitution", "title": "C"},
                ],
            },
            editor="bob",
            rationale="add constitution",
        )
        assert updated.content["authority_chain"][0]["id"] == "auth-1"
        assert updated.author == "bob"
        assert updated.rationale == "add constitution"
        # Persisted on disk.
        persisted = (tmp_path / ".drafts" / f"{d.id}.yaml").read_text(encoding="utf-8")
        assert "auth-1" in persisted

    def test_update_refuses_after_approval(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.PROGRAM,
            target_path="xx/programs/oas.yaml",
            content={"program_id": "oas"},
            author="alice",
        )
        store.approve(d.id, approver="approver")
        try:
            store.update_content(
                d.id, content={"program_id": "oas", "x": 1}, editor="bob"
            )
        except Exception as e:  # AuthoringError -> ValueError
            assert "cannot edit" in str(e)
        else:
            raise AssertionError("expected AuthoringError on approved-draft edit")

    def test_discard_pending_draft(self, tmp_path: Path):
        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.JURISDICTION,
            target_path="pl/config/jurisdiction.yaml",
            content={"jurisdiction": {}},
            author="alice",
        )
        removed = store.discard(d.id)
        assert removed is True
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
# ADR-025 structural YAML emission
# ---------------------------------------------------------------------------


class TestStructuralYAMLEmission:
    """L4 / ADR-025: commit_approved preserves comments + ordering on
    unchanged keys; a no-op load-then-commit produces a zero-byte diff."""

    def _write(self, p: Path, body: str) -> None:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")

    def test_no_op_load_and_commit_yields_byte_identical_output(
        self, tmp_path: Path
    ):
        """The canonical L4 bar: load an existing canonical-shape file,
        commit its contents back unchanged, expect zero-byte diff."""
        target = tmp_path / "ca" / "programs" / "oas.yaml"
        canonical = (
            "# yaml-language-server: $schema=../../../schema/program-manifest-v1.0.json\n"
            "schema_version: '1.0'\n"
            "program_id: oas\n"
            "jurisdiction_id: jur-ca-federal\n"
            "name:\n"
            "  en: Old Age Security (OAS)\n"
            "  fr: Sécurité de la vieillesse\n"
            "authority_chain:\n"
            "  - id: auth-constitution\n"
            "    layer: constitution\n"
            "    title: Constitution Act, 1867\n"
        )
        self._write(target, canonical)
        # Load to plain dict (as the substrate stores), then commit back
        loaded = yaml.safe_load(canonical)
        out = _render_yaml_for_commit(target, loaded)
        assert out == canonical, (
            "no-op commit should be byte-identical to the source; got:\n"
            f"--- expected ---\n{canonical}--- got ---\n{out}"
        )

    def test_unchanged_keys_keep_their_comments(self, tmp_path: Path):
        """Only the changed key loses formatting metadata; other keys
        keep their inline + leading comments."""
        target = tmp_path / "ca" / "programs" / "oas.yaml"
        canonical = (
            "# Top-level comment block.\n"
            "schema_version: '1.0'\n"
            "program_id: oas  # inline comment on program_id\n"
            "status: active\n"
            "# A comment that introduces name.\n"
            "name:\n"
            "  en: Old Age Security\n"
        )
        self._write(target, canonical)
        loaded = yaml.safe_load(canonical)
        # Change only `status`.
        loaded["status"] = "deprecated"
        out = _render_yaml_for_commit(target, loaded)
        # The unchanged keys keep their comments.
        assert "# Top-level comment block." in out
        assert "# inline comment on program_id" in out
        assert "# A comment that introduces name." in out
        # The changed value landed.
        assert "status: deprecated" in out
        assert "status: active" not in out

    def test_added_key_lands_at_end(self, tmp_path: Path):
        """A net-new top-level key gets appended; the prior keys keep
        their order + comments."""
        target = tmp_path / "ca" / "programs" / "oas.yaml"
        canonical = (
            "schema_version: '1.0'\n"
            "program_id: oas\n"
            "# comment on status\n"
            "status: active\n"
        )
        self._write(target, canonical)
        loaded = yaml.safe_load(canonical)
        loaded["description"] = {"en": "Federal pension."}
        out = _render_yaml_for_commit(target, loaded)
        assert "# comment on status" in out
        assert "description:" in out
        # The new key sits after the prior keys, not before.
        idx_status = out.index("status:")
        idx_desc = out.index("description:")
        assert idx_status < idx_desc

    def test_removed_key_drops_value_but_leaves_orphan_comment(
        self, tmp_path: Path
    ):
        """Draft is the full file -- a key the draft omits is removed
        from the projected output. The key's *leading* comment may
        persist as an orphan because ruamel attaches it to the prior
        key's post-comment slot, not the deleted key's slot. This is a
        known ruamel round-trip behaviour; surfacing here as a pinned
        contract rather than a regression so future readers aren't
        surprised."""
        target = tmp_path / "ca" / "programs" / "oas.yaml"
        canonical = (
            "schema_version: '1.0'\n"
            "program_id: oas\n"
            "# soon-to-be-removed\n"
            "status: active\n"
        )
        self._write(target, canonical)
        loaded = yaml.safe_load(canonical)
        del loaded["status"]
        out = _render_yaml_for_commit(target, loaded)
        # The value is gone -- that's the load-bearing assertion.
        assert "status:" not in out
        # The orphan comment may persist (ruamel quirk). We don't assert
        # either way; the test pins the value-removal contract only.

    def test_new_file_falls_back_to_clean_dump(self, tmp_path: Path):
        """No existing target -> nothing to round-trip against; clean
        ruamel dump from the draft content."""
        target = tmp_path / "xx" / "programs" / "oas.yaml"
        loaded = {"schema_version": "1.0", "program_id": "oas"}
        out = _render_yaml_for_commit(target, loaded)
        assert "schema_version: '1.0'" in out
        assert "program_id: oas" in out

    def test_commit_approved_emits_structurally_through_draftstore(
        self, tmp_path: Path
    ):
        """End-to-end: a draft committed through DraftStore.commit_approved
        uses the structural emitter (zero-byte no-op diff on unchanged
        content)."""
        target = tmp_path / "ca" / "programs" / "oas.yaml"
        canonical = (
            "schema_version: '1.0'\n"
            "program_id: oas\n"
            "# preserve me\n"
            "status: active\n"
        )
        self._write(target, canonical)

        store = DraftStore(tmp_path)
        d = store.create(
            type=DraftType.PROGRAM,
            target_path="ca/programs/oas.yaml",
            content=yaml.safe_load(canonical),
            author="alice",
        )
        store.approve(d.id, approver="approver")
        committed = store.commit_approved(committer="committer")
        assert len(committed) == 1
        assert target.read_text(encoding="utf-8") == canonical


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

    def test_create_409_on_same_target_path(self, client):
        """ADR-023: HTTP layer surfaces TargetPathConflict as 409 with
        the colliding draft id in the body so the UI can route the
        operator to resolve it."""
        first_body = {
            "type": "program",
            "target_path": "xx/programs/oas.yaml",
            "content": _minimal_program_manifest("xx"),
            "author": "alice",
        }
        r = client.post("/api/authoring/drafts", json=first_body)
        assert r.status_code == 200, r.text
        first_id = r.json()["id"]

        # Second create against the same target_path -> 409.
        second_body = dict(first_body, author="bob")
        r2 = client.post("/api/authoring/drafts", json=second_body)
        assert r2.status_code == 409, r2.text
        detail = r2.json()["detail"]
        assert detail["target_path"] == "xx/programs/oas.yaml"
        assert detail["conflicting_draft_id"] == first_id

        # After the first is rejected, the path frees and second create
        # succeeds.
        client.post(
            f"/api/authoring/drafts/{first_id}/reject",
            json={"rejector": "reviewer", "reason": "stale"},
        )
        r3 = client.post("/api/authoring/drafts", json=second_body)
        assert r3.status_code == 200
        assert r3.json()["id"] != first_id

    def test_patch_updates_pending_draft(self, client):
        r = client.post(
            "/api/authoring/drafts",
            json={
                "type": "program",
                "target_path": "xx/programs/oas.yaml",
                "content": _minimal_program_manifest("xx"),
                "author": "alice",
            },
        )
        assert r.status_code == 200
        did = r.json()["id"]
        new_content = _minimal_program_manifest("xx")
        new_content["authority_chain"].append(
            {
                "id": "auth-xx-oas-regs",
                "layer": "regulation",
                "title": "Pension Regulations",
                "citation": "Pension Regs",
                "effective_date": "1900-01-01",
                "url": "https://example.org/regs",
                "parent": "auth-xx-oas-act",
            }
        )
        patch = client.patch(
            f"/api/authoring/drafts/{did}",
            json={
                "content": new_content,
                "editor": "bob",
                "rationale": "add regulation tier",
            },
        )
        assert patch.status_code == 200, patch.text
        body = patch.json()
        assert body["status"] == "pending"
        assert len(body["content"]["authority_chain"]) == 3
        assert body["author"] == "bob"
        assert body["rationale"] == "add regulation tier"

    def test_patch_refuses_after_approval(self, client):
        r = client.post(
            "/api/authoring/drafts",
            json={
                "type": "program",
                "target_path": "xx/programs/oas.yaml",
                "content": _minimal_program_manifest("xx"),
                "author": "alice",
            },
        )
        did = r.json()["id"]
        client.post(
            f"/api/authoring/drafts/{did}/approve",
            json={"approver": "approver"},
        )
        patch = client.patch(
            f"/api/authoring/drafts/{did}",
            json={
                "content": _minimal_program_manifest("xx"),
                "editor": "bob",
            },
        )
        assert patch.status_code == 409

    def test_patch_unknown_returns_404(self, client):
        patch = client.patch(
            "/api/authoring/drafts/does-not-exist",
            json={"content": {"x": 1}, "editor": "bob"},
        )
        assert patch.status_code == 404

    def test_patch_400_on_non_object_content(self, client):
        r = client.post(
            "/api/authoring/drafts",
            json={
                "type": "program",
                "target_path": "xx/programs/oas.yaml",
                "content": _minimal_program_manifest("xx"),
                "author": "alice",
            },
        )
        did = r.json()["id"]
        patch = client.patch(
            f"/api/authoring/drafts/{did}",
            json={"content": "not-a-dict", "editor": "bob"},
        )
        assert patch.status_code == 400

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


# ---------------------------------------------------------------------------
# Scaffold helper (v3.1.x L12)
# ---------------------------------------------------------------------------


class TestAuthoringScaffold:
    def test_scaffold_returns_jurisdiction_plus_oas_by_default(self, client):
        r = client.post(
            "/api/authoring/scaffold/jurisdiction",
            json={"code": "pl"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["jurisdiction"]["target_path"] == "pl/config/jurisdiction.yaml"
        assert "jurisdiction" in body["jurisdiction"]["content"]
        assert body["jurisdiction"]["content"]["jurisdiction"]["country"] == "PL"
        assert len(body["programs"]) == 1
        assert body["programs"][0]["program_id"] == "oas"
        assert body["programs"][0]["target_path"] == "pl/programs/oas.yaml"

    def test_scaffold_with_ei_returns_both(self, client):
        r = client.post(
            "/api/authoring/scaffold/jurisdiction",
            json={"code": "pl", "shapes": ["oas", "ei"]},
        )
        body = r.json()
        ids = [p["program_id"] for p in body["programs"]]
        assert ids == ["oas", "ei"]

    def test_scaffold_writes_nothing_to_disk(self, client, tmp_path):
        client.post(
            "/api/authoring/scaffold/jurisdiction",
            json={"code": "pl"},
        )
        # No file in tmp_path/pl/ -- scaffold is pure in-memory.
        assert not (tmp_path / "pl").exists()

    def test_scaffold_rejects_invalid_code(self, client):
        for bad in ["", "123", "toolongcountry"]:
            r = client.post(
                "/api/authoring/scaffold/jurisdiction",
                json={"code": bad},
            )
            assert r.status_code == 400, f"code={bad!r} unexpectedly accepted"

    def test_scaffold_rejects_unknown_shape(self, client):
        r = client.post(
            "/api/authoring/scaffold/jurisdiction",
            json={"code": "pl", "shapes": ["asylum"]},
        )
        assert r.status_code == 400

    def test_scaffold_output_round_trips_through_create_draft(self, client):
        """Wizard contract: the scaffolded content shape can be POSTed
        directly to /api/authoring/drafts without transformation."""
        scaffold = client.post(
            "/api/authoring/scaffold/jurisdiction",
            json={"code": "pl"},
        ).json()
        r = client.post(
            "/api/authoring/drafts",
            json={
                "type": "jurisdiction",
                "target_path": scaffold["jurisdiction"]["target_path"],
                "content": scaffold["jurisdiction"]["content"],
                "author": "alice",
            },
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending"
