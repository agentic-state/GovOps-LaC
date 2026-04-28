"""GovOps FastAPI application.

Serves both the JSON API and the Jinja2 demo UI.
Supports multiple jurisdictions and languages.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from starlette.datastructures import FormData, UploadFile as StarletteUploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from datetime import date, datetime, timezone

from govops.config import (
    ApprovalStatus,
    ConfigStore,
    ConfigValue,
    ValueType,
)
from govops.encoding_example import seed_encoding_example
from govops.encoder import (
    EncodingStore,
    ProposalStatus,
    extract_rules_manual,
    extract_rules_with_llm,
)
from govops.engine import OASEngine
from govops.i18n import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, get_translator
from govops.jurisdictions import JURISDICTION_REGISTRY
from govops.models import (
    CaseEvent,
    DecisionOutcome,
    EventType,
    HumanReviewAction,
    ReviewAction,
)
from govops.screen import (
    ScreenRequest,
    ScreenResponse,
    UnknownJurisdiction,
    run_screen,
)
from govops.store import DemoStore

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

TEMPLATES_DIR = Path(__file__).parent / "templates"
STATIC_DIR = Path(__file__).parent / "static"

store = DemoStore()
encoding_store = EncodingStore()
# Per ADR-010: persistent SQLite when GOVOPS_DB_PATH is set, in-memory otherwise.
# Tests don't set the env var → fresh in-memory DB per process. The govops-demo
# CLI sets it to var/govops.db so runtime edits survive restarts.
config_store = ConfigStore(db_path=os.environ.get("GOVOPS_DB_PATH"))

LAWCODE_DIR = Path(__file__).resolve().parent.parent.parent / "lawcode"

DEFAULT_JURISDICTION = "ca"


def _seed_jurisdiction(jur_code: str):
    """Seed the store with a jurisdiction's data."""
    pack = JURISDICTION_REGISTRY.get(jur_code)
    if not pack:
        return
    store.seed(
        jurisdiction=pack.jurisdiction,
        authority_chain=pack.authority_chain,
        legal_documents=pack.legal_documents,
        rules=pack.rules,
        cases=pack.make_cases(),
    )


