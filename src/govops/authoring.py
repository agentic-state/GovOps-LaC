"""ADR-022 authoring substrate -- draft / approve / commit for non-ConfigValue records.

v3.0 made ``lawcode/`` the source of truth for ConfigValue records;
v3.1 L3 (ADR-020) extended that to the ``JURISDICTION_REGISTRY``
discovery layer. This module closes the last hole: ``jurisdiction.yaml``
plus program manifests themselves are now draft-able through the same
draft / approve / commit pattern ConfigValue admin uses.

For the v3.1 demo bar:
- Drafts live in-memory (DraftStore) mirroring ConfigStore's Phase-1
  shape.
- Persistence is file-per-draft under ``lawcode/.drafts/<id>.yaml`` so
  drafts survive restart. No SQLite; the Phase-6 substrate gate
  (ADR-007 / ADR-010) does not apply.
- ``commit_approved()`` writes the approved drafts to disk under
  ``lawcode/<code>/...`` and the caller is expected to invoke
  ``govops.jurisdictions.reload_registry()`` afterwards so the new
  content appears in the running app immediately.
- Concurrent drafts targeting the same path: the last-writer-by-
  ``created_at`` wins; earlier ones are committed first then overwritten.
  Explicit conflict handling is a v3.2 hardening item.

Initial record types:
- ``DraftType.JURISDICTION`` -> ``lawcode/<code>/config/jurisdiction.yaml``
- ``DraftType.PROGRAM``      -> ``lawcode/<code>/programs/<id>.yaml``

Other lawcode files (ConfigValue YAML under ``config/<id>-rules.yaml``)
already have their own draft-approve-commit substrate via ``ConfigStore``;
this module deliberately does not duplicate it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional
import uuid

import yaml


class DraftType(str, Enum):
    JURISDICTION = "jurisdiction"
    PROGRAM = "program"


class DraftStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMMITTED = "committed"


@dataclass
class Draft:
    id: str
    type: DraftType
    target_path: str  # relative to lawcode/, e.g. "pl/config/jurisdiction.yaml"
    content: dict[str, Any]
    status: DraftStatus
    author: str
    rationale: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejected_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    committed_at: Optional[datetime] = None
    committed_by: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "target_path": self.target_path,
            "content": self.content,
            "status": self.status.value,
            "author": self.author,
            "rationale": self.rationale,
            "created_at": self.created_at.isoformat(),
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "approved_by": self.approved_by,
            "rejected_at": self.rejected_at.isoformat() if self.rejected_at else None,
            "rejected_by": self.rejected_by,
            "rejection_reason": self.rejection_reason,
            "committed_at": self.committed_at.isoformat() if self.committed_at else None,
            "committed_by": self.committed_by,
        }


class AuthoringError(ValueError):
    """Raised for any authoring substrate refusal: missing draft, wrong
    status transition, malformed input."""


class DraftStore:
    """In-memory draft store with file-per-draft persistence.

    On instantiation, walks ``lawcode/.drafts/`` and rehydrates any
    previously-persisted drafts so a restart preserves authoring state.
    """

    def __init__(self, lawcode_root: Path):
        self._lawcode_root = lawcode_root
        self._drafts_dir = lawcode_root / ".drafts"
        self._drafts: dict[str, Draft] = {}
        self._rehydrate_from_disk()

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _rehydrate_from_disk(self) -> None:
        if not self._drafts_dir.exists():
            return
        for p in sorted(self._drafts_dir.glob("*.yaml")):
            try:
                doc = yaml.safe_load(p.read_text(encoding="utf-8"))
                d = self._from_dict(doc)
                self._drafts[d.id] = d
            except Exception:  # noqa: BLE001
                # Malformed draft file -- skip; do not crash boot.
                pass

    def _persist(self, draft: Draft) -> None:
        self._drafts_dir.mkdir(parents=True, exist_ok=True)
        out_path = self._drafts_dir / f"{draft.id}.yaml"
        out_path.write_text(
            yaml.safe_dump(draft.to_dict(), sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )

    def _delete_persisted(self, draft_id: str) -> None:
        out_path = self._drafts_dir / f"{draft_id}.yaml"
        if out_path.exists():
            out_path.unlink()

    @staticmethod
    def _from_dict(d: dict[str, Any]) -> Draft:
        def _dt(k: str) -> Optional[datetime]:
            v = d.get(k)
            return datetime.fromisoformat(v) if v else None

        return Draft(
            id=d["id"],
            type=DraftType(d["type"]),
            target_path=d["target_path"],
            content=d["content"],
            status=DraftStatus(d["status"]),
            author=d["author"],
            rationale=d.get("rationale"),
            created_at=_dt("created_at") or datetime.now(timezone.utc),
            approved_at=_dt("approved_at"),
            approved_by=d.get("approved_by"),
            rejected_at=_dt("rejected_at"),
            rejected_by=d.get("rejected_by"),
            rejection_reason=d.get("rejection_reason"),
            committed_at=_dt("committed_at"),
            committed_by=d.get("committed_by"),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create(
        self,
        *,
        type: DraftType,
        target_path: str,
        content: dict[str, Any],
        author: str,
        rationale: Optional[str] = None,
    ) -> Draft:
        if not target_path or target_path.startswith("/") or ".." in target_path:
            raise AuthoringError(
                "target_path must be a relative path inside lawcode/"
            )
        if not author:
            raise AuthoringError("author required")
        if not isinstance(content, dict):
            raise AuthoringError("content must be a mapping")

        # Path discipline by type.
        if type == DraftType.JURISDICTION and not target_path.endswith("/config/jurisdiction.yaml"):
            raise AuthoringError(
                "jurisdiction drafts must target <code>/config/jurisdiction.yaml"
            )
        if type == DraftType.PROGRAM and "/programs/" not in target_path:
            raise AuthoringError(
                "program drafts must target <code>/programs/<id>.yaml"
            )

        d = Draft(
            id=uuid.uuid4().hex[:12],
            type=type,
            target_path=target_path,
            content=content,
            status=DraftStatus.PENDING,
            author=author,
            rationale=rationale,
        )
        self._drafts[d.id] = d
        self._persist(d)
        return d

    def get(self, draft_id: str) -> Optional[Draft]:
        return self._drafts.get(draft_id)

    def list(
        self,
        *,
        type: Optional[DraftType] = None,
        status: Optional[DraftStatus] = None,
    ) -> list[Draft]:
        out = list(self._drafts.values())
        if type is not None:
            out = [d for d in out if d.type == type]
        if status is not None:
            out = [d for d in out if d.status == status]
        return sorted(out, key=lambda d: d.created_at)

    def update_content(
        self,
        draft_id: str,
        *,
        content: dict[str, Any],
        editor: str,
        rationale: Optional[str] = None,
    ) -> Draft:
        """Replace the draft payload while the draft is still PENDING.

        Refuses on APPROVED / REJECTED / COMMITTED -- approval clears the
        edit window, matching ConfigValue admin's draft-immutability rule.
        Used by the structured editors (L9 authority chain, L10 legal
        documents, L11 demo cases) to mutate slices of the program
        manifest without recreating the draft.
        """
        d = self._drafts.get(draft_id)
        if d is None:
            raise AuthoringError(f"draft not found: {draft_id}")
        if d.status != DraftStatus.PENDING:
            raise AuthoringError(
                f"cannot edit draft in status {d.status.value}"
            )
        if not editor:
            raise AuthoringError("editor required")
        if not isinstance(content, dict):
            raise AuthoringError("content must be a mapping")
        d.content = content
        if rationale is not None:
            d.rationale = rationale
        d.author = editor
        self._persist(d)
        return d

    def approve(self, draft_id: str, approver: str) -> Draft:
        d = self._drafts.get(draft_id)
        if d is None:
            raise AuthoringError(f"draft not found: {draft_id}")
        if d.status == DraftStatus.APPROVED:
            return d  # idempotent
        if d.status != DraftStatus.PENDING:
            raise AuthoringError(
                f"cannot approve draft in status {d.status.value}"
            )
        if not approver:
            raise AuthoringError("approver required")
        d.status = DraftStatus.APPROVED
        d.approved_at = datetime.now(timezone.utc)
        d.approved_by = approver
        self._persist(d)
        return d

    def reject(self, draft_id: str, rejector: str, reason: str) -> Draft:
        d = self._drafts.get(draft_id)
        if d is None:
            raise AuthoringError(f"draft not found: {draft_id}")
        if d.status == DraftStatus.REJECTED:
            return d  # idempotent
        if d.status not in (DraftStatus.PENDING, DraftStatus.APPROVED):
            raise AuthoringError(
                f"cannot reject draft in status {d.status.value}"
            )
        if not rejector:
            raise AuthoringError("rejector required")
        if not reason or not reason.strip():
            raise AuthoringError("rejection reason required")
        d.status = DraftStatus.REJECTED
        d.rejected_at = datetime.now(timezone.utc)
        d.rejected_by = rejector
        d.rejection_reason = reason.strip()
        self._persist(d)
        return d

    def commit_approved(self, committer: str) -> list[Draft]:
        """Write all currently-approved drafts to disk under
        ``lawcode/<code>/...`` and mark them COMMITTED. Returns the list
        of drafts that were committed. After this returns, the caller
        SHOULD invoke ``govops.jurisdictions.reload_registry()`` so
        ``JURISDICTION_REGISTRY`` picks up the new content.

        Concurrent drafts targeting the same target_path: sorted by
        ``created_at``, the later-created one wins on disk because it
        overwrites the earlier one. Both are marked COMMITTED. v3.2
        hardening should refuse same-path conflicts explicitly.
        """
        if not committer:
            raise AuthoringError("committer required")
        approved = [d for d in self._drafts.values() if d.status == DraftStatus.APPROVED]
        if not approved:
            return []
        approved.sort(key=lambda d: d.created_at)
        committed: list[Draft] = []
        now = datetime.now(timezone.utc)
        for d in approved:
            target = self._lawcode_root / d.target_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(
                yaml.safe_dump(d.content, sort_keys=False, allow_unicode=True),
                encoding="utf-8",
            )
            d.status = DraftStatus.COMMITTED
            d.committed_at = now
            d.committed_by = committer
            self._persist(d)
            committed.append(d)
        return committed

    def discard(self, draft_id: str) -> bool:
        """Remove a non-committed draft from the store and the
        filesystem. Returns True if a draft was removed, False if not
        present. Raises AuthoringError if the draft is COMMITTED.

        Used by wizard cancel flows and the v3.1 E2E spec's teardown.
        """
        d = self._drafts.get(draft_id)
        if d is None:
            return False
        if d.status == DraftStatus.COMMITTED:
            raise AuthoringError("cannot discard a committed draft")
        del self._drafts[draft_id]
        self._delete_persisted(draft_id)
        return True

    def clear(self) -> None:
        """Test-only escape hatch: drop every draft (in-memory and
        on-disk). Mirrors ``ConfigStore.clear()``."""
        for did in list(self._drafts.keys()):
            self._delete_persisted(did)
        self._drafts.clear()
