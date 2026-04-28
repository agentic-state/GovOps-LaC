"""ConfigValue substrate for Law-as-Code v2.0.

Effective-dated key/value records resolved by (key, evaluation_date, jurisdiction_id).
Behaviour changes are configuration writes; old evaluations remain reproducible.

Key schema (per ADR-006): <jurisdiction>-<program>.<domain>.<scope>.<param>
  ca-oas.rule.age-65.min_age
  global.ui.label.cases.title
  global.prompt.encoder.extraction_system

Storage is SQLite via SQLModel from Phase 6 onward (per ADR-010). YAML under
`lawcode/` remains the authored source-of-truth; the DB is hydrated from it on
startup and runtime writes (POST /api/config/values, /approve, etc.) survive
process restarts. Tests use `:memory:` SQLite (each ``ConfigStore()`` with no
db_path argument creates its own in-memory engine, isolated from siblings).

Phase 2 backcompat (per ADR-004): ``resolve_value()`` is a two-tier resolver —
substrate first, then ``LEGACY_CONSTANTS``. ``AIA_CONFIG_STRICT=1`` raises
``ConfigKeyNotMigrated`` whenever the legacy tier matches, which CI flips on at
Phase 2 exit so unmigrated keys can't slip through.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, NamedTuple, Optional

from pydantic import BaseModel
from sqlalchemy import JSON, Column, DateTime, delete, func
from sqlalchemy.pool import StaticPool
from sqlmodel import Field, Session, SQLModel, create_engine, select
from ulid import ULID


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_ulid() -> str:
    return str(ULID())


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite strips tzinfo on read; reattach UTC so resolve() comparisons stay tzaware."""
    if dt is None or dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=timezone.utc)


GLOBAL_SCOPE = "global"


class ValueType(str, Enum):
    NUMBER = "number"
    STRING = "string"
    BOOL = "bool"
    LIST = "list"
    OBJECT = "object"
    ENUM = "enum"
    PROMPT = "prompt"
    FORMULA = "formula"
    TEMPLATE = "template"  # ADR-012 — citizen-facing notice templates


class ApprovalStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ResolutionSource(str, Enum):
    """Which tier of ``ConfigStore.resolve_value()`` produced the answer."""

    SUBSTRATE = "substrate"
    LEGACY = "legacy"
    FEDERATED = "federated"


class ConfigKeyNotMigrated(KeyError):
    """Raised in strict mode when a key is missing from the substrate."""


_MISSING: Any = object()


# Phase-2 legacy tier: drained at Phase 2 exit; kept as a global dict because the
# fallback registry is process-wide, not per-store.
LEGACY_CONSTANTS: dict[str, Any] = {}


def register_legacy(key: str, value: Any) -> None:
    """Register a legacy default. Idempotent within a process."""
    LEGACY_CONSTANTS[key] = value


def is_strict_mode() -> bool:
    """True when AIA_CONFIG_STRICT=1 is set."""
    return os.environ.get("AIA_CONFIG_STRICT") == "1"


# ---------------------------------------------------------------------------
# Schema (SQLModel tables)
# ---------------------------------------------------------------------------


class ConfigValue(SQLModel, table=True):
    """A single dated configuration record.

    Resolution: a record is in effect for ``key`` at ``evaluation_date`` if
    ``effective_from <= evaluation_date`` and (``effective_to is None`` or
    ``evaluation_date < effective_to``).

    Per ADR-006, granularity is per-parameter — one record per leaf value.
    Per ADR-010, this is a SQLModel table; ``value`` is stored as JSON so the
    column tolerates numbers, strings, lists, and dicts uniformly.
    """

    __tablename__ = "config_value"

    id: str = Field(default_factory=_new_ulid, primary_key=True)
    domain: str = Field(index=True)
    key: str = Field(index=True)
    jurisdiction_id: Optional[str] = Field(default=None, index=True)
    value: Any = Field(default=None, sa_column=Column(JSON))
    value_type: ValueType
    effective_from: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True)
    )
    effective_to: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    citation: Optional[str] = Field(default=None, index=True)
    author: str = "system"
    approved_by: Optional[str] = None
    rationale: str = ""
    supersedes: Optional[str] = None
    status: ApprovalStatus = ApprovalStatus.APPROVED
    language: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    # Phase 8 / ADR-009 — federation provenance. All four are loader-set;
    # `None` everywhere means the record originated from local YAML.
    source_publisher: Optional[str] = Field(default=None, index=True)
    source_repo: Optional[str] = None
    source_commit: Optional[str] = None
    fetched_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    # Tri-state: True = signed manifest verified; False = --allow-unsigned;
    # None = local origin (never went through federation).
    source_signed: Optional[bool] = None