def _seed_demo_drafts():
    """Seed the approvals queue with representative drafts so the admin UI
    has something to show on first load. Triggered by GOVOPS_SEED_DEMO=1.

    Idempotent: each demo draft has a unique key prefix
    (`demo.draft.*`) so re-runs don't create duplicates.
    """
    demo_drafts = [
        {
            "key": "demo.draft.ca-oas.age-67-amendment",
            "jurisdiction_id": "ca-oas",
            "value": 67,
            "value_type": ValueType.NUMBER,
            "effective_from": datetime(2027, 1, 1, tzinfo=timezone.utc),
            "citation": "Hypothetical 2027 OAS amendment (demo data)",
            "author": "demo-author",
            "rationale": "Sample policy proposal: raise OAS minimum age to 67 effective 2027-01-01.",
            "status": ApprovalStatus.DRAFT,
        },
        {
            "key": "demo.draft.fr-cnav.indexation-2026",
            "jurisdiction_id": "fr-cnav",
            "value": 1.024,
            "value_type": ValueType.NUMBER,
            "effective_from": datetime(2026, 7, 1, tzinfo=timezone.utc),
            "citation": "Hypothetical CNAV revaluation 2026 (demo data)",
            "author": "demo-author",
            "rationale": "Sample annual index adjustment for CNAV pension benefits.",
            "status": ApprovalStatus.PENDING,
        },
        {
            "key": "demo.draft.de-drv.entgeltpunkt-rejected",
            "jurisdiction_id": "de-drv",
            "value": 36.50,
            "value_type": ValueType.NUMBER,
            "effective_from": datetime(2026, 7, 1, tzinfo=timezone.utc),
            "citation": "Hypothetical DRV Entgeltpunkt update (demo data)",
            "author": "demo-author",
            "rationale": "Sample entgeltpunkt revision; rejected as out of scope for current track.",
            "status": ApprovalStatus.REJECTED,
        },
    ]
    for draft in demo_drafts:
        existing = config_store.list_versions(draft["key"], jurisdiction_id=draft["jurisdiction_id"])
        if existing:
            continue
        cv = ConfigValue(
            domain="rule",
            key=draft["key"],
            jurisdiction_id=draft["jurisdiction_id"],
            value=draft["value"],
            value_type=draft["value_type"],
            effective_from=draft["effective_from"],
            citation=draft["citation"],
            author=draft["author"],
            rationale=draft["rationale"],
            status=draft["status"],
        )
        config_store.put(cv)
        config_store.record_audit(
            config_value_id=cv.id,
            event="draft_created",
            actor=draft["author"],
            comment=draft["rationale"],
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_jurisdiction(DEFAULT_JURISDICTION)
    seed_encoding_example(encoding_store)
    # Hydrate the substrate from lawcode/ if it's empty (per ADR-010).
    # Skip when pre-populated (test fixtures rely on this); idempotent on
    # natural key, so a partially-seeded store is also tolerated.
    if len(config_store) == 0 and LAWCODE_DIR.exists():
        config_store.load_from_yaml(LAWCODE_DIR)
    # Demo seed: enterprise-grade demo experience requires a non-empty
    # approvals queue on first load. GOVOPS_SEED_DEMO=1 turns it on.
    if os.environ.get("GOVOPS_SEED_DEMO") == "1":
        _seed_demo_drafts()
    yield


app = FastAPI(
    title="GovOps",
    description="Policy-Driven Service Delivery Machine - Independent prototype using publicly available legislation as illustrative case studies.",
    version="0.2.0",
    lifespan=lifespan,
)

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _form_str(form: FormData, key: str, default: str = "") -> str:
    v = form.get(key)
    if v is None:
        return default
    if isinstance(v, StarletteUploadFile):
        raise HTTPException(400, f"Field '{key}' must be text, not a file upload")
    return v


def _current_jur_code() -> str:
    """Get the current jurisdiction code from the store."""
    for code, pack in JURISDICTION_REGISTRY.items():
        if pack.jurisdiction.id in store.jurisdictions:
            return code
    return DEFAULT_JURISDICTION


def _base_context(lang: str) -> dict:
    """Build the common template context with i18n and jurisdiction info."""
    jur_code = _current_jur_code()
    pack = JURISDICTION_REGISTRY[jur_code]
    return {
        "t": get_translator(lang),
        "lang": lang,
        "languages": SUPPORTED_LANGUAGES,
        "jur_code": jur_code,
        "jurisdictions": {k: v.jurisdiction.name for k, v in JURISDICTION_REGISTRY.items()},
        "program_name": pack.program_name,
    }


# ---------------------------------------------------------------------------
# JSON API
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    jur_code = _current_jur_code()
    pack = JURISDICTION_REGISTRY.get(jur_code)
    return {
        "status": "healthy",
        "engine": "govops-demo",
        "version": "0.2.0",
        "jurisdiction": jur_code,
        "program": pack.program_name if pack else "",
        "available_jurisdictions": list(JURISDICTION_REGISTRY.keys()),
    }


@app.post("/api/jurisdiction/{jur_code}")
def switch_jurisdiction(jur_code: str):
    if jur_code not in JURISDICTION_REGISTRY:
        raise HTTPException(400, f"Unknown jurisdiction: {jur_code}. Available: {list(JURISDICTION_REGISTRY.keys())}")
    _seed_jurisdiction(jur_code)
    pack = JURISDICTION_REGISTRY[jur_code]
    return {"jurisdiction": jur_code, "name": pack.jurisdiction.name, "program": pack.program_name}


@app.get("/api/authority-chain")
def get_authority_chain():
    jur_code = _current_jur_code()
    pack = JURISDICTION_REGISTRY[jur_code]
    return {
        "jurisdiction": pack.jurisdiction,
        "chain": store.authority_chain,
    }


@app.get("/api/rules")
def get_rules():
    return {"rules": list(store.rules.values())}


@app.get("/api/legal-documents")
def get_legal_documents():
    return {"documents": list(store.legal_documents.values())}


@app.get("/api/cases")
def list_cases():
    return {
        "cases": [
            {
                "id": c.id,
                "applicant_name": c.applicant.legal_name,
                "status": c.status.value,
                "has_recommendation": c.id in store.recommendations,
            }
            for c in store.cases.values()
        ]
    }


@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    rec = store.recommendations.get(case_id)
    reviews = store.review_actions.get(case_id, [])
    return {
        "case": case,
        "recommendation": rec,
        "reviews": reviews,
    }


@app.post("/api/cases/{case_id}/evaluate")
def evaluate_case(case_id: str):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    engine = OASEngine(rules=list(store.rules.values()))
    rec, audit = engine.evaluate(case)
    # Link to the prior recommendation if any (ADR-013 supersession chain).
    prior = store.recommendations.get(case_id)
    if prior is not None:
        rec.supersedes = prior.id
    store.save_recommendation(rec, audit)
    return {"recommendation": rec}


# ---------------------------------------------------------------------------
# Life events (Phase 10D / ADR-013)
# ---------------------------------------------------------------------------


class CaseEventRequest(BaseModel):
    event_type: EventType
    effective_date: date
    payload: dict = {}
    actor: str = "citizen"
    note: str = ""


@app.post("/api/cases/{case_id}/events")
def post_case_event(case_id: str, body: CaseEventRequest, reevaluate: bool = True):
    """Record a life event and (by default) re-evaluate the case.

    Per ADR-013, events are append-only. The event is always saved; if
    ``reevaluate=true`` (default) the engine runs against the case as it
    stands after applying every event in chronological order, with the
    new recommendation linking back to the previous one via supersedes.
    """
    from govops.events import EventApplicationError, replay_events

    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    event = CaseEvent(
        case_id=case_id,
        event_type=body.event_type,
        effective_date=body.effective_date,
        actor=body.actor,
        payload=body.payload,
        note=body.note,
    )

    # Validate the payload by attempting to apply the event in isolation
    # before persisting it. A bad payload (missing required field) becomes
    # a 400 instead of a half-recorded state.
    from govops.events import apply_event  # local import to avoid cycle
    try:
        apply_event(case, event)
    except EventApplicationError as exc:
        raise HTTPException(400, str(exc)) from exc

    store.save_event(event)

    response: dict = {"event": event}

    if reevaluate:
        # Replay all events (including the one we just saved) onto the base
        # case to get the projected state as-of the latest event date.
        events = list(store.case_events.get(case_id, []))
        as_of = max(e.effective_date for e in events) if events else event.effective_date
        projected = replay_events(case, events, as_of=as_of)

        engine = OASEngine(rules=list(store.rules.values()), evaluation_date=as_of)
        rec, audit = engine.evaluate(projected)

        prior = store.recommendations.get(case_id)
        if prior is not None:
            rec.supersedes = prior.id
        rec.evaluation_date = as_of
        rec.triggered_by_event_id = event.id

        store.save_recommendation(rec, audit)
        response["recommendation"] = rec

    return response


@app.get("/api/cases/{case_id}/events")
def list_case_events(case_id: str):
    """Return the case's event log + recommendation history (supersession chain).

    Both lists are returned in chronological order. The supersession chain
    can be reconstructed client-side by following ``recommendation.supersedes``
    backwards through the history list.
    """
    if case_id not in store.cases:
        raise HTTPException(404, f"Case {case_id} not found")
    events = list(store.case_events.get(case_id, []))
    history = list(store.recommendation_history.get(case_id, []))
    return {
        "events": events,
        "recommendations": history,
    }


class ReviewRequest(BaseModel):
    action: ReviewAction
    rationale: str = ""
    final_outcome: DecisionOutcome | None = None


@app.post("/api/cases/{case_id}/review")
def review_case(case_id: str, body: ReviewRequest):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    rec = store.recommendations.get(case_id)
    if not rec:
        raise HTTPException(400, "Case has not been evaluated yet")
    review = HumanReviewAction(
        case_id=case_id,
        recommendation_id=rec.id,
        action=body.action,
        rationale=body.rationale,
        final_outcome=body.final_outcome or rec.outcome,
    )
    store.save_review(review)
    return {"review": review}


@app.get("/api/cases/{case_id}/audit")
def get_audit(case_id: str):
    pkg = store.build_audit_package(case_id)
    if not pkg:
        raise HTTPException(404, f"Case {case_id} not found")
    return pkg


# ---------------------------------------------------------------------------
# Encoder: commit-ready YAML emission (PLAN §8 success criterion #6)
# Closes the loop the encoder pipeline opened in Phase 4: an approval
# becomes a YAML file under lawcode/.proposed/<batch_id>/ that a
# contributor reviews and PRs to the canonical lawcode/<jur>/config/.
# ---------------------------------------------------------------------------


@app.post("/api/encode/batches/{batch_id}/emit-yaml")
def encode_emit_yaml(batch_id: str):
    """Emit approved rules from an encoding batch as commit-ready YAML.

    Returns the relative path under ``lawcode/.proposed/<batch_id>/``
    plus the rendered file contents — so the caller can show a diff
    preview without re-reading the file.

    Errors:
      - 404 if the batch doesn't exist
      - 400 if the batch has no approved rules, or the jurisdiction is
        unknown (``EmissionError`` from the emitter)
    """
    from govops.yaml_emitter import EmissionError, emit_yaml_for_batch

    batch = encoding_store.batches.get(batch_id)
    if not batch:
        raise HTTPException(404, f"batch {batch_id!r} not found")

    target_root = LAWCODE_DIR.parent  # repo root — emitter writes lawcode/.proposed/
    try:
        out_path = emit_yaml_for_batch(batch, target_root)
    except EmissionError as exc:
        raise HTTPException(400, str(exc)) from exc

    return {
        "batch_id": batch_id,
        "path": str(out_path.relative_to(target_root).as_posix()),
        "content": out_path.read_text(encoding="utf-8"),
    }


# ---------------------------------------------------------------------------
# Admin federation surface (Phase 8 / ADR-009)
# Read-mostly endpoints powering /admin/federation per govops-020. The
# trust-decision authoring stays as a YAML PR per ADR-009; these endpoints
# expose state and trigger fetches, not editorial flows.
# ---------------------------------------------------------------------------


def require_admin_token(
    x_govops_admin_token: str | None = Header(default=None, alias="X-Govops-Admin-Token"),
) -> None:
    """Minimal admin gate (PLAN.md §11 auth-track placeholder).

    If the ``GOVOPS_ADMIN_TOKEN`` env var is unset, this dependency is a
    no-op — current open behaviour is preserved for the demo. If the env
    var IS set, requests must carry an ``X-Govops-Admin-Token`` header
    whose value matches; missing or wrong returns 401.

    This is intentionally simple — not real auth, not user-aware, no
    rotation, no scopes. It exists to close the wide-open admin surface
    on deployed instances where federation traffic flows. The full
    AuthN/AuthZ track per PLAN §11 supersedes this.
    """
    expected = os.environ.get("GOVOPS_ADMIN_TOKEN")
    if not expected:
        return  # gate disabled
    if not x_govops_admin_token or x_govops_admin_token != expected:
        raise HTTPException(401, "admin token required")


def _federation_paths() -> tuple[Path, Path, Path]:
    """Resolve the three paths the federation admin endpoints read.

    Override-able via env so tests can point at a tmp_path without
    monkeypatching globals: ``GOVOPS_LAWCODE_DIR`` overrides the lawcode
    root; the other two derive from it.
    """
    lawcode_root = Path(os.environ.get("GOVOPS_LAWCODE_DIR") or LAWCODE_DIR)
    return (
        lawcode_root / "REGISTRY.yaml",
        lawcode_root / "global" / "trusted_keys.yaml",
        lawcode_root / ".federated",
    )


@app.get("/api/admin/federation/registry", dependencies=[Depends(require_admin_token)])
def admin_federation_registry():
    """List registered publishers + their trust state.

    Returns one entry per publisher in ``lawcode/REGISTRY.yaml`` with a
    ``trust_state`` field derived from whether a public key is on file in
    ``lawcode/global/trusted_keys.yaml``: ``trusted`` if a key exists,
    ``unsigned_only`` if not.
    """
    from govops.federation import load_registry, load_trusted_keys

    reg_path, keys_path, _ = _federation_paths()
    registry = load_registry(reg_path)
    trusted_keys = load_trusted_keys(keys_path)
    entries = []
    for publisher_id, entry in registry.items():
        merged = dict(entry)
        merged["trust_state"] = "trusted" if publisher_id in trusted_keys else "unsigned_only"
        entries.append(merged)
    entries.sort(key=lambda e: e.get("publisher_id", ""))
    return {"publishers": entries}


@app.get("/api/admin/federation/packs", dependencies=[Depends(require_admin_token)])
def admin_federation_packs():
    """List imported federated packs with their provenance + enabled state."""
    from govops.federation import list_imported_packs

    _, _, federated_dir = _federation_paths()
    return {"packs": list_imported_packs(federated_dir)}


@app.post("/api/admin/federation/fetch/{publisher_id}", dependencies=[Depends(require_admin_token)])
def admin_federation_fetch(
    publisher_id: str,
    dry_run: bool = False,
    allow_unsigned: bool = False,
):
    """Trigger ``govops.federation.fetch_pack`` for a registered publisher.

    Maps every fail-closed federation error to a 4xx HTTP status so the
    UI surfaces actionable feedback rather than a generic 500.
    """
    from govops.federation import (
        FederationError,
        ManifestHashMismatch,
        MissingSignature,
        SignatureMismatch,
        UntrustedPublisher,
        fetch_pack,
        http_file_loader,
        http_manifest_loader,
        load_registry,
        load_trusted_keys,
    )

    reg_path, keys_path, federated_dir = _federation_paths()
    registry = load_registry(reg_path)
    trusted_keys = load_trusted_keys(keys_path)

    try:
        result = fetch_pack(
            publisher_id,
            registry=registry,
            trusted_keys=trusted_keys,
            manifest_loader=http_manifest_loader,
            file_loader=http_file_loader,
            target_dir=federated_dir,
            allow_unsigned=allow_unsigned,
            dry_run=dry_run,
        )
    except UntrustedPublisher as exc:
        raise HTTPException(403, str(exc)) from exc
    except (MissingSignature, SignatureMismatch, ManifestHashMismatch) as exc:
        raise HTTPException(400, str(exc)) from exc
    except FederationError as exc:
        raise HTTPException(400, str(exc)) from exc

    return {"result": result}


@app.post("/api/admin/federation/packs/{publisher_id}/enable", dependencies=[Depends(require_admin_token)])
def admin_federation_enable(publisher_id: str):
    """Re-enable a previously-disabled federated pack.

    Removes the ``.disabled`` sentinel; on next process restart the
    substrate hydrator picks the pack back up. Idempotent — calling
    twice on an already-enabled pack returns ``changed=false``.
    """
    return _set_pack_enabled_response(publisher_id, enabled=True)


@app.post("/api/admin/federation/packs/{publisher_id}/disable", dependencies=[Depends(require_admin_token)])
def admin_federation_disable(publisher_id: str):
    """Disable a federated pack without deleting it.

    Writes a ``.disabled`` sentinel that ``ConfigStore.load_from_yaml``
    honours: every YAML inside the pack directory is skipped at next
    hydration. Re-enable via ``/enable`` to restore.
    """
    return _set_pack_enabled_response(publisher_id, enabled=False)


def _set_pack_enabled_response(publisher_id: str, *, enabled: bool) -> dict:
    from govops.federation import set_pack_enabled

    _, _, federated_dir = _federation_paths()
    try:
        changed = set_pack_enabled(federated_dir, publisher_id, enabled)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"publisher_id": publisher_id, "enabled": enabled, "changed": changed}


