"""Program manifest loader for GovOps v3.0 (per ADR-014).

A program manifest at ``lawcode/<jurisdiction>/programs/<program-id>.yaml`` declares
the structure of one public-sector program — its rules, authority chain, legal
documents, and demo cases. Parameter values are NOT declared here; they live in
the ConfigValue substrate (``lawcode/<jur>/config/<program>-rules.yaml``) and are
referenced via ``{ref: '<substrate-key>'}`` markers. Formula AST trees (per
ADR-011) are sibling-relative includes via ``{include: '<path>'}``.

The loader produces existing model objects (``LegalRule``, ``AuthorityReference``,
``LegalDocument``, ``CaseBundle``) so the engine below this layer does not need
to change. Phase A's exit gate is byte-identical engine output between the
seed.py-based path and the manifest-based path for CA OAS.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, Field

from govops.legacy_constants import resolve_param
from govops.models import (
    Applicant,
    AuthorityReference,
    CaseBundle,
    DocumentType,
    EvidenceItem,
    LegalDocument,
    LegalRule,
    LegalSection,
    ResidencyPeriod,
    RuleType,
)


class ProgramManifestError(ValueError):
    """Raised when a program manifest fails to load or validate."""


class Program(BaseModel):
    """Loaded program manifest. Wraps existing model objects.

    Per ADR-014, ``Program`` is the canonical first-class declarable thing in
    v3. A jurisdiction may have many programs; one program may be implemented
    across many jurisdictions through symmetric authoring (the v3 EI rollout
    is the proof — same shape, six manifests).
    """

    program_id: str
    jurisdiction_id: str
    shape: str
    shape_version: Optional[str] = None
    status: str = "active"
    name: dict[str, str] = Field(default_factory=dict)
    description: dict[str, str] = Field(default_factory=dict)
    authority_chain: list[AuthorityReference] = Field(default_factory=list)
    legal_documents: list[LegalDocument] = Field(default_factory=list)
    rules: list[LegalRule]
    demo_cases: list[CaseBundle] = Field(default_factory=list)
    schema_version: str = "1.0"


# ---------------------------------------------------------------------------
# Coercion helpers
# ---------------------------------------------------------------------------


def _coerce_date(value: Any) -> Optional[date]:
    """Normalize a YAML scalar to ``date``. PyYAML returns ``date`` natively for
    ISO-8601 dates; strings (and ``datetime``) are tolerated for hand-edited
    fixtures.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ProgramManifestError(
        f"Expected date or ISO-8601 string, got {type(value).__name__}: {value!r}"
    )


def _resolve_parameter(spec: Any, manifest_dir: Path) -> Any:
    """Resolve a parameter spec.

    Per ADR-014 the schema permits only two reference shapes:

    - ``{ref: '<substrate-key>'}`` — looked up via :func:`resolve_param` at
      load time, mirroring seed.py's resolution path so the resulting
      ``LegalRule.parameters`` dict is byte-identical.
    - ``{include: '<sibling-relative-path>'}`` — read a sibling YAML file and
      embed its parsed content. Used for formula AST trees per ADR-011.

    Literal scalars are passed through unchanged so test fixtures and ad-hoc
    rules can use inline values without authoring substrate keys (the schema
    rejects literals at validation time; the loader is intentionally
    permissive for runtime ergonomics).
    """
    if isinstance(spec, dict):
        if set(spec.keys()) == {"ref"}:
            return resolve_param(spec["ref"])
        if set(spec.keys()) == {"include"}:
            include_path = manifest_dir / spec["include"]
            if not include_path.exists():
                raise ProgramManifestError(
                    f"Include path does not exist: {include_path}"
                )
            with include_path.open("r", encoding="utf-8") as fh:
                return yaml.safe_load(fh)
    return spec


# ---------------------------------------------------------------------------
# Builders (one per model class)
# ---------------------------------------------------------------------------


def _build_authority_reference(
    raw: dict[str, Any], jurisdiction_id: str
) -> AuthorityReference:
    return AuthorityReference(
        id=raw["id"],
        jurisdiction_id=jurisdiction_id,
        layer=raw["layer"],
        title=raw["title"],
        citation=raw["citation"],
        effective_date=_coerce_date(raw.get("effective_date")),
        url=raw.get("url", ""),
        parent_id=raw.get("parent"),
    )


def _build_legal_section(raw: dict[str, Any]) -> LegalSection:
    kwargs: dict[str, Any] = {
        "section_ref": raw["ref"],
        "heading": raw.get("heading", ""),
        "text": raw.get("text", ""),
    }
    if "id" in raw:
        kwargs["id"] = raw["id"]
    return LegalSection(**kwargs)


def _build_legal_document(
    raw: dict[str, Any], jurisdiction_id: str
) -> LegalDocument:
    return LegalDocument(
        id=raw["id"],
        jurisdiction_id=jurisdiction_id,
        document_type=DocumentType(raw["type"]),
        title=raw["title"],
        citation=raw["citation"],
        effective_date=_coerce_date(raw.get("effective_date")),
        sections=[_build_legal_section(s) for s in raw.get("sections", [])],
    )


