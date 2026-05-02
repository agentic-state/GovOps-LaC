"""Self-screening pipeline (Law-as-Code v2.0 Phase 10A; v3 Phase G).

Citizen-facing pre-check around the existing eligibility engine. The contract
is intentionally narrow:

* No case row is created.
* No row is written to any persistent store.
* No audit entry is generated.
* No PII (date of birth, residency dates, legal name) is echoed back in the
  response or logged.

The engine that runs is the same one that powers the officer flow — same
rules, same citations, same effective-dated ConfigValue resolution. The only
difference is that the result is decision support for the citizen, not a
determination, and every response carries that disclaimer in
``ScreenResponse.disclaimer``.

v3 Phase G (citizen entry + life-event reassessment): adds ``run_check``
alongside ``run_screen`` for multi-program citizen pre-screening — same
privacy posture, but evaluates *every* program registered for a jurisdiction
(OAS + EI in CA/BR/ES/FR/DE/UA, OAS only in JP) and returns one result per
program. The single-program ``run_screen`` is preserved byte-identically so
the 19 existing screen tests stay green.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from govops.engine import ProgramEngine
from govops.jurisdictions import JURISDICTION_REGISTRY, JurisdictionPack
from govops.models import (
    Applicant,
    CaseBundle,
    EvidenceItem,
    ResidencyPeriod,
    RuleType,
)
from govops.programs import Program, load_program_manifest


_LAWCODE_DIR = Path(__file__).resolve().parent.parent.parent / "lawcode"


SCREENING_DISCLAIMER = (
    "This is decision support, not a determination. "
    "Apply through the program for an official decision."
)


# Prefix code → template slug (mirrors `lawcode/global/notices.yaml`
# keys `global.template.notice.<slug>-decision`). The screen API uses
# 2-letter prefixes; full jurisdiction ids are used by the case API.
_PREFIX_TO_TEMPLATE_SLUG = {
    "ca": "ca-oas",
    "br": "br-inss",
    "es": "es-jub",
    "fr": "fr-cnav",
    "de": "de-drv",
    "ua": "ua-pfu",
}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class ScreenResidencyPeriod(BaseModel):
    country: str
    start_date: date
    end_date: Optional[date] = None  # None = ongoing


class ScreenEvidence(BaseModel):
    dob: bool = False
    residency: bool = False


class ScreenRequest(BaseModel):
    jurisdiction_id: str  # "ca" | "br" | "es" | "fr" | "de" | "ua"
    date_of_birth: date
    legal_status: str  # "citizen" | "permanent_resident" | "other"
    country_of_birth: Optional[str] = None
    residency_periods: list[ScreenResidencyPeriod] = Field(default_factory=list)
    evidence_present: ScreenEvidence = Field(default_factory=ScreenEvidence)
    evaluation_date: Optional[date] = None

    @field_validator("date_of_birth")
    @classmethod
    def _dob_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("date_of_birth cannot be in the future")
        if v.year < 1900:
            raise ValueError("date_of_birth must be 1900-01-01 or later")
        return v

    @field_validator("legal_status")
    @classmethod
    def _legal_status_known(cls, v: str) -> str:
        allowed = {"citizen", "permanent_resident", "other"}
        if v not in allowed:
            raise ValueError(f"legal_status must be one of {sorted(allowed)}")
        return v


class ScreenRuleResult(BaseModel):
    rule_id: str
    description: str
    citation: str
    outcome: str  # mirrors RuleOutcome.value
    detail: str = ""
    effective_from: Optional[str] = None  # ISO date when the rule's parameter resolved a ConfigValue


class ScreenBenefitAmount(BaseModel):
    """Citizen-facing projection of the entitlement amount (Phase 10B / ADR-011).

    Mirrors ``models.BenefitAmount`` but stays its own type so the screen
    contract can evolve independently of the officer/audit shape. The
    ``formula_trace`` is preserved verbatim so the citizen-facing surface
    can render the same per-step trace the audit package shows officers —
    same evidence, different audience.
    """
    value: float
    currency: str = "CAD"
    period: str = "monthly"  # "monthly", "annual", "lump_sum"
    formula_trace: list[dict] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)


class ScreenResponse(BaseModel):
    outcome: str  # mirrors DecisionOutcome.value
    pension_type: str = ""
    partial_ratio: Optional[str] = None
    benefit_amount: Optional[ScreenBenefitAmount] = None  # populated when ELIGIBLE + calc rule present
    rule_results: list[ScreenRuleResult] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    jurisdiction_label: str
    evaluation_date: str  # ISO date
    disclaimer: str = SCREENING_DISCLAIMER
    # Deliberately absent: case_id, applicant_id, audit_id, echoed PII.


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class UnknownJurisdiction(KeyError):
    """Raised when ``ScreenRequest.jurisdiction_id`` doesn't resolve."""