# ---------------------------------------------------------------------------
# Decision notice (Phase 10C / ADR-012)
# A notice is a derived artefact: deterministic function of (case,
# recommendation, dated template, dated i18n). No persisted entity; the
# audit event records template_version + sha256 so a leaked artefact can
# be verified or refuted by re-rendering against the substrate as it stood.
# ---------------------------------------------------------------------------

@app.get("/api/cases/{case_id}/notice")
def get_case_notice(case_id: str, lang: str = "en"):
    """Render the citizen-facing decision notice for a case as HTML.

    The case must already have a recommendation (POST /evaluate first).
    Each render appends a `notice_generated` audit event recording the
    template version and the rendered HTML's sha256.
    """
    from fastapi.responses import HTMLResponse

    from govops.notices import NoticeRenderError, render_html

    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    rec = store.recommendations.get(case_id)
    if not rec:
        raise HTTPException(400, "Case has not been evaluated yet")
    jur = store.jurisdictions.get(case.jurisdiction_id)
    if not jur:
        raise HTTPException(500, f"Jurisdiction {case.jurisdiction_id} missing from store")

    # Per-jurisdiction template key. Today only CA-OAS has one; future
    # jurisdictions follow the same pattern (`global.template.notice.<jur>-decision`).
    template_key = f"global.template.notice.{_jurisdiction_slug(case.jurisdiction_id)}-decision"
    program_name = _program_name_for(case.jurisdiction_id, lang)

    try:
        rendered = render_html(
            case=case,
            recommendation=rec,
            jurisdiction=jur,
            program_name=program_name,
            template_key=template_key,
            language=lang,
        )
    except NoticeRenderError as exc:
        raise HTTPException(404, str(exc)) from exc

    # Append the audit event so a future audit-package fetch reflects this
    # render. Audit-of-record is the case + recommendation + dated state;
    # this event is the tamper-detection primitive.
    store.audit_trails.setdefault(case_id, []).append(rendered.audit_event)

    return HTMLResponse(
        content=rendered.html,
        headers={
            "X-Notice-Sha256": rendered.sha256,
            "X-Notice-Template-Version": rendered.template_version,
            "X-Notice-Language": rendered.language,
        },
    )


