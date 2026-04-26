"""GovOps FastAPI application.

Serves both the JSON API and the Jinja2 demo UI.
Supports multiple jurisdictions and languages.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from starlette.datastructures import FormData, UploadFile as StarletteUploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from datetime import datetime, timezone

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
    DecisionOutcome,
    HumanReviewAction,
    ReviewAction,
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_jurisdiction(DEFAULT_JURISDICTION)
    seed_encoding_example(encoding_store)
    # Hydrate the substrate from lawcode/ if it's empty (per ADR-010).
    # Skip when pre-populated (test fixtures rely on this); idempotent on
    # natural key, so a partially-seeded store is also tolerated.
    if len(config_store) == 0 and LAWCODE_DIR.exists():
        config_store.load_from_yaml(LAWCODE_DIR)
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
    store.save_recommendation(rec, audit)
    return {"recommendation": rec}


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
# ConfigValue API (Law-as-Code v2.0 Phase 1)
# Read-only endpoints; write/approve land in Phase 6.
# ---------------------------------------------------------------------------

@app.get("/api/config/values")
def list_config_values(
    domain: str | None = None,
    key_prefix: str | None = None,
    jurisdiction_id: str | None = None,
    language: str | None = None,
):
    """List ConfigValue records, optionally filtered."""
    rows = config_store.list(
        domain=domain,
        key_prefix=key_prefix,
        jurisdiction_id=jurisdiction_id,
        language=language,
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