def _evidence_items_from_request(req: ScreenRequest) -> list[EvidenceItem]:
    """Translate the citizen's checkbox answers into engine-shaped evidence.

    The engine looks for evidence by ``evidence_type`` against the
    ``global.engine.evidence.dob_types`` and ``residency_types`` ConfigValue
    lists. We surface representative, non-PII evidence types so the engine
    can short-circuit its sufficiency check.
    """
    items: list[EvidenceItem] = []
    if req.evidence_present.dob:
        items.append(EvidenceItem(evidence_type="birth_certificate", provided=True))
    if req.evidence_present.residency:
        items.append(EvidenceItem(evidence_type="tax_record", provided=True))
    return items


def _residency_from_request(req: ScreenRequest) -> list[ResidencyPeriod]:
    return [
        ResidencyPeriod(
            country=p.country,
            start_date=p.start_date,
            end_date=p.end_date,
            verified=False,
        )
        for p in req.residency_periods
    ]


def _label(pack: JurisdictionPack) -> str:
    return f"{pack.program_name} — {pack.jurisdiction.name}"


def _build_transient_case(
    req: ScreenRequest,
    pack: JurisdictionPack,
) -> CaseBundle:
    """Build the engine-shaped CaseBundle from a screen request.

    Extracted so both ``run_screen`` and the notice-rendering path can
    reuse the exact same construction — preserves privacy invariants
    (no legal_name, no echoed PII) and guarantees the screened result
    and the rendered notice see byte-identical inputs.
    """
    return CaseBundle(
        jurisdiction_id=pack.jurisdiction.id,
        applicant=Applicant(
            date_of_birth=req.date_of_birth,
            legal_status=req.legal_status,
            country_of_birth=req.country_of_birth or "",
            legal_name="",  # explicitly blank — citizen flow never collects names
        ),
        residency_periods=_residency_from_request(req),
        evidence_items=_evidence_items_from_request(req),
    )


def render_screen_notice_html(
    req: ScreenRequest,
    *,
    language: str = "en",
    registry: dict[str, JurisdictionPack] | None = None,
) -> tuple[str, str, str]:
    """Render a citizen-facing decision notice from a screen request.

    Returns ``(html, sha256, template_version)``. No persistence, no audit
    write — same privacy posture as ``run_screen``. The transient case
    used for rendering carries no id of its own and is discarded.

    The notice is byte-identical to what an officer would see for the same
    inputs, so the citizen has the same evidence the officer would.
    """
    from govops.notices import render_html

    reg = registry if registry is not None else JURISDICTION_REGISTRY
    pack = reg.get(req.jurisdiction_id)
    if pack is None:
        raise UnknownJurisdiction(req.jurisdiction_id)

    eval_date = req.evaluation_date or date.today()
    transient_case = _build_transient_case(req, pack)
    # Mark the case id explicitly so the rendered HTML carries a
    # human-readable transient marker rather than a leaked uuid that might
    # look stable. Privacy invariant: the id has no persistence behind it.
    transient_case.id = "transient-screen-render"

    engine = ProgramEngine(rules=list(pack.rules), evaluation_date=eval_date)
    recommendation, _audit_entries = engine.evaluate(transient_case)

    # Map the screen-side prefix (`ca`, `br`, …) to the template slug
    # (`ca-oas`, `br-inss`, …) used in `lawcode/global/notices.yaml`.
    # Mirrors `api._jurisdiction_slug` but keyed by prefix not full id —
    # the screen surface trades id for prefix to keep payloads small.
    template_key = f"global.template.notice.{_PREFIX_TO_TEMPLATE_SLUG[req.jurisdiction_id]}-decision"
    program_name = _label(pack).split(" — ")[0]

    rendered = render_html(
        case=transient_case,
        recommendation=recommendation,
        jurisdiction=pack.jurisdiction,
        program_name=program_name,
        template_key=template_key,
        language=language,
        evaluation_date=eval_date.isoformat(),
    )
    # Audit event is generated by render_html but deliberately not appended
    # anywhere — the screen path is fail-closed on audit by design.
    return rendered.html, rendered.sha256, rendered.template_version