def _jurisdiction_slug(jurisdiction_id: str) -> str:
    """Map a jurisdiction id to the slug used in template keys.

    Each entry corresponds to a notice template in
    ``lawcode/global/notices.yaml`` keyed
    ``global.template.notice.<slug>-decision``. Adding a new jurisdiction
    that needs a notice means: (1) seed the template record in YAML,
    (2) add the mapping here, (3) extend ``_PROGRAM_NAME_FALLBACKS``
    below if the i18n fallback wants a custom default.
    """
    mapping = {
        "jur-ca-federal": "ca-oas",
        "jur-br-federal": "br-inss",
        "jur-es-national": "es-jub",
        "jur-fr-national": "fr-cnav",
        "jur-de-federal": "de-drv",
        "jur-uk-national": "ua-pfu",
    }
    return mapping.get(jurisdiction_id, jurisdiction_id)


# English-language fallback names for the program header. Used by
# `_program_name_for` only when the i18n key `program.<slug>` has no
# matching ConfigValue. Localized values still flow through the substrate.
_PROGRAM_NAME_FALLBACKS = {
    "ca-oas": "Old Age Security",
    "br-inss": "Aposentadoria por Idade (INSS)",
    "es-jub": "Jubilación contributiva",
    "fr-cnav": "Retraite de base (CNAV)",
    "de-drv": "Altersrente (Deutsche Rentenversicherung)",
    "ua-pfu": "Пенсія за віком",
}