def _build_legal_rule(raw: dict[str, Any], manifest_dir: Path) -> LegalRule:
    parameters = {
        name: _resolve_parameter(spec, manifest_dir)
        for name, spec in (raw.get("parameters") or {}).items()
    }
    return LegalRule(
        id=raw["id"],
        source_document_id=raw.get("source_document_id", ""),
        source_section_ref=raw.get("source_section_ref", ""),
        rule_type=RuleType(raw["rule_type"]),
        description=raw["description"],
        formal_expression=raw.get("formal_expression", ""),
        citation=raw["citation"],
        parameters=parameters,
        param_key_prefix=raw.get("param_key_prefix"),
    )


def _build_applicant(raw: dict[str, Any]) -> Applicant:
    kwargs: dict[str, Any] = {
        "date_of_birth": _coerce_date(raw["date_of_birth"]),
        "legal_name": raw.get("legal_name", ""),
        "legal_status": raw.get("legal_status", "citizen"),
        "country_of_birth": raw.get("country_of_birth", ""),
    }
    if "id" in raw:
        kwargs["id"] = raw["id"]
    return Applicant(**kwargs)


def _build_residency_period(raw: dict[str, Any]) -> ResidencyPeriod:
    return ResidencyPeriod(
        country=raw["country"],
        start_date=_coerce_date(raw["start_date"]),
        end_date=_coerce_date(raw.get("end_date")),
        verified=raw.get("verified", False),
        evidence_ids=list(raw.get("evidence_ids", []) or []),
    )


def _build_evidence_item(raw: dict[str, Any]) -> EvidenceItem:
    kwargs: dict[str, Any] = {
        "evidence_type": raw["type"],
        "description": raw.get("description", ""),
        "provided": raw.get("provided", True),
        "verified": raw.get("verified", False),
        "source_reference": raw.get("source_reference", ""),
    }
    if "id" in raw:
        kwargs["id"] = raw["id"]
    return EvidenceItem(**kwargs)


def _build_demo_case(raw: dict[str, Any], jurisdiction_id: str) -> CaseBundle:
    return CaseBundle(
        id=raw["id"],
        jurisdiction_id=jurisdiction_id,
        applicant=_build_applicant(raw["applicant"]),
        residency_periods=[
            _build_residency_period(p) for p in raw.get("residency_periods", [])
        ],
        evidence_items=[
            _build_evidence_item(e) for e in raw.get("evidence_items", [])
        ],
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def load_program_manifest(path: "str | Path") -> Program:
    """Load a program manifest from YAML and produce a :class:`Program`.

    The loader resolves substrate refs at load time via :func:`resolve_param`,
    so the resulting ``LegalRule.parameters`` dict matches what seed.py and
    jurisdictions.py produce today. ``param_key_prefix`` is preserved so the
    engine can re-resolve at evaluation time per ADR-013 (scalar seam).
    """
    manifest_path = Path(path)
    if not manifest_path.exists():
        raise ProgramManifestError(f"Manifest not found: {manifest_path}")

    with manifest_path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    if not isinstance(raw, dict):
        raise ProgramManifestError(
            f"Manifest top-level must be a mapping, got {type(raw).__name__}"
        )

    for required in ("program_id", "jurisdiction_id", "shape", "rules"):
        if required not in raw:
            raise ProgramManifestError(
                f"{manifest_path}: missing required field '{required}'"
            )

    manifest_dir = manifest_path.parent
    jurisdiction_id = raw["jurisdiction_id"]

    return Program(
        schema_version=raw.get("schema_version", "1.0"),
        program_id=raw["program_id"],
        jurisdiction_id=jurisdiction_id,
        shape=raw["shape"],
        shape_version=raw.get("shape_version"),
        status=raw.get("status", "active"),
        name=dict(raw.get("name") or {}),
        description=dict(raw.get("description") or {}),
        authority_chain=[
            _build_authority_reference(a, jurisdiction_id)
            for a in raw.get("authority_chain", [])
        ],
        legal_documents=[
            _build_legal_document(d, jurisdiction_id)
            for d in raw.get("legal_documents", [])
        ],
        rules=[_build_legal_rule(r, manifest_dir) for r in raw["rules"]],
        demo_cases=[
            _build_demo_case(c, jurisdiction_id)
            for c in raw.get("demo_cases", [])
        ],
    )


def discover_program_manifests(lawcode_root: "str | Path") -> list[Path]:
    """Walk ``lawcode/`` and return all program manifest files.

    Per ADR-015's two-tier model, only files directly under
    ``lawcode/<jur>/programs/`` are treated as program manifests; sibling
    subdirectories (``formulas/``, ``_shapes/``) are excluded by the glob
    shape. Files whose name starts with an underscore are also skipped so
    contributors can stage drafts under names like ``_wip-ei.yaml`` without
    them being treated as authoritative.
    """
    root = Path(lawcode_root)
    return sorted(
        p
        for p in root.glob("*/programs/*.yaml")
        if not p.name.startswith("_")
    )