def run_screen(
    req: ScreenRequest,
    *,
    registry: dict[str, JurisdictionPack] | None = None,
) -> ScreenResponse:
    """Execute the citizen-facing self-screening pipeline.

    No persistence, no audit, no PII echoed back. The transient
    ``CaseBundle`` is constructed only to feed the engine and is discarded
    when this function returns.
    """
    reg = registry if registry is not None else JURISDICTION_REGISTRY
    pack = reg.get(req.jurisdiction_id)
    if pack is None:
        raise UnknownJurisdiction(req.jurisdiction_id)

    eval_date = req.evaluation_date or date.today()

    transient_case = CaseBundle(
        jurisdiction_id=pack.jurisdiction.id,
        applicant=Applicant(
            date_of_birth=req.date_of_birth,
            legal_status=req.legal_status,
            country_of_birth=req.country_of_birth or "",
            legal_name="",  # explicitly blank — citizen flow never collects names
        ),
        residency_periods=_residency_from_request(req),
        evidence_items=_evidence_items_from_request(req),
    )

    engine = ProgramEngine(rules=list(pack.rules), evaluation_date=eval_date)
    recommendation, _audit_entries = engine.evaluate(transient_case)
    # `_audit_entries` is intentionally discarded — citizen screening never
    # writes to an audit trail.

    rule_results = [
        ScreenRuleResult(
            rule_id=r.rule_id,
            description=r.rule_description,
            citation=r.citation,
            outcome=r.outcome.value,
            detail=r.detail,
        )
        for r in recommendation.rule_evaluations
    ]

    benefit_amount: Optional[ScreenBenefitAmount] = None
    if recommendation.benefit_amount is not None:
        benefit_amount = ScreenBenefitAmount(
            value=recommendation.benefit_amount.value,
            currency=recommendation.benefit_amount.currency,
            period=recommendation.benefit_amount.period,
            formula_trace=list(recommendation.benefit_amount.formula_trace),
            citations=list(recommendation.benefit_amount.citations),
        )

    return ScreenResponse(
        outcome=recommendation.outcome.value,
        pension_type=recommendation.pension_type,
        partial_ratio=recommendation.partial_ratio,
        benefit_amount=benefit_amount,
        rule_results=rule_results,
        missing_evidence=list(recommendation.missing_evidence),
        jurisdiction_label=_label(pack),
        evaluation_date=eval_date.isoformat(),
    )


# ===========================================================================
# v3 Phase G — multi-program citizen check
# ===========================================================================


class CheckEvidence(BaseModel):
    """Citizen-facing checkbox state for the multi-program check (Phase G).

    ``job_loss`` is the v3 addition that unlocks Employment Insurance
    eligibility paths — when checked, the engine sees the per-jurisdiction
    EI evidence type (`record_of_employment` for CA, `arbeitsbescheinigung`
    for DE, etc.) injected automatically. The citizen does not need to know
    the local term.
    """
    dob: bool = False
    residency: bool = False
    job_loss: bool = False


class CheckRequest(BaseModel):
    jurisdiction_id: str  # "ca" | "br" | "es" | "fr" | "de" | "ua" | "jp"
    date_of_birth: date
    legal_status: str  # "citizen" | "permanent_resident" | "other"
    country_of_birth: Optional[str] = None
    residency_periods: list[ScreenResidencyPeriod] = Field(default_factory=list)
    evidence_present: CheckEvidence = Field(default_factory=CheckEvidence)
    programs: Optional[list[str]] = None  # default: all programs available
    evaluation_date: Optional[date] = None

    @field_validator("date_of_birth")
    @classmethod
    def _dob_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("date_of_birth cannot be in the future")
        if v.year < 1900:
            raise ValueError("date_of_birth must be 1900-01-01 or later")
        return v

    @field_validator("legal_status")
    @classmethod
    def _legal_status_known(cls, v: str) -> str:
        allowed = {"citizen", "permanent_resident", "other"}
        if v not in allowed:
            raise ValueError(f"legal_status must be one of {sorted(allowed)}")
        return v


class CheckBenefitPeriod(BaseModel):
    """Citizen-facing projection of a bounded eligibility period (ADR-017)."""
    start_date: str  # ISO
    end_date: str  # ISO
    weeks_total: int
    weeks_remaining: int
    citations: list[str] = Field(default_factory=list)