def _program_name_for(jurisdiction_id: str, lang: str) -> str:
    """Localized program name for the notice header."""
    slug = _jurisdiction_slug(jurisdiction_id)
    # Existing UI label key pattern: `ui.label.program.<slug>.<lang>`.
    # Falls back to a sensible default if the label is missing.
    from govops.i18n import t as _t
    label = _t(f"program.{slug}", lang)
    if label.startswith("program."):  # i18n fell back to the key
        return _PROGRAM_NAME_FALLBACKS.get(slug, slug)
    return label


# ---------------------------------------------------------------------------
# ConfigValue API (Law-as-Code v2.0 Phase 1)
# Read-only endpoints; write/approve land in Phase 6.
# ---------------------------------------------------------------------------

@app.get("/api/config/values")
def list_config_values(
    domain: str | None = None,
    key_prefix: str | None = None,
    jurisdiction_id: str | None = None,
    language: str | None = None,
    status: str | None = None,
):
    """List ConfigValue records, optionally filtered."""
    status_enum: ApprovalStatus | None = None
    if status is not None:
        try:
            status_enum = ApprovalStatus(status)
        except ValueError as exc:
            raise HTTPException(400, f"Invalid status: {status}") from exc
    rows = config_store.list(
        domain=domain,
        key_prefix=key_prefix,
        jurisdiction_id=jurisdiction_id,
        language=language,
        status=status_enum,
    )
    return {"values": rows, "count": len(rows)}


@app.get("/api/config/values/{value_id}")
def get_config_value(value_id: str):
    """Fetch a single ConfigValue by id."""
    cv = config_store.get(value_id)
    if cv is None:
        raise HTTPException(404, f"ConfigValue {value_id} not found")
    return cv


@app.get("/api/config/resolve")
def resolve_config_value(
    key: str,
    evaluation_date: str | None = None,
    jurisdiction_id: str | None = None,
    language: str | None = None,
):
    """Resolve the ConfigValue in effect for `key` at `evaluation_date`.

    `evaluation_date` must be ISO-8601 with timezone (e.g. `2027-01-01T00:00:00+00:00`);
    defaults to now (UTC) if omitted.

    Returns the matching `ConfigValue` directly, or JSON `null` if no record is in
    effect. Clients distinguish "no current value" from a fetch error by checking
    for `null` rather than relying on a 404 status.
    """
    if evaluation_date is None:
        when = datetime.now(timezone.utc)
    else:
        try:
            when = datetime.fromisoformat(evaluation_date)
        except ValueError as exc:
            raise HTTPException(
                400,
                f"Invalid evaluation_date: {exc}. Expected ISO-8601 with timezone.",
            ) from exc
        if when.tzinfo is None:
            raise HTTPException(
                400,
                "evaluation_date must include a timezone (e.g. ...+00:00).",
            )
    return config_store.resolve(
        key=key,
        evaluation_date=when,
        jurisdiction_id=jurisdiction_id,
        language=language,
    )


@app.get("/api/config/versions")
def list_config_versions(
    key: str,
    jurisdiction_id: str | None = None,
    language: str | None = None,
):
    """Return the full version history for a key, oldest-first."""
    versions = config_store.list_versions(
        key=key,
        jurisdiction_id=jurisdiction_id,
        language=language,
    )
    return {"key": key, "versions": versions, "count": len(versions)}


# ---------------------------------------------------------------------------
# ConfigValue write endpoints (Phase 6 — admin UI backend)
# ---------------------------------------------------------------------------


class CreateConfigValueRequest(BaseModel):
    domain: str
    key: str
    jurisdiction_id: str | None = None
    value: Any
    value_type: ValueType
    effective_from: str  # ISO-8601 with tz
    effective_to: str | None = None
    citation: str | None = None
    author: str
    rationale: str = ""
    supersedes: str | None = None
    language: str | None = None


class ApproveRequest(BaseModel):
    approved_by: str
    comment: str = ""


class ReviewRequest(BaseModel):
    reviewer: str
    comment: str = ""


def _parse_iso(value: str | None, field: str) -> datetime | None:
    if value is None:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(400, f"Invalid {field}: {exc}. Expected ISO-8601 with timezone.") from exc
    if dt.tzinfo is None:
        raise HTTPException(400, f"{field} must include a timezone (e.g. ...+00:00).")
    return dt


@app.post("/api/config/values", status_code=201)
def create_config_value(body: CreateConfigValueRequest):
    """Create a new ConfigValue draft. Status starts at DRAFT; an /approve
    call is required before the record participates in resolution."""
    eff_from = _parse_iso(body.effective_from, "effective_from")
    eff_to = _parse_iso(body.effective_to, "effective_to")
    if eff_from is None:
        raise HTTPException(400, "effective_from is required")
    cv = ConfigValue(
        domain=body.domain,
        key=body.key,
        jurisdiction_id=body.jurisdiction_id,
        value=body.value,
        value_type=body.value_type,
        effective_from=eff_from,
        effective_to=eff_to,
        citation=body.citation,
        author=body.author,
        approved_by=None,
        rationale=body.rationale,
        supersedes=body.supersedes,
        status=ApprovalStatus.DRAFT,
        language=body.language,
    )
    config_store.put(cv)
    config_store.record_audit(
        config_value_id=cv.id,
        event="draft_created",
        actor=body.author,
        comment=body.rationale,
    )
    return cv


