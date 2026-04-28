"""Self-screening pipeline (Law-as-Code v2.0 Phase 10A).

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
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from govops.engine import OASEngine
from govops.jurisdictions import JURISDICTION_REGISTRY, JurisdictionPack
from govops.models import (
    Applicant,
    CaseBundle,
    EvidenceItem,
    ResidencyPeriod,
)


SCREENING_DISCLAIMER = (
    "This is decision support, not a determination. "
    "Apply through the program for an official decision."
)


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

    engine = OASEngine(rules=list(pack.rules), evaluation_date=eval_date)
    recommendation, _audit_entries = engine.evaluate(transient_case)

    template_key = f"global.template.notice.{req.jurisdiction_id}-oas-decision" \
        if req.jurisdiction_id == "ca" \
        else f"global.template.notice.{req.jurisdiction_id}-decision"
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

    engine = OASEngine(rules=list(pack.rules), evaluation_date=eval_date)
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