class CheckActiveObligation(BaseModel):
    """Forward-looking obligation surfaced to the citizen (ADR-017)."""
    obligation_id: str
    description: str
    citation: str
    cadence: Optional[str] = None


class CheckProgramResult(BaseModel):
    program_id: str
    program_name: str  # from the manifest's `name` dict, English when available
    shape: str
    outcome: str  # mirrors DecisionOutcome.value
    pension_type: str = ""
    partial_ratio: Optional[str] = None
    rule_results: list[ScreenRuleResult] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    benefit_amount: Optional[ScreenBenefitAmount] = None
    benefit_period: Optional[CheckBenefitPeriod] = None
    active_obligations: list[CheckActiveObligation] = Field(default_factory=list)


class CheckResponse(BaseModel):
    jurisdiction_id: str
    jurisdiction_label: str
    evaluation_date: str  # ISO date
    programs: list[CheckProgramResult]
    disclaimer: str = SCREENING_DISCLAIMER


def _discover_citizen_programs(jur_code: str, pack: JurisdictionPack) -> list[Program]:
    """Return every Program available for this jurisdiction's citizen view.

    Mirrors the seed-time logic in ``api._register_jurisdiction_programs`` but
    without touching DemoStore — citizen flow is stateless. OAS is synthesised
    from the JURISDICTION_REGISTRY pack so every jurisdiction (including JP)
    has an OAS-shaped result; additional manifests at
    ``lawcode/<jur>/programs/*.yaml`` (EI for the 6 active jurisdictions)
    are loaded directly. JP correctly ends up with OAS only — the
    architectural-control rule holds.
    """
    programs: list[Program] = []
    programs.append(
        Program(
            program_id="oas",
            jurisdiction_id=pack.jurisdiction.id,
            shape="old_age_pension",
            status="active",
            name={"en": pack.program_name},
            rules=list(pack.rules),
            authority_chain=list(pack.authority_chain),
            legal_documents=list(pack.legal_documents),
            demo_cases=[],  # citizen check doesn't need demo cases
        )
    )

    programs_dir = _LAWCODE_DIR / jur_code / "programs"
    if not programs_dir.exists():
        return programs
    for manifest_path in sorted(programs_dir.glob("*.yaml")):
        if manifest_path.name.startswith("_"):
            continue
        if manifest_path.stem == "oas":
            continue  # OAS is synthesised above
        try:
            programs.append(load_program_manifest(manifest_path))
        except Exception:
            continue
    return programs


def _evidence_items_for_program(
    req: CheckRequest, program: Program
) -> list[EvidenceItem]:
    """Map citizen checkbox answers to engine-shaped evidence per program.

    DOB + residency map to ``birth_certificate`` + ``tax_record`` exactly
    like the single-program ``_evidence_items_from_request``. The Phase G
    addition: when ``job_loss`` is checked, scan the program's
    ``EVIDENCE_REQUIRED`` rules and inject one EvidenceItem per
    ``required_types`` entry that *isn't* already covered above. This
    means the same checkbox unlocks `record_of_employment` for CA EI,
    `arbeitsbescheinigung` for DE EI, etc., without the citizen needing
    to know the local term.
    """
    items: list[EvidenceItem] = []
    if req.evidence_present.dob:
        items.append(EvidenceItem(evidence_type="birth_certificate", provided=True))
    if req.evidence_present.residency:
        items.append(EvidenceItem(evidence_type="tax_record", provided=True))
    if req.evidence_present.job_loss:
        already = {it.evidence_type for it in items}
        for rule in program.rules:
            if rule.rule_type != RuleType.EVIDENCE_REQUIRED:
                continue
            for et in rule.parameters.get("required_types", []) or []:
                if et in already:
                    continue
                items.append(EvidenceItem(evidence_type=et, provided=True))
                already.add(et)
    return items


def _build_check_case(req: CheckRequest, program: Program) -> CaseBundle:
    """Engine-shaped CaseBundle for a single program's evaluation.

    Privacy invariant identical to ``_build_transient_case``: no
    ``legal_name`` is ever set, the case has no persistence, and the
    function returns a fresh value every call.
    """
    return CaseBundle(
        jurisdiction_id=program.jurisdiction_id,
        applicant=Applicant(
            date_of_birth=req.date_of_birth,
            legal_status=req.legal_status,
            country_of_birth=req.country_of_birth or "",
            legal_name="",
        ),
        residency_periods=[
            ResidencyPeriod(
                country=p.country,
                start_date=p.start_date,
                end_date=p.end_date,
                verified=False,
            )
            for p in req.residency_periods
        ],
        evidence_items=_evidence_items_for_program(req, program),
    )