@app.post("/api/config/values/{value_id}/approve")
def approve_config_value(value_id: str, body: ApproveRequest):
    """Approve a draft/pending ConfigValue. Sets status=APPROVED and
    approved_by; the record now participates in resolution."""
    cv = config_store.get(value_id)
    if cv is None:
        raise HTTPException(404, f"ConfigValue {value_id} not found")
    if cv.status == ApprovalStatus.APPROVED:
        raise HTTPException(409, f"ConfigValue {value_id} is already approved")
    if cv.status == ApprovalStatus.REJECTED:
        raise HTTPException(409, f"ConfigValue {value_id} was rejected; cannot approve")
    if body.approved_by == cv.author:
        # ADR-008 dual-approval: prompts require approver != author. Apply the
        # constraint to all domains as a defensive default; the admin UI can
        # surface a specific message.
        if cv.value_type == ValueType.PROMPT:
            raise HTTPException(
                403,
                "Per ADR-008, prompt approvals require approved_by != author (dual approval).",
            )
    cv.status = ApprovalStatus.APPROVED
    cv.approved_by = body.approved_by
    config_store.put(cv)
    config_store.record_audit(
        config_value_id=value_id,
        event="approved",
        actor=body.approved_by,
        comment=body.comment,
    )
    return cv


@app.post("/api/config/values/{value_id}/request-changes")
def request_changes_config_value(value_id: str, body: ReviewRequest):
    """Send a pending value back to draft for further author edits."""
    cv = config_store.get(value_id)
    if cv is None:
        raise HTTPException(404, f"ConfigValue {value_id} not found")
    if cv.status == ApprovalStatus.APPROVED:
        raise HTTPException(409, f"ConfigValue {value_id} already approved")
    cv.status = ApprovalStatus.DRAFT
    config_store.put(cv)
    config_store.record_audit(
        config_value_id=value_id,
        event="request_changes",
        actor=body.reviewer,
        comment=body.comment,
    )
    return cv


@app.post("/api/config/values/{value_id}/reject")
def reject_config_value(value_id: str, body: ReviewRequest):
    """Reject a draft/pending ConfigValue. Terminal state — record is kept
    for audit but never participates in resolution."""
    cv = config_store.get(value_id)
    if cv is None:
        raise HTTPException(404, f"ConfigValue {value_id} not found")
    if cv.status == ApprovalStatus.APPROVED:
        raise HTTPException(409, f"ConfigValue {value_id} already approved; cannot reject")
    cv.status = ApprovalStatus.REJECTED
    config_store.put(cv)
    config_store.record_audit(
        config_value_id=value_id,
        event="rejected",
        actor=body.reviewer,
        comment=body.comment,
    )
    return cv


# ---------------------------------------------------------------------------
# Impact / reverse-index API (Law-as-Code v2.0 Phase 7)
# ---------------------------------------------------------------------------

def _jurisdiction_label(jurisdiction_id: str | None) -> str:
    """Best-effort human label for a ConfigValue ``jurisdiction_id``.

    Records carry ids like ``ca-oas`` or ``fr-cnav``; the registry is keyed by
    the country code (``ca``, ``fr``). Falls back to the raw id when the prefix
    doesn't resolve, so unknown jurisdictions still render meaningfully.
    """
    if jurisdiction_id is None:
        return "Global"
    code = jurisdiction_id.split("-", 1)[0]
    pack = JURISDICTION_REGISTRY.get(code)
    if pack is None:
        return jurisdiction_id
    return f"{pack.program_name} — {pack.jurisdiction.name}"


@app.get("/api/impact")
def impact_by_citation(citation: str = ""):
    """Return ConfigValues referencing ``citation``, grouped by jurisdiction.

    Phase 7 reverse-index endpoint. Empty / whitespace ``citation`` rejects with
    400 so clients always send a meaningful query. Normalization (whitespace
    collapse + case-insensitive match) lives in ``ConfigStore.find_by_citation``.
    """
    if not citation or not citation.strip():
        raise HTTPException(400, "citation query parameter is required and must be non-empty")
    normalized = " ".join(citation.split())
    matches = config_store.find_by_citation(normalized)

    groups: dict[str | None, list[ConfigValue]] = {}
    for cv in matches:
        scope: str | None = None if cv.jurisdiction_id in (None, "global") else cv.jurisdiction_id
        groups.setdefault(scope, []).append(cv)

    results: list[dict[str, Any]] = []
    if None in groups:
        results.append(
            {
                "jurisdiction_id": None,
                "jurisdiction_label": _jurisdiction_label(None),
                "values": groups[None],
            }
        )
    for jid in sorted(k for k in groups if k is not None):
        results.append(
            {
                "jurisdiction_id": jid,
                "jurisdiction_label": _jurisdiction_label(jid),
                "values": groups[jid],
            }
        )

    return {
        "query": normalized,
        "total": len(matches),
        "jurisdiction_count": len(results),
        "results": results,
    }


# ---------------------------------------------------------------------------
# Self-screening API (Law-as-Code v2.0 Phase 10A)
# ---------------------------------------------------------------------------


@app.post("/api/screen", response_model=ScreenResponse)
def screen(req: ScreenRequest) -> ScreenResponse:
    """Anonymous citizen-facing eligibility pre-check.

    Phase 10A: runs the engine against the supplied facts and returns a
    decision-support hint. **No case row is created**, **no audit entry is
    written**, and the response carries no PII or applicant identifier.
    Repeated calls with the same payload are stateless on the server side.
    """
    try:
        return run_screen(req)
    except UnknownJurisdiction as exc:
        raise HTTPException(
            404,
            f"Unknown jurisdiction '{exc.args[0]}'. "
            f"Known: {sorted(JURISDICTION_REGISTRY)}",
        ) from exc


