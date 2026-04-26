"""ConfigValue substrate for Law-as-Code v2.0.

Effective-dated key/value records resolved by (key, evaluation_date, jurisdiction_id).
Behaviour changes are configuration writes; old evaluations remain reproducible.

Key schema (per ADR-006): <jurisdiction>-<program>.<domain>.<scope>.<param>
  ca-oas.rule.age-65.min_age
  global.ui.label.cases.title
  global.prompt.encoder.extraction_system

Storage is in-memory (per ADR-007). State is reseeded on startup.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field
from ulid import ULID


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_ulid() -> str:
    return str(ULID())


GLOBAL_SCOPE = "global"


class ValueType(str, Enum):
    NUMBER = "number"
    STRING = "string"
    BOOL = "bool"
    LIST = "list"
    ENUM = "enum"
    PROMPT = "prompt"
    FORMULA = "formula"


class ApprovalStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ConfigValue(BaseModel):
    """A single dated configuration record.

    Resolution: a `ConfigValue` is in effect for `key` at `evaluation_date` if
    `effective_from <= evaluation_date` and (`effective_to is None` or
    `evaluation_date < effective_to`).

    Per ADR-006, granularity is per-parameter — one record per leaf value.
    """

    id: str = Field(default_factory=_new_ulid)
    domain: str  # "rule" | "enum" | "ui" | "prompt" | "engine" | ...
    key: str  # full dotted key, e.g. "ca-oas.rule.age-65.min_age"
    jurisdiction_id: Optional[str] = None  # None or "global" for cross-jurisdictional
    value: Any = None
    value_type: ValueType
    effective_from: datetime
    effective_to: Optional[datetime] = None
    citation: Optional[str] = None
    author: str = "system"
    approved_by: Optional[str] = None
    rationale: str = ""
    supersedes: Optional[str] = None  # id of prior version, if any
    status: ApprovalStatus = ApprovalStatus.APPROVED
    language: Optional[str] = None  # for ui labels: "en", "fr", etc.
    created_at: datetime = Field(default_factory=_utcnow)


class ConfigResolution(BaseModel):
    """Audit record of a single resolve() call during evaluation."""

    key: str
    jurisdiction_id: Optional[str] = None
    evaluation_date: datetime
    resolved_value_id: Optional[str] = None  # None if no record found
    resolved_at: datetime = Field(default_factory=_utcnow)


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------


def _normalize_scope(jurisdiction_id: Optional[str]) -> Optional[str]:
    """Treat ``None`` and the literal ``"global"`` as the same scope."""
    if jurisdiction_id == GLOBAL_SCOPE:
        return None
    return jurisdiction_id


class ConfigStore:
    """In-memory store for ConfigValue records.

    Threading: not safe for concurrent writes. FastAPI runs single-process by
    default; this is documented as a constraint of v2.0 (ADR-007).
    """

    def __init__(self) -> None:
        self._by_id: dict[str, ConfigValue] = {}

    # --- write ---

    def put(self, value: ConfigValue) -> str:
        """Insert a ConfigValue. Returns the id."""
        self._by_id[value.id] = value
        return value.id

    def supersede(
        self,
        prior_id: str,
        new_value: Any,
        effective_from: datetime,
        author: str,
        approved_by: Optional[str] = None,
        rationale: str = "",
        citation: Optional[str] = None,
    ) -> ConfigValue:
        """Create a new version superseding a prior one.

        Closes the prior record's ``effective_to`` to the new record's
        ``effective_from`` and inserts the new record.
        """
        prior = self._by_id.get(prior_id)
        if prior is None:
            raise KeyError(f"No ConfigValue with id={prior_id}")
        prior.effective_to = effective_from
        new_record = ConfigValue(
            domain=prior.domain,
            key=prior.key,
            jurisdiction_id=prior.jurisdiction_id,
            value=new_value,
            value_type=prior.value_type,
            effective_from=effective_from,
            effective_to=None,
            citation=citation if citation is not None else prior.citation,
            author=author,
            approved_by=approved_by,
            rationale=rationale,
            supersedes=prior.id,
            status=ApprovalStatus.APPROVED if approved_by else ApprovalStatus.PENDING,
            language=prior.language,
        )
        self.put(new_record)
        return new_record

    # --- read ---

    def get(self, value_id: str) -> Optional[ConfigValue]:
        return self._by_id.get(value_id)

    def list(
        self,
        domain: Optional[str] = None,
        key_prefix: Optional[str] = None,
        jurisdiction_id: Optional[str] = None,
        language: Optional[str] = None,
    ) -> list[ConfigValue]:
        scope = _normalize_scope(jurisdiction_id)
        out: list[ConfigValue] = []
        for v in self._by_id.values():
            if domain is not None and v.domain != domain:
                continue
            if key_prefix is not None and not v.key.startswith(key_prefix):
                continue
            if jurisdiction_id is not None and _normalize_scope(v.jurisdiction_id) != scope:
                continue
            if language is not None and v.language != language:
                continue
            out.append(v)
        out.sort(key=lambda r: (r.key, r.effective_from))
        return out

    def list_versions(
        self,
        key: str,
        jurisdiction_id: Optional[str] = None,
        language: Optional[str] = None,
    ) -> list[ConfigValue]:
        scope = _normalize_scope(jurisdiction_id)
        out = [
            v
            for v in self._by_id.values()
            if v.key == key
            and _normalize_scope(v.jurisdiction_id) == scope
            and (language is None or v.language == language)
        ]
        out.sort(key=lambda r: r.effective_from)
        return out

    def resolve(
        self,
        key: str,
        evaluation_date: datetime,
        jurisdiction_id: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Optional[ConfigValue]:
        """Return the ConfigValue in effect for the given key on evaluation_date.

        Effective semantics:
            effective_from <= evaluation_date AND
            (effective_to is None OR evaluation_date < effective_to)

        Only records with status=APPROVED participate in resolution. If multiple
        records satisfy the window (which should not happen with disciplined
        supersession), the latest by effective_from wins.

        If no jurisdiction record matches and ``jurisdiction_id`` is not the
        global scope, the resolver falls back to the global scope.
        """
        candidates = self._candidates_for(key, jurisdiction_id, language, evaluation_date)
        if candidates:
            return max(candidates, key=lambda r: r.effective_from)
        # Fallback to global scope if a jurisdictional read missed.
        if _normalize_scope(jurisdiction_id) is not None:
            global_candidates = self._candidates_for(key, None, language, evaluation_date)
            if global_candidates:
                return max(global_candidates, key=lambda r: r.effective_from)
        return None

    def _candidates_for(
        self,
        key: str,
        jurisdiction_id: Optional[str],
        language: Optional[str],
        evaluation_date: datetime,
    ) -> list[ConfigValue]:
        scope = _normalize_scope(jurisdiction_id)
        out: list[ConfigValue] = []
        for v in self._by_id.values():
            if v.key != key:
                continue
            if _normalize_scope(v.jurisdiction_id) != scope:
                continue
            if language is not None and v.language != language:
                continue
            if v.status != ApprovalStatus.APPROVED:
                continue
            if v.effective_from > evaluation_date:
                continue
            if v.effective_to is not None and evaluation_date >= v.effective_to:
                continue
            out.append(v)
        return out

    # --- introspection ---

    def __len__(self) -> int:
        return len(self._by_id)

    def all(self) -> list[ConfigValue]:
        out = list(self._by_id.values())
        out.sort(key=lambda r: (r.key, r.effective_from))
        return out

    def clear(self) -> None:
        self._by_id.clear()
