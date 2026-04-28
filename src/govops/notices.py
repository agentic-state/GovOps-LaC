"""Citizen-facing decision-notice rendering (Phase 10C / ADR-012).

Per ADR-012, a notice is a *derived artefact*: a deterministic function of
(case, recommendation, dated template, dated i18n strings, engine version).
There is no `Notice` row, no `notice_id`, no persistence of the rendered
HTML or PDF bytes. Each render is reproducible; tampering is detectable
because every render emits a `notice_generated` audit event recording the
sha256 of the rendered HTML alongside the template version.

The audit chain is the proof; the bytes are the demonstration. If you have
the audit event and the substrate as it was, you can reproduce the bytes
and verify the hash. If you only have a leaked HTML/PDF, you can check
whether a real audit event vouches for it.

Templates live in ``lawcode/global/notices.yaml`` (or per-jurisdiction
files) under ``domain=template``. Per ADR-008 + ADR-012, template records
require dual approval; the schema gate enforces it.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from jinja2 import Environment, StrictUndefined, select_autoescape
from pydantic import BaseModel

from govops.i18n import t as _t
from govops.legacy_constants import _JURISDICTION_PREFIX_TO_ID, _resolver
from govops.models import AuditEntry, CaseBundle, Jurisdiction, Recommendation


class NoticeRenderError(ValueError):
    """Raised when a notice cannot be rendered.

    Distinct from generic ``ValueError`` so callers can map it to an HTTP
    status (404 for missing template, 500 for Jinja faults) without
    swallowing other ValueErrors.
    """


class RenderedNotice(BaseModel):
    """The output of ``render_html``: HTML + the audit primitives.

    The `audit_event` is a fully-formed AuditEntry the caller appends to
    the case's audit trail. Returning it (rather than emitting inside
    render) keeps the function pure and testable: callers that don't have
    a case (e.g. dry-render previews in the admin UI) can drop the event.
    """

    html: str
    sha256: str
    template_key: str
    template_version: str
    language: str
    rendered_at_utc: str
    audit_event: AuditEntry


# Single Environment instance — Jinja sandboxing + autoescape for HTML output.
# Templates are loaded from strings (resolved from ConfigStore), so no
# FileSystemLoader. autoescape protects against template authors who
# accidentally interpolate untrusted strings; StrictUndefined surfaces
# missing-binding bugs at render time rather than producing silently empty
# output that an auditor would never notice.
_JINJA_ENV = Environment(
    autoescape=select_autoescape(("html", "xml")),
    undefined=StrictUndefined,
    keep_trailing_newline=True,
)


def _resolve_template_record(template_key: str):
    """Resolve a template ConfigValue, returning the full record (not just value).

    Uses ``ConfigStore.resolve()`` (full record, not just value) because we
    need the record id — used as ``template_version`` in the audit event —
    plus the metadata fields. The substrate is ``legacy_constants._resolver``,
    same singleton that ``resolve_param`` uses for every other coefficient
    lookup.
    """
    # Templates currently live under jurisdiction_id=global. Future
    # per-jurisdiction templates will resolve through the same path,
    # routed by the prefix→id table that rules already use.
    prefix = template_key.split(".", 1)[0]
    if prefix == "global":
        jurisdiction_id = None
    else:
        jurisdiction_id = _JURISDICTION_PREFIX_TO_ID.get(prefix)

    record = _resolver.resolve(
        template_key,
        evaluation_date=datetime.now(timezone.utc),
        jurisdiction_id=jurisdiction_id,
    )
    if record is None:
        raise NoticeRenderError(f"no template record for key {template_key!r}")
    if record.value_type != "template":
        raise NoticeRenderError(
            f"template key {template_key!r} resolved to value_type={record.value_type!r}, expected 'template'"
        )
    return record


def render_html(
    case: CaseBundle,
    recommendation: Recommendation,
    *,
    jurisdiction: Jurisdiction,
    program_name: str,
    template_key: str,
    language: str = "en",
    evaluation_date: Optional[str] = None,
    rendered_at_utc: Optional[str] = None,
) -> RenderedNotice:
    """Render a citizen-facing decision notice as self-contained HTML.

    ``rendered_at_utc`` is exposed as a parameter so tests can pin it for
    determinism; production callers pass ``None`` and let the function
    stamp ``datetime.now(UTC)``.

    Reproducibility contract: same inputs (including same template version
    and same i18n state) must produce byte-identical HTML — except for the
    ``rendered_at_utc`` field. To check determinism in tests, pin the
    timestamp; the rest of the body must hash identically across calls.
    """
    record = _resolve_template_record(template_key)
    template = _JINJA_ENV.from_string(record.value)

    if rendered_at_utc is None:
        rendered_at_utc = (
            datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        )
    # i18n binding — closure over `language` so the template can call
    # `t('key', lang)` and have lang already resolved if it omits the arg.
    def t(key: str, lang: Optional[str] = None) -> str:
        return _t(key, lang or language)

    html = template.render(
        case=case,
        recommendation=recommendation,
        jurisdiction=jurisdiction,
        program_name=program_name,
        evaluation_date=evaluation_date or "",
        rendered_at_utc=rendered_at_utc,
        template_version=record.id,
        t=t,
        lang=language,
    )

    sha256 = hashlib.sha256(html.encode("utf-8")).hexdigest()

    audit_event = AuditEntry(
        event_type="notice_generated",
        actor="system:notices",
        detail=f"Notice rendered for case {case.id} (template {template_key} v{record.id}, lang {language})",
        data={
            "case_id": case.id,
            "template_key": template_key,
            "template_version": record.id,
            "language": language,
            "sha256": sha256,
            "rendered_at_utc": rendered_at_utc,
        },
    )

    return RenderedNotice(
        html=html,
        sha256=sha256,
        template_key=template_key,
        template_version=record.id,
        language=language,
        rendered_at_utc=rendered_at_utc,
        audit_event=audit_event,
    )
