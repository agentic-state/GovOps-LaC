"""ConfigValue substrate for Law-as-Code v2.0.

Effective-dated key/value records resolved by (key, evaluation_date, jurisdiction_id).
Behaviour changes are configuration writes; old evaluations remain reproducible.

Key schema (per ADR-006): <jurisdiction>-<program>.<domain>.<scope>.<param>
  ca-oas.rule.age-65.min_age
  global.ui.label.cases.title
  global.prompt.encoder.extraction_system

Storage is in-memory (per ADR-007). State is reseeded on startup.

Phase 2 backcompat (per ADR-004): `resolve_value()` is a two-tier resolver —
substrate first, then `LEGACY_CONSTANTS`. `AIA_CONFIG_STRICT=1` raises
`ConfigKeyNotMigrated` whenever the legacy tier matches, which CI flips on at
Phase 2 exit so unmigrated keys can't slip through.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, NamedTuple, Optional

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


class ResolutionSource(str, Enum):
    """Which tier of `ConfigStore.resolve_value()` produced the answer.

    Per ADR-004, the audit trail records which records came from the substrate
    and which fell through to the legacy registry, so cutover progress is
    inspectable.
    """

    SUBSTRATE = "substrate"
    LEGACY = "legacy"
    FEDERATED = "federated"


class ConfigKeyNotMigrated(KeyError):
    """Raised in strict mode when a key is missing from the substrate.

    Strict mode is enabled by `AIA_CONFIG_STRICT=1`. CI flips it on at Phase 2
    exit so unmigrated keys can no longer pass tests via legacy fallback.
    """


# Sentinel distinguishing "no default supplied" from "default = None".
_MISSING: Any = object()


# Populated at startup by modules that own legacy values (e.g. seed.py during
# Phase 2). Keys mirror the ADR-006 schema. Drained slice-by-slice as each
# domain migrates; deleted entirely at Phase 2 exit.
LEGACY_CONSTANTS: dict[str, Any] = {}


def register_legacy(key: str, value: Any) -> None:
    """Register a legacy default. Idempotent within a process."""
    LEGACY_CONSTANTS[key] = value


def is_strict_mode() -> bool:
    """True when AIA_CONFIG_STRICT=1 is set."""
    return os.environ.get("AIA_CONFIG_STRICT") == "1"


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
    resolved_value_id: Optional[str] = None  # None if no substrate record
    source: Optional[ResolutionSource] = None  # which tier matched
    resolved_at: datetime = Field(default_factory=_utcnow)


class ResolutionResult(NamedTuple):
    """Lightweight return type for ``ConfigStore.resolve_value()``.

    `value` is the resolved Python value (not a `ConfigValue` wrapper).
    `source` indicates which tier produced it; `None` means neither substrate
    nor legacy matched and the caller's explicit default was returned.
    """

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

    def resolve_value(
        self,
        key: str,
        evaluation_date: Optional[datetime] = None,
        jurisdiction_id: Optional[str] = None,
        language: Optional[str] = None,
        default: Any = _MISSING,
    ) -> ResolutionResult:
        """Two-tier resolver per ADR-004 (Phase 2 backcompat).

        1. Substrate: query the in-memory ConfigValue store via ``resolve()``.
        2. Legacy: fall back to ``LEGACY_CONSTANTS[key]`` if present.
        3. Caller default: return ``default`` if supplied.
        4. Otherwise: ``None`` (lenient mode) or raise ``ConfigKeyNotMigrated``
           (when ``AIA_CONFIG_STRICT=1``).

        Strict mode raises whenever the legacy tier matches OR no tier matches,
        making "I forgot to migrate this key" loud at Phase 2 exit.
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

    # --- YAML loader (Phase 3 / ADR-003) ---

    def load_from_yaml(self, path: "str | os.PathLike[str]") -> int:
        """Load ConfigValue records from a YAML file or directory tree.

        Schema (per ADR-003 §Mitigations):
        ```yaml
        # yaml-language-server: $schema=../../schema/lawcode-v1.0.json
        defaults:               # optional; merged into every record below
          domain: rule
          jurisdiction_id: ca-oas
          value_type: number
          effective_from: "1900-01-01"
        values:
          - key: ca.rule.age-65.min_age
            value: 65
            citation: "OAS Act, R.S.C. 1985, c. O-9, s. 3(1)"
            rationale: "Original statutory minimum age."
          - key: ca.rule.residency-10.min_years
            value: 10
            ...
        ```

        If ``path`` is a directory, every ``.yaml`` / ``.yml`` file beneath it
        is loaded (recursively, sorted for determinism). Returns the count of
        records inserted across all files.

        Per ADR-003: YAML 1.2 only (uses ``yaml.safe_load`` which targets 1.2);
        no anchors/aliases are honored at this layer (they would parse but
        wouldn't survive round-trip — discouraged in source).
        """
        import yaml  # local import: keep top-level cheap

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
                raise ValueError(
                    f"{fp}: expected top-level mapping with 'values' list"
                )
            defaults: dict[str, Any] = doc.get("defaults") or {}
            for raw in doc["values"]:
                if not isinstance(raw, dict):
                    raise ValueError(f"{fp}: each value must be a mapping, got {type(raw).__name__}")
                merged = {**defaults, **raw}
                cv = self._build_config_value(merged, source_file=fp)
                self.put(cv)
                inserted += 1
        return inserted

    def _build_config_value(
        self,
        record: dict[str, Any],
        source_file: "Path | None" = None,
    ) -> ConfigValue:
        """Validate-and-construct a ConfigValue from a YAML record.

        Defaults sane: ``effective_from = 1900-01-01 UTC`` if omitted (per
        ADR-004 §Failure modes — every Phase-2/3 record is "always in effect").
        ``value_type`` is required; ``key`` is required.
        """
        if "key" not in record:
            raise ValueError(f"{source_file or '<inline>'}: record missing 'key': {record!r}")
        if "value_type" not in record:
            raise ValueError(f"{source_file or '<inline>'}: record missing 'value_type': {record!r}")

        eff_from = record.get("effective_from")
        if isinstance(eff_from, str):
            parsed = datetime.fromisoformat(eff_from)
            eff_from = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        elif eff_from is None:
            eff_from = datetime(1900, 1, 1, tzinfo=timezone.utc)

        eff_to = record.get("effective_to")
        if isinstance(eff_to, str):
            parsed = datetime.fromisoformat(eff_to)
            eff_to = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

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
        return len(self._by_id)

    def all(self) -> list[ConfigValue]:
        out = list(self._by_id.values())
        out.sort(key=lambda r: (r.key, r.effective_from))
        return out

    def clear(self) -> None:
        self._by_id.clear()