@app.post("/api/screen/notice")
def screen_notice(req: ScreenRequest, lang: str = "en"):
    """Render a portable decision notice from a screen request (Phase 10C).

    Privacy posture identical to ``POST /api/screen``: no case row, no
    audit entry, no PII echoed. Returns ``text/html`` with the same
    sha256 / template-version headers as ``GET /api/cases/{id}/notice``
    so a downstream surface can hash-verify the artefact against any
    other render the citizen receives.

    The notice is byte-identical to what an officer would see for the
    same inputs evaluated on the same date — same engine, same dated
    template, same i18n state. Citizens get the same evidence officers do.
    """
    from fastapi.responses import HTMLResponse

    from govops.notices import NoticeRenderError
    from govops.screen import render_screen_notice_html

    try:
        html, sha256, template_version = render_screen_notice_html(req, language=lang)
    except UnknownJurisdiction as exc:
        raise HTTPException(
            404,
            f"Unknown jurisdiction '{exc.args[0]}'. "
            f"Known: {sorted(JURISDICTION_REGISTRY)}",
        ) from exc
    except NoticeRenderError as exc:
        raise HTTPException(404, str(exc)) from exc

    return HTMLResponse(
        content=html,
        headers={
            "X-Notice-Sha256": sha256,
            "X-Notice-Template-Version": template_version,
            "X-Notice-Language": lang,
        },
    )


# ---------------------------------------------------------------------------
# HTML UI routes
# ---------------------------------------------------------------------------

def _get_lang(request: Request) -> str:
    return request.query_params.get("lang", DEFAULT_LANGUAGE)


@app.get("/", response_class=HTMLResponse)
def ui_about(request: Request):
    lang = _get_lang(request)
    ctx = _base_context(lang)
    return templates.TemplateResponse(request=request, name="about.html", context=ctx)


@app.get("/cases", response_class=HTMLResponse)
def ui_home(request: Request):
    lang = _get_lang(request)
    jur_code = _current_jur_code()
    pack = JURISDICTION_REGISTRY[jur_code]
    cases = [
        {
            "id": c.id,
            "applicant_name": c.applicant.legal_name,
            "status": c.status.value,
            "dob": str(c.applicant.date_of_birth),
            "legal_status": c.applicant.legal_status,
            "has_recommendation": c.id in store.recommendations,
        }
        for c in store.cases.values()
    ]
    ctx = _base_context(lang)
    ctx.update({
        "cases": cases,
        "jurisdiction": pack.jurisdiction,
    })
    return templates.TemplateResponse(request=request, name="index.html", context=ctx)


@app.post("/switch-jurisdiction", response_class=HTMLResponse)
async def ui_switch_jurisdiction(request: Request):
    form = await request.form()
    jur_code = form.get("jur_code", DEFAULT_JURISDICTION)
    lang = form.get("lang", DEFAULT_LANGUAGE)
    if jur_code in JURISDICTION_REGISTRY:
        _seed_jurisdiction(jur_code)
        # Auto-switch to jurisdiction's default language
        pack = JURISDICTION_REGISTRY[jur_code]
        lang = pack.default_language
    return RedirectResponse(url=f"/cases?lang={lang}", status_code=303)


@app.get("/authority", response_class=HTMLResponse)
def ui_authority(request: Request):
    lang = _get_lang(request)
    jur_code = _current_jur_code()
    pack = JURISDICTION_REGISTRY[jur_code]
    ctx = _base_context(lang)
    ctx.update({
        "jurisdiction": pack.jurisdiction,
        "chain": store.authority_chain,
        "documents": list(store.legal_documents.values()),
        "rules": list(store.rules.values()),
    })
    return templates.TemplateResponse(request=request, name="authority.html", context=ctx)


@app.get("/cases/{case_id}", response_class=HTMLResponse)
def ui_case_detail(request: Request, case_id: str):
    lang = _get_lang(request)
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404)
    rec = store.recommendations.get(case_id)
    reviews = store.review_actions.get(case_id, [])
    trail = store.audit_trails.get(case_id, [])
    ctx = _base_context(lang)
    ctx.update({
        "case": case,
        "recommendation": rec,
        "reviews": reviews,
        "audit_trail": trail,
    })
    return templates.TemplateResponse(request=request, name="case_detail.html", context=ctx)


@app.post("/cases/{case_id}/evaluate", response_class=HTMLResponse)
def ui_evaluate(request: Request, case_id: str):
    lang = _get_lang(request)
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404)
    engine = OASEngine(rules=list(store.rules.values()))
    rec, audit = engine.evaluate(case)
    store.save_recommendation(rec, audit)
    return RedirectResponse(url=f"/cases/{case_id}?lang={lang}", status_code=303)


@app.post("/cases/{case_id}/review", response_class=HTMLResponse)
async def ui_review(request: Request, case_id: str):
    lang = _get_lang(request)
    form = await request.form()
    action = _form_str(form, "action", "approve")
    rationale = _form_str(form, "rationale")
    rec = store.recommendations.get(case_id)
    if not rec:
        raise HTTPException(400, "Evaluate first")
    review = HumanReviewAction(
        case_id=case_id,
        recommendation_id=rec.id,
        action=ReviewAction(action),
        rationale=rationale,
        final_outcome=rec.outcome,
    )
    store.save_review(review)
    return RedirectResponse(url=f"/cases/{case_id}?lang={lang}", status_code=303)


@app.get("/cases/{case_id}/audit-view", response_class=HTMLResponse)
def ui_audit(request: Request, case_id: str):
    lang = _get_lang(request)
    pkg = store.build_audit_package(case_id)
    if not pkg:
        raise HTTPException(404)
    ctx = _base_context(lang)
    ctx["pkg"] = pkg
    return templates.TemplateResponse(request=request, name="audit.html", context=ctx)


