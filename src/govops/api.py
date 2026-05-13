"""GovOps FastAPI application.

Serves both the JSON API and the Jinja2 demo UI.
Supports multiple jurisdictions and languages.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from starlette.datastructures import FormData, UploadFile as StarletteUploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from datetime import date, datetime, timezone

from govops.authoring import (
    AuthoringError,
    Draft,
    DraftStatus,
    DraftStore,
    DraftType,
    TargetPathConflict,
)
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
from govops.engine import ProgramEngine
from govops.i18n import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, get_translator
from govops.jurisdictions import (
    JURISDICTION_REGISTRY,
    _LAWCODE_ROOT,
    reload_registry,
)
from govops.models import (
    AuditEntry,
    CaseEvent,
    DecisionOutcome,
    EventType,
    HumanReviewAction,
    ProgramInteractionWarning,
    Recommendation,
    ReviewAction,
)
from govops.program_interactions import detect_program_interactions
from govops.programs import Program, load_program_manifest
from govops.screen import (
    CheckRequest,
    CheckResponse,
    ScreenRequest,
    ScreenResponse,
    UnknownJurisdiction,
    run_check,
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
# v3.1 L7 (ADR-022) authoring substrate: drafts of jurisdiction.yaml +
# program manifests are staged here; commit_approved() writes them to
# lawcode/ and reload_registry() picks them up.
draft_store = DraftStore(_LAWCODE_ROOT)
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
    # v3 / ADR-018 — register every program available for this jurisdiction so
    # the cross-program /evaluate endpoint sees them. The legacy OAS-shaped
    # rules just seeded above become the canonical OAS Program; any other
    # programs declared as manifests under `lawcode/<jur>/programs/*.yaml`
    # are loaded directly. JP has no EI manifest by design (charter §"The
    # proof") — registration silently skips it.
    _register_jurisdiction_programs(jur_code, pack)


def _register_jurisdiction_programs(jur_code: str, pack) -> None:
    """Populate `store.programs` for the freshly-seeded jurisdiction.

    OAS is synthesised from the rules `seed.py`/`jurisdictions.py` already
    pushed into `store`, preserving byte-identical evaluation for the 30+
    pre-v3 callers that POST `/api/cases/{id}/evaluate` with no body. Every
    other manifest under `lawcode/<jur_code>/programs/` is loaded via
    `load_program_manifest` so EI, when present, attaches automatically.
    """
    oas_program = Program(
        program_id="oas",
        jurisdiction_id=pack.jurisdiction.id,
        shape="old_age_pension",
        status="active",
        name={"en": pack.program_name},
        rules=list(store.rules.values()),
        authority_chain=list(store.authority_chain),
        legal_documents=list(store.legal_documents.values()),
        demo_cases=list(store.cases.values()),
    )
    store.register_program(oas_program)

    programs_dir = LAWCODE_DIR / jur_code / "programs"
    if not programs_dir.exists():
        return
    for manifest_path in sorted(programs_dir.glob("*.yaml")):
        if manifest_path.name.startswith("_"):
            continue
        if manifest_path.stem == "oas":
            # OAS is already covered by the synthesised Program above —
            # the manifest version (only present for CA today) would
            # duplicate the rule set under a different LegalRule.id and
            # break the back-compat path's byte-identical guarantee.
            continue
        try:
            program = load_program_manifest(manifest_path)
        except Exception:
            # Manifest loading failures are surfaced by the schema-validation
            # CI job; the API stays best-effort so a malformed file doesn't
            # take the whole jurisdiction offline.
            continue
        store.register_program(program)
        # Phase I: when the demo seed is on, also surface the program's
        # demo cases in `/api/cases` so a visitor lands on a populated
        # case list across both OAS and EI. Gated on GOVOPS_SEED_DEMO=1
        # so the existing pre-v3 case-count test invariants
        # (4 cases per jurisdiction in test_api.py) keep holding by
        # default.
        if os.environ.get("GOVOPS_SEED_DEMO") == "1":
            for case in program.demo_cases:
                if case.id in store.cases:
                    continue  # idempotent — re-seed doesn't duplicate
                store.cases[case.id] = case
                store.audit_trails.setdefault(case.id, []).append(
                    AuditEntry(
                        event_type="case_created",
                        actor="system:demo-seed",
                        detail=(
                            f"Demo case seeded: {case.applicant.legal_name} "
                            f"(program={program.program_id})"
                        ),
                    )
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
    # LO-006: federation surfaces need a publisher + imported pack to be
    # exercisable end-to-end. GOVOPS_SEED_FEDERATION_DEMO=1 + GOVOPS_LAWCODE_DIR
    # together write a stub seed into a sandbox dir (never the on-repo tree).
    from govops.federation_seed import maybe_seed_federation_demo
    maybe_seed_federation_demo()
    # v2.1 — start the daily GC scheduler when GOVOPS_DEMO_MODE=1.
    # No-op for local dev (env unset). See govops.gc_scheduler.
    from govops.gc_scheduler import start_scheduler, shutdown_scheduler
    start_scheduler(config_store)
    yield
    shutdown_scheduler()


app = FastAPI(
    title="GovOps",
    description="Policy-Driven Service Delivery Machine - Independent prototype using publicly available legislation as illustrative case studies.",
    version="0.5.0",
    lifespan=lifespan,
)

# v2.1 hosted-demo middleware stack. Order matters: rate-limit FIRST (cheapest
# to evaluate, blocks abuse before we do any work), then demo-mode header.
# Both are no-ops when their env vars are unset, so local dev sees no change.
# CORS goes LAST so it ends up outermost -- preflight OPTIONS must be answered
# before rate-limit/demo-mode see it.
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from govops.rate_limit import RateLimitMiddleware  # noqa: E402
from govops.demo_mode import DemoModeMiddleware  # noqa: E402

app.add_middleware(DemoModeMiddleware)
app.add_middleware(RateLimitMiddleware)

# CORS for the documented two-process dev workflow (FastAPI + Vite dev server
# on different ports) and for the E2E suite (uncommon ports per
# web/playwright.config.ts). Production / HF deploy serves frontend and
# backend from the same origin, so this regex never matches there. Localhost
# CORS is safe -- only processes already on the machine can match.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
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
    from govops.demo_mode import is_demo_mode
    from govops.llm_proxy import configured_providers

    jur_code = _current_jur_code()
    pack = JURISDICTION_REGISTRY.get(jur_code)
    return {
        "status": "healthy",
        "engine": "govops-demo",
        "version": "2.1.0",
        "jurisdiction": jur_code,
        "program": pack.program_name if pack else "",
        "available_jurisdictions": list(JURISDICTION_REGISTRY.keys()),
        "demo_mode": is_demo_mode(),
        "llm_providers": configured_providers(),
    }


# ---------------------------------------------------------------------------
# v2.1 LLM proxy endpoint — used by the encoder UI on the hosted demo so
# visitors don't need their own API key. Rate-limited per IP via
# RateLimitMiddleware (default 5 req/min, 100 req/day).
# ---------------------------------------------------------------------------


class _ChatMessage(BaseModel):
    role: str  # "system" | "user" | "assistant"
    content: str


class LLMChatRequest(BaseModel):
    messages: list[_ChatMessage]
    max_tokens: int = 1024
    temperature: float = 0.2


@app.post("/api/llm/chat")
async def llm_chat(payload: LLMChatRequest):
    """Proxy a chat-completion request through the configured provider chain.

    Returns a minimal subset of the OpenAI Chat Completions response shape:
        { provider, model, content, elapsed_ms }

    503 when no provider is configured; 502 when every provider in the chain
    fails. Rate-limited at the middleware layer.
    """
    from govops.llm_proxy import (
        LLMConfigError,
        LLMExhaustedError,
        chat as proxy_chat,
    )

    try:
        result = await proxy_chat(
            messages=[m.model_dump() for m in payload.messages],
            max_tokens=payload.max_tokens,
            temperature=payload.temperature,
        )
    except LLMConfigError as exc:
        raise HTTPException(503, f"LLM proxy not configured: {exc}") from exc
    except LLMExhaustedError as exc:
        raise HTTPException(502, f"All LLM providers failed: {exc}") from exc

    return {
        "provider": result.provider,
        "model": result.model,
        "content": result.content,
        "elapsed_ms": result.elapsed_ms,
    }


@app.post("/api/jurisdiction/{jur_code}")
def switch_jurisdiction(jur_code: str):
    if jur_code not in JURISDICTION_REGISTRY:
        raise HTTPException(400, f"Unknown jurisdiction: {jur_code}. Available: {list(JURISDICTION_REGISTRY.keys())}")
    _seed_jurisdiction(jur_code)
    pack = JURISDICTION_REGISTRY[jur_code]
    return {"jurisdiction": jur_code, "name": pack.jurisdiction.name, "program": pack.program_name}


# Mirrors `legacy_constants._JURISDICTION_PREFIX_TO_ID`. Imported lazily to
# avoid a circular import at module load (legacy_constants pulls config which
# pulls api in some test setups).
_JUR_PREFIX_TO_SUBSTRATE_ID = {
    "ca": "ca-oas",
    "br": "br-inss",
    "es": "es-jub",
    "fr": "fr-cnav",
    "de": "de-drv",
    "ua": "ua-pfu",
    "jp": "jp-koukinenkin",
}


@app.get("/api/jurisdiction/{jur_code}")
def get_jurisdiction(jur_code: str):
    """Public jurisdiction metadata for the citizen-facing /screen route.

    Per govops-022 the response carries a ``howto_url`` field resolved
    through the substrate (key ``jurisdiction.<code>.howto_url`` scoped
    to the jurisdiction's substrate id, e.g. ``ca-oas``). Missing record
    → ``howto_url: null`` (the UI falls back to its preview-mode table).
    """
    if jur_code not in JURISDICTION_REGISTRY:
        raise HTTPException(404, f"Unknown jurisdiction: {jur_code}. Available: {list(JURISDICTION_REGISTRY.keys())}")
    pack = JURISDICTION_REGISTRY[jur_code]
    substrate_id = _JUR_PREFIX_TO_SUBSTRATE_ID.get(jur_code)
    howto_url: str | None = None
    if substrate_id is not None:
        cv = config_store.resolve(
            f"jurisdiction.{jur_code}.howto_url",
            evaluation_date=datetime.now(timezone.utc),
            jurisdiction_id=substrate_id,
        )
        if cv is not None and isinstance(cv.value, str) and cv.value:
            howto_url = cv.value
    return {
        "id": pack.jurisdiction.id,
        "jurisdiction_label": pack.jurisdiction.name,
        "program_name": pack.program_name,
        "default_language": pack.default_language,
        "howto_url": howto_url,
    }


@app.get("/api/authority-chain")
def get_authority_chain(jurisdiction_id: str | None = None):
    """Return the authority chain for a jurisdiction.

    v3.1 L4: optional ``?jurisdiction_id=`` query param. Default behaviour
    preserved (uses the active jurisdiction from the store) so existing
    callers keep working. The frontend picker passes the chosen code so a
    single backend serves the multi-jurisdiction /authority page without
    server-side state mutation. Per ADR-020 the registry is now derived
    from lawcode/, so every JURISDICTION_REGISTRY[code] carries its own
    authority_chain ready to return.
    """
    available = [
        {"code": code, "label": p.jurisdiction.name}
        for code, p in sorted(JURISDICTION_REGISTRY.items())
    ]
    if jurisdiction_id and jurisdiction_id in JURISDICTION_REGISTRY:
        pack = JURISDICTION_REGISTRY[jurisdiction_id]
        return {
            "jurisdiction": pack.jurisdiction,
            "chain": pack.authority_chain,
            "available_jurisdictions": available,
            "active_jurisdiction_code": jurisdiction_id,
        }
    if jurisdiction_id is not None and jurisdiction_id not in JURISDICTION_REGISTRY:
        raise HTTPException(
            404,
            f"Unknown jurisdiction: {jurisdiction_id!r}. "
            f"Available: {sorted(JURISDICTION_REGISTRY.keys())}",
        )
    jur_code = _current_jur_code()
    pack = JURISDICTION_REGISTRY[jur_code]
    return {
        "jurisdiction": pack.jurisdiction,
        "chain": store.authority_chain,
        "available_jurisdictions": available,
        "active_jurisdiction_code": jur_code,
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


class EvaluateRequest(BaseModel):
    """Optional cross-program selector for the evaluate endpoint (ADR-018).

    `programs` lists the program ids to run. Omit (or send empty) to run
    every program registered for the case's jurisdiction. Unknown ids
    return HTTP 400.
    """
    programs: list[str] | None = None


@app.post("/api/cases/{case_id}/evaluate")
def evaluate_case(case_id: str, body: EvaluateRequest | None = None):
    """Run the rule engine against the case (ADR-018 — cross-program).

    Backward compatible: callers that POST with no body keep getting the
    same `{"recommendation": ...}` shape they did pre-v3. v3 callers also
    receive `program_evaluations` (one Recommendation per program) and
    `warnings` (cross-program interaction notes).
    """
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")

    requested = list(body.programs) if (body and body.programs) else None

    # Legacy fallback: when no programs are registered (ad-hoc test fixtures
    # that bypass `_seed_jurisdiction`), preserve the v2 single-engine path
    # exactly. v3 deployments register programs at seed time, so this branch
    # is dead code for the demo but keeps the door open for direct DemoStore
    # usage in tests.
    if not store.programs:
        engine = ProgramEngine(rules=list(store.rules.values()))
        rec, audit = engine.evaluate(case)
        prior = store.recommendations.get(case_id)
        if prior is not None:
            rec.supersedes = prior.id
        store.save_recommendation(rec, audit)
        store.program_warnings[case_id] = []
        return {
            "recommendation": rec,
            "program_evaluations": [rec],
            "warnings": [],
        }

    if requested is None:
        program_ids = list(store.programs.keys())
    else:
        unknown = [p for p in requested if p not in store.programs]
        if unknown:
            raise HTTPException(
                400,
                f"Unknown program(s) for this jurisdiction: {unknown}. "
                f"Available: {list(store.programs.keys())}",
            )
        program_ids = list(requested)

    # Decide which program is the back-compat *primary* BEFORE running, so
    # only its rec writes through `save_recommendation` (which updates the
    # singular `recommendations[case_id]` and the flat
    # `recommendation_history[case_id]` chain that ADR-013 supersession +
    # legacy audit/notice consumers walk). Others go to the per-program
    # index via `save_secondary_program_recommendation`. OAS wins when
    # present so v2 callers keep reading the OAS rec from the back-compat
    # surfaces; otherwise the first selected program is primary.
    primary_id = "oas" if "oas" in program_ids else program_ids[0]

    evaluations: list[Recommendation] = []
    for pid in program_ids:
        program = store.programs[pid]
        engine = ProgramEngine(program=program)
        rec, audit = engine.evaluate(case)
        prior = store.program_recommendations.get(case_id, {}).get(pid)
        if prior is not None:
            rec.supersedes = prior.id
        if pid == primary_id:
            store.save_recommendation(rec, audit)
        else:
            store.save_secondary_program_recommendation(rec, audit)
        evaluations.append(rec)

    warnings = detect_program_interactions(evaluations, case.jurisdiction_id)
    store.program_warnings[case_id] = warnings

    # Back-compat alias: the singular `recommendation` field returns the
    # OAS recommendation when present, otherwise the first evaluation.
    primary = next(
        (r for r in evaluations if r.program_id == "oas"),
        evaluations[0],
    )

    return {
        "recommendation": primary,
        "program_evaluations": evaluations,
        "warnings": warnings,
    }


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

        engine = ProgramEngine(rules=list(store.rules.values()), evaluation_date=as_of)
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
# Encoder JSON API (mirrors the Jinja /encode/* HTML routes)
#
# Pre-LO-002 the React /encode UI's calls to /api/encode/batches all 404'd
# and silently fell back to a browser-local mock, so encoder state was
# never persisted server-side. These endpoints close that gap.
# ---------------------------------------------------------------------------


# Backend ProposalStatus enum vs React string-literal type:
#   backend EDITED ("edited") <-> React "modified"
# Bridge them at the JSON boundary so neither side has to know.
_BACKEND_TO_REACT_STATUS = {"edited": "modified"}
_REACT_TO_BACKEND_STATUS = {"modified": "edited"}

# React EncodeMethod is a closed enum: "manual" | "llm:claude" |
# "manual:llm-fallback". Backend can also emit "example:pre-loaded"
# (from seed_encoding_example) and "llm:openai" historically. Normalize
# unknowns to "manual" so the React MethodChip's lookup table never
# yields undefined (which crashes the page with a formatjs runtime
# "An `id` must be provided" error and broke /encode list rendering
# pre-fix).
_REACT_KNOWN_METHODS = {"manual", "llm:claude", "manual:llm-fallback"}


def _react_method(backend_method: str) -> str:
    if backend_method in _REACT_KNOWN_METHODS:
        return backend_method
    if backend_method.startswith("llm:"):
        return "llm:claude"
    return "manual"


def _react_status(backend_status) -> str:
    raw = backend_status.value if hasattr(backend_status, "value") else str(backend_status)
    return _BACKEND_TO_REACT_STATUS.get(raw, raw)


def _backend_status(react_status: str) -> str:
    return _REACT_TO_BACKEND_STATUS.get(react_status, react_status)


def _proposal_to_json(p) -> dict:
    """Flatten a backend RuleProposal -> the React RuleProposal shape.

    The backend nests the rule under ``proposed_rule`` (a LegalRule); the
    React side expects a flat shape with rule_type/description/etc.
    """
    rule = p.proposed_rule
    return {
        "id": p.id,
        "rule_type": rule.rule_type.value if hasattr(rule.rule_type, "value") else rule.rule_type,
        "description": rule.description,
        "formal_expression": rule.formal_expression,
        "citation": rule.citation,
        "parameters": dict(rule.parameters or {}),
        "status": _react_status(p.status),
        "notes": p.reviewer_notes or "",
        "reviewer": p.reviewed_by or None,
        "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None,
        "source_section_ref": p.source_section_ref or "",
    }


def _batch_audit_json(batch_id: str) -> list[dict]:
    return [
        {
            "timestamp": e.timestamp.isoformat(),
            "batch_id": e.batch_id,
            "event": e.event,
            "actor": e.actor,
            "detail": e.detail,
            "data": dict(e.data or {}),
        }
        for e in encoding_store.audit
        if e.batch_id == batch_id
    ]


def _batch_to_json(b) -> dict:
    return {
        "id": b.id,
        "jurisdiction_id": b.jurisdiction_id,
        "document_title": b.document_title,
        "document_citation": b.document_citation,
        "source_url": None,
        "input_text": b.input_text,
        "method": _react_method(b.extraction_method or "manual"),
        "proposals": [_proposal_to_json(p) for p in b.proposals],
        "audit": _batch_audit_json(b.id),
        "created_at": b.created_at.isoformat(),
    }


def _batch_summary_json(b) -> dict:
    # React expects keys: pending / approved / modified / rejected.
    counts: dict[str, int] = {"pending": 0, "approved": 0, "modified": 0, "rejected": 0}
    for p in b.proposals:
        s = _react_status(p.status)
        counts[s] = counts.get(s, 0) + 1
    return {
        "id": b.id,
        "jurisdiction_id": b.jurisdiction_id,
        "document_title": b.document_title,
        "document_citation": b.document_citation,
        "method": _react_method(b.extraction_method or "manual"),
        "counts": counts,
        "created_at": b.created_at.isoformat(),
    }


@app.get("/api/encode/batches")
def api_list_encoding_batches():
    """List encoding batches as summaries -- newest first."""
    batches = sorted(
        encoding_store.batches.values(),
        key=lambda b: b.created_at,
        reverse=True,
    )
    return [_batch_summary_json(b) for b in batches]


@app.get("/api/encode/batches/{batch_id}")
def api_get_encoding_batch(batch_id: str):
    batch = encoding_store.batches.get(batch_id)
    if not batch:
        raise HTTPException(404, f"batch {batch_id!r} not found")
    return _batch_to_json(batch)


@app.post("/api/encode/batches")
async def api_create_encoding_batch(request: Request):
    body = await request.json()
    document_title = str(body.get("document_title", "")).strip()
    document_citation = str(body.get("document_citation", "")).strip()
    input_text = str(body.get("input_text", "")).strip()
    method = str(body.get("method", "manual"))
    api_key = str(body.get("api_key", "") or "")

    if not document_title or not input_text:
        raise HTTPException(400, "document_title and input_text are required")

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
                batch.id,
                proposals,
                method="llm:claude",
                prompt=prompt,
                raw_response=raw_response,
                prompt_key=user_prompt_key,
                system_prompt_key=system_prompt_key,
            )
        except Exception as e:
            proposals = extract_rules_manual(batch)
            encoding_store.add_proposals(
                batch.id,
                proposals,
                method="manual:llm-fallback",
                raw_response=f"LLM extraction failed: {e}",
            )
    else:
        proposals = extract_rules_manual(batch)
        encoding_store.add_proposals(batch.id, proposals, method="manual")

    return _batch_to_json(batch)


@app.post("/api/encode/batches/{batch_id}/proposals/{proposal_id}/review")
async def api_review_encoding_proposal(batch_id: str, proposal_id: str, request: Request):
    body = await request.json()
    status_str = str(body.get("status", "approved"))
    notes = str(body.get("notes", "") or "")
    overrides = body.get("overrides") or {}

    try:
        status = ProposalStatus(_backend_status(status_str))
    except ValueError:
        raise HTTPException(400, f"unknown status {status_str!r}") from None

    batch = encoding_store.batches.get(batch_id)
    if not batch:
        raise HTTPException(404, f"batch {batch_id!r} not found")
    proposal = next((p for p in batch.proposals if p.id == proposal_id), None)
    if not proposal:
        raise HTTPException(404, f"proposal {proposal_id!r} not found")

    if overrides:
        rule = proposal.proposed_rule
        if "description" in overrides:
            rule.description = str(overrides["description"])
        if "formal_expression" in overrides:
            rule.formal_expression = str(overrides["formal_expression"])
        if "citation" in overrides:
            rule.citation = str(overrides["citation"])
        if "parameters" in overrides and isinstance(overrides["parameters"], dict):
            rule.parameters = dict(overrides["parameters"])

    encoding_store.review_proposal(
        batch_id, proposal_id, status=status, reviewer="expert", notes=notes,
    )
    proposal = next((p for p in batch.proposals if p.id == proposal_id), proposal)
    return _proposal_to_json(proposal)


@app.post("/api/encode/batches/{batch_id}/bulk-review")
async def api_bulk_review_encoding_proposals(batch_id: str, request: Request):
    body = await request.json()
    proposal_ids = body.get("proposal_ids") or []
    status_str = str(body.get("status", "approved"))
    notes = str(body.get("notes", "") or "")

    try:
        status = ProposalStatus(_backend_status(status_str))
    except ValueError:
        raise HTTPException(400, f"unknown status {status_str!r}") from None

    batch = encoding_store.batches.get(batch_id)
    if not batch:
        raise HTTPException(404, f"batch {batch_id!r} not found")

    target_ids = set(str(pid) for pid in proposal_ids) if proposal_ids else None
    updated = []
    for p in batch.proposals:
        if target_ids is not None and p.id not in target_ids:
            continue
        if p.status != ProposalStatus.PENDING:
            continue
        encoding_store.review_proposal(
            batch_id, p.id, status=status, reviewer="expert (bulk)", notes=notes,
        )
        updated.append(p)

    return {"updated": [_proposal_to_json(p) for p in updated]}


@app.post("/api/encode/batches/{batch_id}/commit")
def api_commit_encoding_batch(batch_id: str):
    """Commit approved proposals to the engine.

    v3.1 L6 Bug 4: idempotency gate. A second commit attempt against the
    same batch returns 409 Conflict so a re-clicked button doesn't silently
    re-run. The committed_at field on EncodingBatch is the source of truth;
    set on first successful commit and checked here.
    """
    from datetime import datetime, timezone

    batch = encoding_store.batches.get(batch_id)
    if not batch:
        raise HTTPException(404, f"batch {batch_id!r} not found")
    if batch.committed_at is not None:
        raise HTTPException(
            409,
            {
                "error": "batch already committed",
                "batch_id": batch_id,
                "committed_at": batch.committed_at.isoformat(),
            },
        )
    approved_rules = encoding_store.get_approved_rules(batch_id)
    batch.committed_at = datetime.now(timezone.utc)
    encoding_store._log(
        batch_id,
        "batch_committed",
        "api",
        f"{len(approved_rules)} approved rule(s) committed",
        {"rule_ids": [r.id for r in approved_rules]},
    )
    return {"committed_rule_ids": [r.id for r in approved_rules]}


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


# ---------------------------------------------------------------------------
# v2.1 — Demo GC admin endpoint
# ---------------------------------------------------------------------------


@app.post("/api/admin/gc")
def admin_gc(token: str | None = None, max_age_days: int = 7):
    """Force a GC sweep of user-created records older than max_age_days.

    Token-gated via the DEMO_ADMIN_TOKEN env var. When the token is unset
    on the server, the endpoint returns 403 (the demo deploy MUST set
    DEMO_ADMIN_TOKEN to use this).

    Returns the count of deleted ConfigValue records and a timestamp. Safe
    to call any time — the underlying SQL is idempotent (cutoff is
    monotonic, deleted rows can't be deleted twice). The same function is
    fired daily at 03:00 UTC by the APScheduler in `gc_scheduler`; the
    admin endpoint exists for "clean the demo before a presentation"
    moments.
    """
    from govops.demo_mode import demo_admin_token
    from govops.gc_scheduler import run_gc, get_last_gc_at

    expected = demo_admin_token()
    if not expected:
        raise HTTPException(
            403,
            "DEMO_ADMIN_TOKEN not configured on the server (set the env var to enable this endpoint)",
        )
    if not token or token != expected:
        raise HTTPException(401, "valid `token` query parameter required")

    deleted = run_gc(config_store, max_age_days=max_age_days)
    last = get_last_gc_at()
    return {
        "deleted": deleted,
        "max_age_days": max_age_days,
        "ran_at": last.isoformat() if last else None,
    }


def _set_pack_enabled_response(publisher_id: str, *, enabled: bool) -> dict:
    from govops.federation import FederationError, set_pack_enabled

    _, _, federated_dir = _federation_paths()
    try:
        changed = set_pack_enabled(federated_dir, publisher_id, enabled)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except FederationError as exc:
        # UnsafePath (publisher_id failed the safe-id regex, e.g. leading
        # underscore) and any other fail-closed federation error must surface
        # as 4xx, not 500. Mirrors the fetch endpoint's posture above.
        raise HTTPException(400, str(exc)) from exc
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


def _country_code_for_value(jurisdiction_id: str | None) -> str | None:
    """Resolve a ConfigValue's program-scoped ``jurisdiction_id`` to the
    country-level code the L5 impact endpoint groups by.

    ConfigValues are stored with per-program scope (``es-jub`` for Spanish
    OAS, ``es-ei`` for Spanish EI, ``ca-oas`` for Canadian OAS, etc.).
    Pre-L5 the /impact endpoint grouped by this program-scoped id directly,
    producing a misleading "across 2 jurisdictions" summary when both rows
    in fact belonged to the same country (per ADR-021). We now resolve the
    prefix back to the registry's country code so a citation that matches
    "Real Decreto" across both Spanish programs is reported as 1 country /
    2 records.

    Global records (``jurisdiction_id is None`` or ``"global"``) return
    ``None`` so the caller keeps the Global bucket distinct.
    """
    if jurisdiction_id is None or jurisdiction_id == "global":
        return None
    code = jurisdiction_id.split("-", 1)[0]
    if code in JURISDICTION_REGISTRY:
        return code
    return jurisdiction_id


def _country_label(country_code: str | None) -> str:
    """Display label for an L5 country bucket. Falls back to the raw code
    when the registry does not carry the country (e.g. federation packs
    that haven't been hydrated yet)."""
    if country_code is None:
        return "Global"
    pack = JURISDICTION_REGISTRY.get(country_code)
    if pack is None:
        return country_code
    return pack.jurisdiction.name


_IMPACT_LIMIT_DEFAULT = 50
_IMPACT_LIMIT_MAX = 200


@app.get("/api/impact")
def impact_by_citation(
    citation: str = "",
    limit: int = _IMPACT_LIMIT_DEFAULT,
    page: int = 1,
):
    """Return ConfigValues referencing ``citation``, grouped by country.

    Phase 7 reverse-index endpoint with §12 7.x.1 pagination. Empty / whitespace
    ``citation`` rejects with 400 so clients always send a meaningful query.
    Normalization (whitespace collapse + case-insensitive match) lives in
    ``ConfigStore.find_by_citation``.

    v3.1 L5 (ADR-021) changes the grouping key from program-scoped
    ``jurisdiction_id`` (``es-jub``, ``es-ei``) to country (``es``). The
    pre-L5 shape implied a citation matched across "2 jurisdictions" when
    both rows in fact belonged to Spain. Records inside a country result
    still carry their full ``jurisdiction_id`` so consumers can see which
    program's substrate they came from. Global records (jurisdiction_id
    null or "global") keep their own bucket.

    Pagination contract:
      - ``limit`` defaults to 50, floors at 1, caps at 200.
      - ``page`` is 1-indexed, floors at 1.
      - ``total`` and ``country_count`` describe the full match set (so the
        UI summary stays meaningful regardless of which page is shown).
      - ``results`` only carries the sections that have values on this page;
        sections with zero values on the page are omitted.
      - ``page_count`` is ``ceil(total / limit)``, or ``0`` when ``total == 0``.
      - Out-of-range pages return ``results=[]`` (not 404) so the UI can recover.
    """
    if not citation or not citation.strip():
        raise HTTPException(400, "citation query parameter is required and must be non-empty")
    normalized = " ".join(citation.split())

    effective_limit = max(1, min(_IMPACT_LIMIT_MAX, limit))
    effective_page = max(1, page)

    matches = config_store.find_by_citation(normalized)
    total = len(matches)

    # Group the FULL match set by country (or None for Global). Per ADR-021,
    # the country is derived from the ConfigValue's program-scoped
    # jurisdiction_id prefix via _country_code_for_value().
    groups: dict[str | None, list[ConfigValue]] = {}
    for cv in matches:
        country = _country_code_for_value(cv.jurisdiction_id)
        groups.setdefault(country, []).append(cv)

    country_count = len(groups)
    page_count = (total + effective_limit - 1) // effective_limit if total else 0

    # Display order: Global first, then countries alphabetically. Build a
    # flat list in display order, slice the page, then re-group preserving
    # the same order so section ordering is stable.
    ordered_countries: list[str | None] = []
    if None in groups:
        ordered_countries.append(None)
    ordered_countries.extend(sorted(k for k in groups if k is not None))

    flat: list[tuple[str | None, ConfigValue]] = []
    for country in ordered_countries:
        for cv in groups[country]:
            flat.append((country, cv))

    start = (effective_page - 1) * effective_limit
    end = start + effective_limit
    page_slice = flat[start:end]

    page_groups: dict[str | None, list[ConfigValue]] = {}
    page_order: list[str | None] = []
    for country, cv in page_slice:
        if country not in page_groups:
            page_groups[country] = []
            page_order.append(country)
        page_groups[country].append(cv)

    results: list[dict[str, Any]] = [
        {
            "country_code": country,
            "country_label": _country_label(country),
            "values": page_groups[country],
        }
        for country in page_order
    ]

    return {
        "query": normalized,
        "total": total,
        "country_count": country_count,
        "limit": effective_limit,
        "page": effective_page,
        "page_count": page_count,
        "results": results,
    }


# ---------------------------------------------------------------------------
# Cross-jurisdiction program comparison (v3 / Phase F)
# ---------------------------------------------------------------------------


# Active jurisdictions in v3 scope, in display order. JP is included as the
# architectural-control entry; whether it appears in any specific comparison
# depends on the program (e.g. JP has no EI manifest by design).
_COMPARE_DEFAULT_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua", "jp"]

# Charter-locked: JP is the architectural control. Symmetric extension is
# opt-in for adopters; absent manifests for the JP/program pair are by design,
# not by oversight.
_JP_EXCLUSION_REASON = (
    "Japan is the v3 architectural control. Symmetric extension to JP is "
    "opt-in for adopters and requires explicit re-approval per the charter "
    "(docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md, §'The proof')."
)


def _compare_jurisdiction_label(jur_code: str) -> str:
    pack = JURISDICTION_REGISTRY.get(jur_code)
    if pack is None:
        return jur_code.upper()
    return pack.jurisdiction.name


# v3.1 L2b -- compare-endpoint manifest cache.
#
# `compare_program` called `load_program_manifest()` per jurisdiction per
# request. Pre-v3.1 only CA had a `programs/oas.yaml`, so /compare/oas loaded
# 1 manifest (5 substrate queries) per hit. Lane 2b adds OAS manifests for
# the other 6 jurisdictions, fanning to 7 × 5 = 35 concurrent substrate
# queries per request. Under E2E concurrency this trips a SQLAlchemy
# session race on the in-memory SQLite ConfigStore -- `_apply_processors`
# IndexError -- which crashes the uvicorn worker mid-request.
#
# Cache loaded manifests at module scope. Manifests are immutable on disk
# during a server lifetime (ADR-020 hot-reload mutates the registry and can
# invalidate this cache via `clear_compare_program_cache()` when wired).
# (key = (jurisdiction_code, program_id))
_COMPARE_MANIFEST_CACHE: dict[tuple[str, str], "Program"] = {}


def _load_compare_program(jur_code: str, program_id: str) -> "Program":
    """Cached ``load_program_manifest`` for the /compare/{program_id} surface.

    Raises whatever ``load_program_manifest`` raises -- callers should
    handle ``Exception`` and surface the jurisdiction as ``available: False``
    in the response, matching the pre-cache behaviour.
    """
    key = (jur_code, program_id)
    cached = _COMPARE_MANIFEST_CACHE.get(key)
    if cached is not None:
        return cached
    manifest_path = LAWCODE_DIR / jur_code / "programs" / f"{program_id}.yaml"
    program = load_program_manifest(manifest_path)
    _COMPARE_MANIFEST_CACHE[key] = program
    return program


def clear_compare_program_cache() -> None:
    """Invalidate the cache. Wired into ADR-020's ``reload_registry()`` (L3)
    so a draft commit + registry rebuild also refreshes the compare surface."""
    _COMPARE_MANIFEST_CACHE.clear()


@app.get("/api/programs/{program_id}/interactions")
def program_interactions_endpoint(program_id: str):
    """Static metadata about cross-program interaction rules involving this program.

    Backs the InteractionsPanel on /compare/{program_id} (LO-009 / leader
    surface). Returns one entry per registered rule that mentions
    ``program_id`` in its ``programs`` list. The metadata is independent of
    any case context -- operators can see which other programs interact with
    this one without running a cross-program evaluation. The runtime
    detection still happens through ``detect_program_interactions`` on the
    case-evaluation path; this endpoint is intentionally a separate read of
    the same registry.
    """
    from govops.program_interactions import list_interactions_for

    return {"program_id": program_id, "interactions": list_interactions_for(program_id)}


@app.get("/api/programs/{program_id}/compare")
def compare_program(
    program_id: str,
    jurisdictions: str = "",
):
    """Cross-jurisdiction comparison surface for a single program (Phase F).

    Loads each jurisdiction's manifest at `lawcode/<code>/programs/{program_id}.yaml`
    directly from disk — independent of which jurisdiction is currently
    seeded into `store`, so a comparison call doesn't disrupt operator
    state. Resolved parameter values come through the substrate (refs are
    resolved at manifest load time per ADR-014).

    Query parameters:
      - `jurisdictions`: comma-separated jur codes (default: all 7).

    Response shape:
      ```
      {
        "program_id": "ei",
        "shape": "unemployment_insurance" | None,
        "jurisdictions": [
          {
            "code": "ca",
            "label": "Government of Canada",
            "available": true,
            "name": {"en": ..., "fr": ...},
            "description": {...},
            "shape": "unemployment_insurance",
            "authority_chain": [...],
            "rules": [...]
          },
          {
            "code": "jp",
            "label": "Nihon-koku",
            "available": false,
            "unavailable_reason": "..."
          },
          ...
        ],
        "comparison": {
          "rule_ids": [...],
          "rows": [
            {
              "rule_id": "rule-ei-contribution",
              "rule_type": "residency_minimum",
              "citation_per_jurisdiction": {"ca": "...", ...},
              "description_per_jurisdiction": {"ca": "...", ...},
              "parameters": {
                "min_years": {"ca": 1, "br": 1.5, ...}
              }
            },
            ...
          ]
        }
      }
      ```
    """
    requested = [c.strip().lower() for c in jurisdictions.split(",") if c.strip()]
    if not requested:
        requested = list(_COMPARE_DEFAULT_JURISDICTIONS)

    invalid = [c for c in requested if c not in _COMPARE_DEFAULT_JURISDICTIONS]
    if invalid:
        raise HTTPException(
            400,
            f"Unknown jurisdiction code(s): {invalid}. "
            f"Allowed: {_COMPARE_DEFAULT_JURISDICTIONS}",
        )

    jur_slots: list[dict[str, Any]] = []
    available_programs: dict[str, Program] = {}

    for code in requested:
        manifest_path = LAWCODE_DIR / code / "programs" / f"{program_id}.yaml"
        label = _compare_jurisdiction_label(code)
        if not manifest_path.exists():
            unavailable_reason = (
                _JP_EXCLUSION_REASON
                if code == "jp"
                else (
                    f"No manifest at lawcode/{code}/programs/{program_id}.yaml. "
                    f"Symmetric extension to {code.upper()} is not yet authored."
                )
            )
            jur_slots.append(
                {
                    "code": code,
                    "label": label,
                    "available": False,
                    "unavailable_reason": unavailable_reason,
                }
            )
            continue
        try:
            # v3.1 L2b: cached load to avoid the per-request fan-out that
            # tripped a SQLAlchemy session race on /compare/oas once 7
            # jurisdictions had OAS manifests on disk.
            program = _load_compare_program(code, program_id)
        except Exception as exc:
            jur_slots.append(
                {
                    "code": code,
                    "label": label,
                    "available": False,
                    "unavailable_reason": (
                        f"Manifest at lawcode/{code}/programs/{program_id}.yaml "
                        f"could not be loaded: {exc}"
                    ),
                }
            )
            continue
        available_programs[code] = program
        jur_slots.append(
            {
                "code": code,
                "label": label,
                "available": True,
                "name": dict(program.name),
                "description": dict(program.description),
                "shape": program.shape,
                "authority_chain": list(program.authority_chain),
                "rules": list(program.rules),
            }
        )

    # Comparison rows: union of rule_ids across all available manifests, in
    # the order they appear in the first available program (preserves
    # author-intended rule ordering for the canonical jurisdiction).
    rule_id_order: list[str] = []
    seen: set[str] = set()
    for code in requested:
        program = available_programs.get(code)
        if program is None:
            continue
        for rule in program.rules:
            if rule.id not in seen:
                seen.add(rule.id)
                rule_id_order.append(rule.id)

    rows: list[dict[str, Any]] = []
    for rule_id in rule_id_order:
        # Collect every (jur, rule) pairing for this rule_id
        rule_per_jur: dict[str, LegalRule] = {}
        for code, program in available_programs.items():
            for rule in program.rules:
                if rule.id == rule_id:
                    rule_per_jur[code] = rule
                    break
        if not rule_per_jur:
            continue
        # Rule type — first one wins (manifests for the same shape use the
        # same rule_type for the same rule_id by Phase D's symmetry contract).
        first_rule = next(iter(rule_per_jur.values()))
        rule_type = first_rule.rule_type.value
        # Per-jurisdiction citations + descriptions (often the same words in
        # the source jurisdiction's own language; the frontend renders them
        # alongside the values for traceability).
        citation_per_jurisdiction = {
            code: rule.citation for code, rule in rule_per_jur.items()
        }
        description_per_jurisdiction = {
            code: rule.description for code, rule in rule_per_jur.items()
        }
        # Parameters: union of keys across jurisdictions, then transpose.
        param_keys: list[str] = []
        param_seen: set[str] = set()
        for rule in rule_per_jur.values():
            for k in rule.parameters.keys():
                if k not in param_seen:
                    param_seen.add(k)
                    param_keys.append(k)
        parameters: dict[str, dict[str, Any]] = {}
        for k in param_keys:
            parameters[k] = {
                code: rule.parameters.get(k)
                for code, rule in rule_per_jur.items()
                if k in rule.parameters
            }
        rows.append(
            {
                "rule_id": rule_id,
                "rule_type": rule_type,
                "citation_per_jurisdiction": citation_per_jurisdiction,
                "description_per_jurisdiction": description_per_jurisdiction,
                "parameters": parameters,
            }
        )

    # Shape declared at the program level — the same shape is required across
    # every available jurisdiction (Phase D's symmetry rule), so the first
    # available program's shape is the canonical answer.
    canonical_shape = next(
        (p.shape for p in available_programs.values()), None
    )

    return {
        "program_id": program_id,
        "shape": canonical_shape,
        "jurisdictions": jur_slots,
        "comparison": {
            "rule_ids": rule_id_order,
            "rows": rows,
        },
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


@app.post("/api/check", response_model=CheckResponse)
def check(req: CheckRequest) -> CheckResponse:
    """Multi-program citizen check (v3 Phase G — citizen entry surface).

    Evaluates every program available for the jurisdiction (OAS + EI in
    CA/BR/ES/FR/DE/UA, OAS only in JP) against the citizen's declared
    facts and returns one result per program. Privacy posture is identical
    to `POST /api/screen` — no case row, no audit entry, no PII echoed.

    Optional `programs: [...]` body field restricts evaluation to a subset;
    unknown program ids → 400.
    """
    try:
        return run_check(req)
    except UnknownJurisdiction as exc:
        raise HTTPException(
            404,
            f"Unknown jurisdiction '{exc.args[0]}'. "
            f"Known: {sorted(JURISDICTION_REGISTRY)}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


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
# Authoring substrate API (v3.1 L7 / ADR-022)
# ---------------------------------------------------------------------------
#
# Mirrors the ConfigValue admin pattern (draft -> approve -> commit) for
# non-ConfigValue records: jurisdiction.yaml + program manifests. The
# substrate writes to lawcode/<code>/... on commit and triggers
# reload_registry() so the new content appears in the running app
# immediately. See ADR-022 for the design contract and the deferred
# v3.2 hardening items (per-path conflict refusal, structural-aware
# YAML emission, RBAC).


def _draft_response(draft: Draft) -> dict[str, Any]:
    """Serialize a Draft for the JSON API. Mirrors draft.to_dict() but
    keeps datetime fields as ISO strings (which to_dict already does)."""
    return draft.to_dict()


@app.post("/api/authoring/drafts")
def authoring_create_draft(body: dict[str, Any]):
    """Create a new draft. Body shape:
    ``{type, target_path, content, author, rationale?}``
    """
    try:
        draft_type = DraftType(body.get("type", ""))
    except ValueError:
        raise HTTPException(
            400,
            f"type must be one of: {[t.value for t in DraftType]}",
        )
    try:
        d = draft_store.create(
            type=draft_type,
            target_path=body.get("target_path", ""),
            content=body.get("content") or {},
            author=body.get("author", ""),
            rationale=body.get("rationale"),
        )
    except TargetPathConflict as e:
        # ADR-023: surface the colliding draft id so the UI can route
        # the operator to approve / reject / discard / edit-in-place
        # the existing draft before authoring a fresh one.
        raise HTTPException(
            status_code=409,
            detail={
                "error": "target_path already held by an open draft",
                "target_path": e.target_path,
                "conflicting_draft_id": e.conflicting_draft_id,
            },
        )
    except AuthoringError as e:
        raise HTTPException(400, str(e))
    return _draft_response(d)


@app.get("/api/authoring/drafts")
def authoring_list_drafts(
    type: Optional[str] = None,
    status: Optional[str] = None,
):
    """List drafts; optional ``?type=`` and ``?status=`` filters."""
    type_filter: Optional[DraftType] = None
    status_filter: Optional[DraftStatus] = None
    if type:
        try:
            type_filter = DraftType(type)
        except ValueError:
            raise HTTPException(400, f"unknown type: {type}")
    if status:
        try:
            status_filter = DraftStatus(status)
        except ValueError:
            raise HTTPException(400, f"unknown status: {status}")
    drafts = draft_store.list(type=type_filter, status=status_filter)
    return {"drafts": [_draft_response(d) for d in drafts]}


@app.get("/api/authoring/drafts/{draft_id}")
def authoring_get_draft(draft_id: str):
    d = draft_store.get(draft_id)
    if d is None:
        raise HTTPException(404, f"draft not found: {draft_id}")
    return _draft_response(d)


@app.patch("/api/authoring/drafts/{draft_id}")
def authoring_update_draft(draft_id: str, body: dict[str, Any]):
    """Replace a PENDING draft's payload. Body shape:
    ``{content, editor, rationale?}``. Refuses on APPROVED / REJECTED /
    COMMITTED. Used by the L9-L11 structured editors (authority chain,
    legal documents, demo cases) to mutate slices of a program manifest
    in place rather than re-creating the draft."""
    content = body.get("content")
    if not isinstance(content, dict):
        raise HTTPException(400, "content must be an object")
    try:
        d = draft_store.update_content(
            draft_id,
            content=content,
            editor=body.get("editor", ""),
            rationale=body.get("rationale"),
        )
    except AuthoringError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(404, msg)
        if "cannot edit" in msg:
            raise HTTPException(409, msg)
        raise HTTPException(400, msg)
    return _draft_response(d)


@app.post("/api/authoring/drafts/{draft_id}/approve")
def authoring_approve_draft(draft_id: str, body: dict[str, Any]):
    """Approve a pending draft. Body shape: ``{approver}``. Idempotent on
    APPROVED; refuses on REJECTED or COMMITTED."""
    try:
        d = draft_store.approve(draft_id, approver=body.get("approver", ""))
    except AuthoringError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(404, msg)
        raise HTTPException(409, msg)
    return _draft_response(d)


@app.post("/api/authoring/drafts/{draft_id}/reject")
def authoring_reject_draft(draft_id: str, body: dict[str, Any]):
    """Reject a draft with a rationale. Body shape: ``{rejector, reason}``.
    Idempotent on REJECTED; refuses on COMMITTED."""
    try:
        d = draft_store.reject(
            draft_id,
            rejector=body.get("rejector", ""),
            reason=body.get("reason", ""),
        )
    except AuthoringError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(404, msg)
        raise HTTPException(409, msg)
    return _draft_response(d)


@app.delete("/api/authoring/drafts/{draft_id}")
def authoring_discard_draft(draft_id: str):
    """Discard a non-committed draft. Returns 204 on success, 404 if the
    draft is unknown, 409 if it is already COMMITTED. Used by wizard
    cancel flows and E2E teardown."""
    d = draft_store.get(draft_id)
    if d is None:
        raise HTTPException(404, f"draft not found: {draft_id}")
    try:
        draft_store.discard(draft_id)
    except AuthoringError as e:
        raise HTTPException(409, str(e))
    return Response(status_code=204)


@app.post("/api/authoring/commit")
def authoring_commit(body: dict[str, Any]):
    """Commit all APPROVED drafts to disk under ``lawcode/<code>/...``
    and rebuild the registry so the new content is immediately visible.
    Body shape: ``{committer}``. Returns
    ``{committed: [Draft], reloaded: bool}``."""
    try:
        committed = draft_store.commit_approved(committer=body.get("committer", ""))
    except AuthoringError as e:
        raise HTTPException(400, str(e))
    if committed:
        # Refresh JURISDICTION_REGISTRY so the new jurisdiction / program
        # is immediately discoverable through the existing read APIs
        # (/api/authority-chain, /api/screen, /compare, etc.). Per L3 +
        # ADR-020, this rebuilds the dict in place; existing references
        # stay valid.
        try:
            reload_registry()
            # Per L4: the /compare endpoint caches per-program manifests
            # by jurisdiction code; bust the cache so newly committed
            # manifests are visible.
            clear_compare_program_cache()
        except Exception:  # noqa: BLE001
            # Commit succeeded; reload failed -- surface a generic flag
            # but do not echo the exception (would leak path / stack
            # info to an external caller per CodeQL py/stack-trace-exposure).
            # Operators can inspect the server log for the underlying
            # cause.
            return {
                "committed": [_draft_response(d) for d in committed],
                "reloaded": False,
                "reload_error": "registry reload failed; see server log",
            }
    return {
        "committed": [_draft_response(d) for d in committed],
        "reloaded": bool(committed),
    }


@app.post("/api/authoring/scaffold/jurisdiction")
def authoring_scaffold_jurisdiction(body: dict[str, Any]):
    """Pre-fill drafts for a fresh jurisdiction without writing anything.

    The L8 Onboard wizard calls this on step 1 to get a complete
    schema-valid skeleton (same templates ``govops init`` writes to
    disk) returned in-memory. The wizard renders the content in a form,
    the operator edits the TODO markers, and the wizard POSTs the
    finalised content to ``/api/authoring/drafts`` on submit.

    No filesystem side effects. The substrate refuses target_paths the
    loader cannot see (see ``DraftStore.create`` path discipline), so
    the scaffold respects the same layout: jurisdiction metadata at
    ``<code>/config/jurisdiction.yaml`` and programs under
    ``<code>/programs/<id>.yaml``.

    Body shape: ``{code: str, shapes?: ["oas", "ei"]}``. Defaults to
    ``["oas"]`` (the OAS shape is the only one the v3.1 registry loader
    requires to register a jurisdiction; EI is additive).
    """
    import yaml as _yaml
    from govops.cli_init import (
        InitError,
        _ei_program_yaml,
        _jurisdiction_yaml,
        _normalize_country_code,
        _oas_program_yaml,
    )

    try:
        code = _normalize_country_code(body.get("code", ""))
    except InitError as e:
        raise HTTPException(400, str(e))

    requested_shapes = body.get("shapes") or ["oas"]
    if not isinstance(requested_shapes, list):
        raise HTTPException(400, "shapes must be a list")
    valid_shapes = {"oas", "ei"}
    unknown = set(requested_shapes) - valid_shapes
    if unknown:
        raise HTTPException(400, f"unknown shape(s): {sorted(unknown)}")

    jurisdiction_yaml_text = _jurisdiction_yaml(code)
    programs_out: list[dict[str, Any]] = []
    if "oas" in requested_shapes:
        programs_out.append(
            {
                "program_id": "oas",
                "target_path": f"{code}/programs/oas.yaml",
                "content": _yaml.safe_load(_oas_program_yaml(code)),
            }
        )
    if "ei" in requested_shapes:
        programs_out.append(
            {
                "program_id": "ei",
                "target_path": f"{code}/programs/ei.yaml",
                "content": _yaml.safe_load(_ei_program_yaml(code)),
            }
        )

    return {
        "jurisdiction": {
            "target_path": f"{code}/config/jurisdiction.yaml",
            "content": _yaml.safe_load(jurisdiction_yaml_text),
        },
        "programs": programs_out,
    }


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
    engine = ProgramEngine(rules=list(store.rules.values()))
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