class ApprovalAuditEntry(SQLModel, table=True):
    """Audit row for approval-flow transitions on a ConfigValue.

    Persisted so an approval trail survives restart (per ADR-010 §Decision).
    """

    __tablename__ = "approval_audit"

    id: str = Field(default_factory=_new_ulid, primary_key=True)
    config_value_id: str = Field(index=True)
    event: str  # "draft_created" | "submitted" | "approved" | "request_changes" | "rejected"
    actor: str
    comment: str = ""
    timestamp: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


# Pydantic-only (in-flight, not persisted): used by the engine to record what
# resolve() returned during an evaluation. Stays a pure model.
class ConfigResolution(BaseModel):
    key: str
    jurisdiction_id: Optional[str] = None
    evaluation_date: datetime
    resolved_value_id: Optional[str] = None
    source: Optional[ResolutionSource] = None
    resolved_at: datetime = datetime.now(timezone.utc)


class ResolutionResult(NamedTuple):
    value: Any
    source: Optional[ResolutionSource]


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------


def _normalize_scope(jurisdiction_id: Optional[str]) -> Optional[str]:
    """Treat ``None`` and the literal ``"global"`` as the same scope."""
    if jurisdiction_id == GLOBAL_SCOPE:
        return None
    return jurisdiction_id


def _scope_filter(scope: Optional[str]):
    """Return a SQLAlchemy boolean clause for ``ConfigValue.jurisdiction_id``.

    ``scope`` is the *normalized* scope (None for global, full id otherwise).
    Records may be stored either as NULL or as the literal ``"global"`` string —
    both are treated as the global scope. Storage tolerates both shapes; queries
    must match both shapes when looking up the global scope.
    """
    from sqlalchemy import or_

    if scope is None:
        return or_(
            ConfigValue.jurisdiction_id.is_(None),
            ConfigValue.jurisdiction_id == GLOBAL_SCOPE,
        )
    return ConfigValue.jurisdiction_id == scope