def _program_display_name(program: Program) -> str:
    """Best-effort English name for the program; falls back to first name."""
    if "en" in program.name and program.name["en"]:
        return program.name["en"]
    if program.name:
        return next(iter(program.name.values()))
    return program.program_id


def _render_check_program_result(
    program: Program, recommendation
) -> CheckProgramResult:
    rule_results = [
        ScreenRuleResult(
            rule_id=r.rule_id,
            description=r.rule_description,
            citation=r.citation,
            outcome=r.outcome.value,
            detail=r.detail,
        )
        for r in recommendation.rule_evaluations
    ]
    benefit_amount: Optional[ScreenBenefitAmount] = None
    if recommendation.benefit_amount is not None:
        benefit_amount = ScreenBenefitAmount(
            value=recommendation.benefit_amount.value,
            currency=recommendation.benefit_amount.currency,
            period=recommendation.benefit_amount.period,
            formula_trace=list(recommendation.benefit_amount.formula_trace),
            citations=list(recommendation.benefit_amount.citations),
        )
    benefit_period: Optional[CheckBenefitPeriod] = None
    if recommendation.benefit_period is not None:
        bp = recommendation.benefit_period
        benefit_period = CheckBenefitPeriod(
            start_date=bp.start_date.isoformat(),
            end_date=bp.end_date.isoformat(),
            weeks_total=bp.weeks_total,
            weeks_remaining=bp.weeks_remaining,
            citations=list(bp.citations),
        )
    obligations = [
        CheckActiveObligation(
            obligation_id=o.obligation_id,
            description=o.description,
            citation=o.citation,
            cadence=o.cadence,
        )
        for o in recommendation.active_obligations
    ]
    return CheckProgramResult(
        program_id=program.program_id,
        program_name=_program_display_name(program),
        shape=program.shape,
        outcome=recommendation.outcome.value,
        pension_type=recommendation.pension_type,
        partial_ratio=recommendation.partial_ratio,
        rule_results=rule_results,
        missing_evidence=list(recommendation.missing_evidence),
        benefit_amount=benefit_amount,
        benefit_period=benefit_period,
        active_obligations=obligations,
    )


def run_check(
    req: CheckRequest,
    *,
    registry: dict[str, JurisdictionPack] | None = None,
) -> CheckResponse:
    """Execute the multi-program citizen check (v3 Phase G).

    For the requested jurisdiction, evaluate every available program
    against the same transient case and return per-program results.
    Privacy posture identical to ``run_screen``: no case row, no audit,
    no PII echoed.

    When ``req.programs`` is set, restrict to that list; otherwise run
    every program available for the jurisdiction (OAS for all 7; EI
    additionally for CA/BR/ES/FR/DE/UA per Phase D).
    """
    reg = registry if registry is not None else JURISDICTION_REGISTRY
    pack = reg.get(req.jurisdiction_id)
    if pack is None:
        raise UnknownJurisdiction(req.jurisdiction_id)

    eval_date = req.evaluation_date or date.today()
    available = _discover_citizen_programs(req.jurisdiction_id, pack)

    if req.programs:
        available_ids = {p.program_id for p in available}
        unknown = [p for p in req.programs if p not in available_ids]
        if unknown:
            raise ValueError(
                f"Unknown program(s) for jurisdiction "
                f"{req.jurisdiction_id!r}: {unknown}. "
                f"Available: {sorted(available_ids)}"
            )
        selected = [p for p in available if p.program_id in set(req.programs)]
    else:
        selected = available

    results: list[CheckProgramResult] = []
    for program in selected:
        case = _build_check_case(req, program)
        engine = ProgramEngine(program=program, evaluation_date=eval_date)
        recommendation, _audit = engine.evaluate(case)
        # `_audit` deliberately discarded — citizen flow never persists.
        results.append(_render_check_program_result(program, recommendation))

    return CheckResponse(
        jurisdiction_id=req.jurisdiction_id,
        jurisdiction_label=pack.jurisdiction.name,
        evaluation_date=eval_date.isoformat(),
        programs=results,
    )