@app.get("/mvp", response_class=HTMLResponse)
def ui_mvp(request: Request):
    lang = _get_lang(request)
    cases = [
        {
            "id": c.id,
            "applicant_name": c.applicant.legal_name,
            "status": c.status.value,
            "dob": str(c.applicant.date_of_birth),
            "legal_status": c.applicant.legal_status,
        }
        for c in store.cases.values()
    ]
    ctx = _base_context(lang)
    ctx["cases"] = cases
    return templates.TemplateResponse(request=request, name="mvp_sample.html", context=ctx)


@app.get("/admin", response_class=HTMLResponse)
def ui_admin(request: Request):
    lang = _get_lang(request)
    review_count = sum(len(v) for v in store.review_actions.values())
    audit_entry_count = sum(len(v) for v in store.audit_trails.values())
    ctx = _base_context(lang)
    ctx.update({
        "store_jurisdictions": store.jurisdictions,
        "authority_chain": store.authority_chain,
        "legal_documents": list(store.legal_documents.values()),
        "rules": list(store.rules.values()),
        "cases": list(store.cases.values()),
        "recommendations": store.recommendations,
        "review_actions": store.review_actions,
        "review_count": review_count,
        "audit_trails": store.audit_trails,
        "audit_entry_count": audit_entry_count,
        "stats": {
            "jurisdictions": len(store.jurisdictions),
            "authority_links": len(store.authority_chain),
            "legal_documents": len(store.legal_documents),
            "rules": len(store.rules),
            "cases": len(store.cases),
            "recommendations": len(store.recommendations),
            "reviews": review_count,
            "audit_entries": audit_entry_count,
        },
    })
    return templates.TemplateResponse(request=request, name="admin.html", context=ctx)


# ---------------------------------------------------------------------------
# Encoding pipeline routes
# ---------------------------------------------------------------------------

@app.get("/encode", response_class=HTMLResponse)
def ui_encode(request: Request):
    lang = _get_lang(request)
    ctx = _base_context(lang)
    ctx.update({
        "batches": list(encoding_store.batches.values()),
        "audit": encoding_store.audit,
    })
    return templates.TemplateResponse(request=request, name="encode.html", context=ctx)


@app.post("/encode/ingest", response_class=HTMLResponse)
async def ui_encode_ingest(request: Request):
    lang = _get_lang(request)
    form = await request.form()
    document_title = _form_str(form, "document_title")
    document_citation = _form_str(form, "document_citation")
    input_text = _form_str(form, "input_text")
    method = _form_str(form, "method", "manual")
    api_key = _form_str(form, "api_key")

    jur_code = _current_jur_code()
    batch = encoding_store.create_batch(
        jurisdiction_id=jur_code,
        document_title=document_title,
        document_citation=document_citation,
        input_text=input_text,
    )

    if method == "llm" and api_key:
        try:
            (
                proposals,
                prompt,
                raw_response,
                user_prompt_key,
                system_prompt_key,
            ) = await extract_rules_with_llm(batch, api_key=api_key)
            encoding_store.add_proposals(
                batch.id, proposals, method="llm:claude",
                prompt=prompt, raw_response=raw_response,
                prompt_key=user_prompt_key,
                system_prompt_key=system_prompt_key,
            )
        except Exception as e:
            # Fallback to manual on error
            proposals = extract_rules_manual(batch)
            encoding_store.add_proposals(
                batch.id, proposals, method="manual:llm-fallback",
                raw_response=f"LLM extraction failed: {e}",
            )
    else:
        proposals = extract_rules_manual(batch)
        encoding_store.add_proposals(batch.id, proposals, method="manual")

    return RedirectResponse(url=f"/encode/{batch.id}?lang={lang}", status_code=303)


@app.get("/encode/{batch_id}", response_class=HTMLResponse)
def ui_encode_review(request: Request, batch_id: str):
    lang = _get_lang(request)
    batch = encoding_store.batches.get(batch_id)
    if not batch:
        raise HTTPException(404)
    ctx = _base_context(lang)
    ctx["batch"] = batch
    return templates.TemplateResponse(request=request, name="encode_review.html", context=ctx)


@app.post("/encode/{batch_id}/review/{proposal_id}", response_class=HTMLResponse)
async def ui_encode_proposal_review(request: Request, batch_id: str, proposal_id: str):
    lang = _get_lang(request)
    form = await request.form()
    status_str = _form_str(form, "status", "approved")
    notes = _form_str(form, "notes")
    try:
        status = ProposalStatus(status_str)
    except ValueError:
        status = ProposalStatus.APPROVED
    encoding_store.review_proposal(
        batch_id, proposal_id, status=status, reviewer="expert", notes=notes,
    )
    return RedirectResponse(url=f"/encode/{batch_id}?lang={lang}", status_code=303)


@app.post("/encode/{batch_id}/bulk", response_class=HTMLResponse)
async def ui_encode_bulk_review(request: Request, batch_id: str):
    lang = _get_lang(request)
    form = await request.form()
    status_str = form.get("status", "approved")
    try:
        status = ProposalStatus(status_str)
    except ValueError:
        status = ProposalStatus.APPROVED
    batch = encoding_store.batches.get(batch_id)
    if batch:
        for p in batch.proposals:
            if p.status == ProposalStatus.PENDING:
                encoding_store.review_proposal(
                    batch_id, p.id, status=status, reviewer="expert (bulk)",
                )
    return RedirectResponse(url=f"/encode/{batch_id}?lang={lang}", status_code=303)


@app.post("/encode/{batch_id}/commit", response_class=HTMLResponse)
def ui_encode_commit(request: Request, batch_id: str):
    lang = _get_lang(request)
    approved_rules = encoding_store.get_approved_rules(batch_id)
    for rule in approved_rules:
        store.rules[rule.id] = rule
    encoding_store._log(
        batch_id, "rules_committed", "system",
        f"{len(approved_rules)} rules committed to active engine",
        {"rule_ids": [r.id for r in approved_rules]},
    )
    return RedirectResponse(url=f"/admin?lang={lang}", status_code=303)