class ConfigStore:
    """SQLite-backed store for ConfigValue records (per ADR-010).

    ``ConfigStore()`` with no argument creates a private in-memory engine —
    the right default for tests. Production code passes ``db_path`` (or sets
    ``GOVOPS_DB_PATH``) to point at a persistent file.
    """

    def __init__(self, db_path: Optional[str] = None) -> None:
        if db_path is None:
            self.engine = create_engine(
                "sqlite://",
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
            )
        else:
            self.engine = create_engine(
                f"sqlite:///{db_path}",
                connect_args={"check_same_thread": False},
            )
        SQLModel.metadata.create_all(self.engine)

    # --- session ---

    def _session(self) -> Session:
        return Session(self.engine)

    # --- write ---

    def put(self, value: ConfigValue) -> str:
        """Insert (or upsert by id) a ConfigValue. Returns the id."""
        with self._session() as s:
            s.merge(value)
            s.commit()
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
        with self._session() as s:
            prior = s.get(ConfigValue, prior_id)
            if prior is None:
                raise KeyError(f"No ConfigValue with id={prior_id}")
            prior.effective_to = effective_from
            s.add(prior)

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
            s.add(new_record)
            s.commit()
            s.refresh(new_record)
            new_record.effective_from = _ensure_utc(new_record.effective_from)
            new_record.effective_to = _ensure_utc(new_record.effective_to)
            new_record.created_at = _ensure_utc(new_record.created_at)
            return new_record

    def record_audit(
        self,
        config_value_id: str,
        event: str,
        actor: str,
        comment: str = "",
    ) -> ApprovalAuditEntry:
        """Append an approval-audit row (per ADR-010)."""
        entry = ApprovalAuditEntry(
            config_value_id=config_value_id,
            event=event,
            actor=actor,
            comment=comment,
        )
        with self._session() as s:
            s.add(entry)
            s.commit()
            s.refresh(entry)
            entry.timestamp = _ensure_utc(entry.timestamp)
            return entry

    def list_audit(
        self,
        config_value_id: Optional[str] = None,
    ) -> list[ApprovalAuditEntry]:
        with self._session() as s:
            stmt = select(ApprovalAuditEntry)
            if config_value_id is not None:
                stmt = stmt.where(ApprovalAuditEntry.config_value_id == config_value_id)
            rows = list(s.exec(stmt))
            for r in rows:
                r.timestamp = _ensure_utc(r.timestamp)
            rows.sort(key=lambda r: r.timestamp)
            return rows

    # --- read ---

    def get(self, value_id: str) -> Optional[ConfigValue]:
        with self._session() as s:
            cv = s.get(ConfigValue, value_id)
            if cv is None:
                return None
            cv.effective_from = _ensure_utc(cv.effective_from)
            cv.effective_to = _ensure_utc(cv.effective_to)
            cv.created_at = _ensure_utc(cv.created_at)
            return cv

    def list(
        self,
        domain: Optional[str] = None,
        key_prefix: Optional[str] = None,
        jurisdiction_id: Optional[str] = None,
        language: Optional[str] = None,
        status: Optional[ApprovalStatus] = None,
    ) -> list[ConfigValue]:
        with self._session() as s:
            stmt = select(ConfigValue)
            if domain is not None:
                stmt = stmt.where(ConfigValue.domain == domain)
            if key_prefix is not None:
                stmt = stmt.where(ConfigValue.key.like(f"{key_prefix}%"))
            if jurisdiction_id is not None:
                stmt = stmt.where(_scope_filter(_normalize_scope(jurisdiction_id)))
            if language is not None:
                stmt = stmt.where(ConfigValue.language == language)
            if status is not None:
                stmt = stmt.where(ConfigValue.status == status)
            rows = list(s.exec(stmt))
            for r in rows:
                r.effective_from = _ensure_utc(r.effective_from)
                r.effective_to = _ensure_utc(r.effective_to)
                r.created_at = _ensure_utc(r.created_at)
            rows.sort(key=lambda r: (r.key, r.effective_from))
            return rows

    def list_versions(
        self,
        key: str,
        jurisdiction_id: Optional[str] = None,
        language: Optional[str] = None,
    ) -> list[ConfigValue]:
        with self._session() as s:
            stmt = select(ConfigValue).where(
                ConfigValue.key == key,
                _scope_filter(_normalize_scope(jurisdiction_id)),
            )
            if language is not None:
                stmt = stmt.where(ConfigValue.language == language)
            rows = list(s.exec(stmt))
            for r in rows:
                r.effective_from = _ensure_utc(r.effective_from)
                r.effective_to = _ensure_utc(r.effective_to)
                r.created_at = _ensure_utc(r.created_at)
            rows.sort(key=lambda r: r.effective_from)
            return rows

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
        evaluation_date = _ensure_utc(evaluation_date)
        candidates = self._candidates_for(key, jurisdiction_id, language, evaluation_date)
        if candidates:
            return max(candidates, key=lambda r: r.effective_from)
        if _normalize_scope(jurisdiction_id) is not None:
            global_candidates = self._candidates_for(key, None, language, evaluation_date)
            if global_candidates:
                return max(global_candidates, key=lambda r: r.effective_from)
        return None

    def resolve_value(
        self,
        key: str,
        evaluation_date: Optional[datetime] = None,
        jurisdiction_id: Optional[str] = None,
        language: Optional[str] = None,
        default: Any = _MISSING,
    ) -> ResolutionResult:
        """Two-tier resolver per ADR-004 (Phase 2 backcompat).

        1. Substrate: query the SQLite store via ``resolve()``.
        2. Legacy: fall back to ``LEGACY_CONSTANTS[key]`` if present.
        3. Caller default: return ``default`` if supplied.
        4. Otherwise: ``None`` (lenient mode) or raise ``ConfigKeyNotMigrated``
           (when ``AIA_CONFIG_STRICT=1``).
        """
        eval_dt = evaluation_date or _utcnow()
        cv = self.resolve(key, eval_dt, jurisdiction_id, language)
        if cv is not None:
            return ResolutionResult(value=cv.value, source=ResolutionSource.SUBSTRATE)
        if key in LEGACY_CONSTANTS:
            if is_strict_mode():
                raise ConfigKeyNotMigrated(key)
            return ResolutionResult(value=LEGACY_CONSTANTS[key], source=ResolutionSource.LEGACY)
        if default is not _MISSING:
            return ResolutionResult(value=default, source=None)
        if is_strict_mode():
            raise ConfigKeyNotMigrated(key)
        return ResolutionResult(value=None, source=None)

    def _candidates_for(
        self,
        key: str,
        jurisdiction_id: Optional[str],
        language: Optional[str],
        evaluation_date: datetime,
    ) -> list[ConfigValue]:
        with self._session() as s:
            stmt = select(ConfigValue).where(
                ConfigValue.key == key,
                ConfigValue.status == ApprovalStatus.APPROVED,
                _scope_filter(_normalize_scope(jurisdiction_id)),
            )
            if language is not None:
                stmt = stmt.where(ConfigValue.language == language)
            rows = list(s.exec(stmt))
            out: list[ConfigValue] = []
            for r in rows:
                r.effective_from = _ensure_utc(r.effective_from)
                r.effective_to = _ensure_utc(r.effective_to)
                r.created_at = _ensure_utc(r.created_at)
                if r.effective_from > evaluation_date:
                    continue
                if r.effective_to is not None and evaluation_date >= r.effective_to:
                    continue
                out.append(r)
            return out

    # --- impact / citation search (Phase 7) ---

    def find_by_citation(self, citation: str) -> list[ConfigValue]:
        """Return ConfigValues whose citation contains ``citation`` (case-insensitive substring).

        Phase 7 reverse-index entry point: drives ``GET /api/impact?citation=…`` and the
        ``govops impact-of`` CLI. Excludes ``REJECTED`` records (they are tombstones of
        proposals that didn't make it into the substrate); ``DRAFT`` and ``PENDING``
        records are included so in-flight policy work shows up alongside approved values.

        Whitespace in the query is normalized to single spaces; the comparison is
        Python-side casefold so non-ASCII citations match consistently across the
        SQLite ICU/no-ICU split.
        """
        needle = " ".join(citation.split()).casefold()
        if not needle:
            return []
        with self._session() as s:
            stmt = select(ConfigValue).where(
                ConfigValue.citation.is_not(None),
                ConfigValue.status != ApprovalStatus.REJECTED,
            )
            rows = list(s.exec(stmt))
        out: list[ConfigValue] = []
        for r in rows:
            if r.citation is None:
                continue
            haystack = " ".join(r.citation.split()).casefold()
            if needle not in haystack:
                continue
            r.effective_from = _ensure_utc(r.effective_from)
            r.effective_to = _ensure_utc(r.effective_to)
            r.created_at = _ensure_utc(r.created_at)
            out.append(r)
        out.sort(key=lambda r: ((r.jurisdiction_id or ""), r.key, r.effective_from))
        return out

    # --- YAML loader (Phase 3 / ADR-003 / ADR-010 hydration) ---

    def load_from_yaml(
        self,
        path: "str | os.PathLike[str]",
        *,
        provenance: Optional[dict] = None,
    ) -> int:
        """Load ConfigValue records from a YAML file or directory tree.

        Per ADR-010 the loader is **idempotent**: a record is identified by
        ``(key, jurisdiction_id, effective_from, language)`` and is skipped if
        a row with the same natural key already exists. This means YAML never
        silently overwrites a runtime-edited row.

        Per ADR-009, ``provenance`` (when supplied) stamps every loaded
        record with federation metadata: ``source_publisher``,
        ``source_repo``, ``source_commit``, ``fetched_at``,
        ``source_signed``. ``provenance=None`` (the default) means
        local-origin records — all five fields stay None.

        Returns the count of records inserted (skipped duplicates do not count).
        """
        import yaml

        target = Path(path) if not isinstance(path, Path) else path
        if not target.exists():
            raise FileNotFoundError(f"lawcode path does not exist: {target}")

        files = (
            sorted(target.rglob("*.yaml")) + sorted(target.rglob("*.yml"))
            if target.is_dir()
            else [target]
        )

        inserted = 0
        for fp in files:
            with fp.open("r", encoding="utf-8") as fh:
                doc = yaml.safe_load(fh)
            if doc is None:
                continue
            if not isinstance(doc, dict) or "values" not in doc:
                raise ValueError(f"{fp}: expected top-level mapping with 'values' list")
            defaults: dict[str, Any] = doc.get("defaults") or {}
            for raw in doc["values"]:
                if not isinstance(raw, dict):
                    raise ValueError(
                        f"{fp}: each value must be a mapping, got {type(raw).__name__}"
                    )
                merged = {**defaults, **raw}
                cv = self._build_config_value(merged, source_file=fp)
                if provenance is not None:
                    cv.source_publisher = provenance.get("source_publisher")
                    cv.source_repo = provenance.get("source_repo")
                    cv.source_commit = provenance.get("source_commit")
                    cv.fetched_at = provenance.get("fetched_at")
                    cv.source_signed = provenance.get("source_signed")
                if self._exists_natural_key(cv):
                    continue
                self.put(cv)
                inserted += 1
        return inserted

    def _exists_natural_key(self, cv: ConfigValue) -> bool:
        with self._session() as s:
            stmt = select(ConfigValue).where(
                ConfigValue.key == cv.key,
                ConfigValue.effective_from == cv.effective_from,
                _scope_filter(_normalize_scope(cv.jurisdiction_id)),
            )
            if cv.language is None:
                stmt = stmt.where(ConfigValue.language.is_(None))
            else:
                stmt = stmt.where(ConfigValue.language == cv.language)
            return s.exec(stmt).first() is not None

    def _build_config_value(
        self,
        record: dict[str, Any],
        source_file: "Path | None" = None,
    ) -> ConfigValue:
        if "key" not in record:
            raise ValueError(f"{source_file or '<inline>'}: record missing 'key': {record!r}")
        if "value_type" not in record:
            raise ValueError(
                f"{source_file or '<inline>'}: record missing 'value_type': {record!r}"
            )

        eff_from = record.get("effective_from")
        if isinstance(eff_from, str):
            parsed = datetime.fromisoformat(eff_from)
            eff_from = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        elif eff_from is None:
            eff_from = datetime(1900, 1, 1, tzinfo=timezone.utc)
        elif isinstance(eff_from, datetime) and eff_from.tzinfo is None:
            eff_from = eff_from.replace(tzinfo=timezone.utc)

        eff_to = record.get("effective_to")
        if isinstance(eff_to, str):
            parsed = datetime.fromisoformat(eff_to)
            eff_to = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        elif isinstance(eff_to, datetime) and eff_to.tzinfo is None:
            eff_to = eff_to.replace(tzinfo=timezone.utc)

        return ConfigValue(
            domain=record.get("domain", "rule"),
            key=record["key"],
            jurisdiction_id=record.get("jurisdiction_id"),
            value=record.get("value"),
            value_type=ValueType(record["value_type"]),
            effective_from=eff_from,
            effective_to=eff_to,
            citation=record.get("citation"),
            author=record.get("author", "system:yaml"),
            approved_by=record.get("approved_by"),
            rationale=record.get("rationale", ""),
            supersedes=record.get("supersedes"),
            status=ApprovalStatus(record.get("status", "approved")),
            language=record.get("language"),
        )

    # --- introspection ---

    def __len__(self) -> int:
        with self._session() as s:
            return s.exec(select(func.count(ConfigValue.id))).one()

    def all(self) -> list[ConfigValue]:
        with self._session() as s:
            rows = list(s.exec(select(ConfigValue)))
            for r in rows:
                r.effective_from = _ensure_utc(r.effective_from)
                r.effective_to = _ensure_utc(r.effective_to)
                r.created_at = _ensure_utc(r.created_at)
            rows.sort(key=lambda r: (r.key, r.effective_from))
            return rows

    def clear(self) -> None:
        with self._session() as s:
            s.exec(delete(ConfigValue))
            s.exec(delete(ApprovalAuditEntry))
            s.commit()
