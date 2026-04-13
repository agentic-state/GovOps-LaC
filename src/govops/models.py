"""GovOps domain model.

Authority chain:
  jurisdiction -> constitution -> authority -> law -> regulation -> program -> service -> decision

Every model carries traceability back to its authority source.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---------------------------------------------------------------------------
# Authority chain
# ---------------------------------------------------------------------------

class Jurisdiction(BaseModel):
    id: str = Field(default_factory=_new_id)
    name: str
    country: str
    level: str  # "federal", "provincial", "municipal"
    parent_id: Optional[str] = None
    legal_tradition: str = ""
    language_regime: str = ""


class AuthorityReference(BaseModel):
    """One link in the authority chain from jurisdiction down to service rule."""
    id: str = Field(default_factory=_new_id)
    jurisdiction_id: str
    layer: str  # "constitution", "act", "regulation", "policy", "program", "service"
    title: str
    citation: str  # e.g. "R.S.C., 1985, c. O-9, s. 3(1)"
    effective_date: Optional[date] = None
    url: str = ""
    parent_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Legal corpus and rules
# ---------------------------------------------------------------------------

class DocumentType(str, Enum):
    STATUTE = "statute"
    REGULATION = "regulation"
    POLICY_MANUAL = "policy_manual"
    GUIDANCE = "guidance"


class LegalDocument(BaseModel):
    id: str = Field(default_factory=_new_id)
    jurisdiction_id: str
    document_type: DocumentType
    title: str
    citation: str
    effective_date: Optional[date] = None
    sections: list[LegalSection] = []


class LegalSection(BaseModel):
    id: str = Field(default_factory=_new_id)
    section_ref: str  # e.g. "s. 3(1)(a)"
    heading: str = ""
    text: str = ""


class RuleType(str, Enum):
    AGE_THRESHOLD = "age_threshold"
    RESIDENCY_MINIMUM = "residency_minimum"
    RESIDENCY_PARTIAL = "residency_partial"
    LEGAL_STATUS = "legal_status"
    EVIDENCE_REQUIRED = "evidence_required"
    EXCLUSION = "exclusion"


class LegalRule(BaseModel):
    """A single formalized rule extracted from legislation."""
    id: str = Field(default_factory=_new_id)
    source_document_id: str
    source_section_ref: str  # back-pointer to the section
    rule_type: RuleType
    description: str
    formal_expression: str  # human-readable logical expression
    citation: str
    parameters: dict = {}  # e.g. {"min_age": 65, "min_years": 10}


# ---------------------------------------------------------------------------
# Case and evidence
# ---------------------------------------------------------------------------

class CaseStatus(str, Enum):
    INTAKE = "intake"
    EVALUATING = "evaluating"
    RECOMMENDATION_READY = "recommendation_ready"
    UNDER_REVIEW = "under_review"
    DECIDED = "decided"
    ESCALATED = "escalated"


class Applicant(BaseModel):
    id: str = Field(default_factory=_new_id)
    date_of_birth: date
    legal_name: str = ""
    legal_status: str = "citizen"  # citizen, permanent_resident, other
    country_of_birth: str = ""


class ResidencyPeriod(BaseModel):
    country: str  # ISO country code or name
    start_date: date
    end_date: Optional[date] = None  # None = ongoing
    verified: bool = False
    evidence_ids: list[str] = []


class EvidenceItem(BaseModel):
    id: str = Field(default_factory=_new_id)
    evidence_type: str  # "birth_certificate", "passport", "tax_record", etc.
    description: str = ""
    provided: bool = True
    verified: bool = False
    source_reference: str = ""


class CaseBundle(BaseModel):
    id: str = Field(default_factory=_new_id)
    created_at: datetime = Field(default_factory=_utcnow)
    status: CaseStatus = CaseStatus.INTAKE
    jurisdiction_id: str = ""
    applicant: Applicant
    residency_periods: list[ResidencyPeriod] = []
    evidence_items: list[EvidenceItem] = []


# ---------------------------------------------------------------------------
# Evaluation and recommendation
# ---------------------------------------------------------------------------

class RuleOutcome(str, Enum):
    SATISFIED = "satisfied"
    NOT_SATISFIED = "not_satisfied"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    NOT_APPLICABLE = "not_applicable"


class RuleEvaluation(BaseModel):
    rule_id: str
    rule_description: str
    citation: str
    outcome: RuleOutcome
    detail: str = ""
    evidence_used: list[str] = []


class DecisionOutcome(str, Enum):
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    ESCALATE = "escalate"


class Recommendation(BaseModel):
    id: str = Field(default_factory=_new_id)
    case_id: str
    timestamp: datetime = Field(default_factory=_utcnow)
    outcome: DecisionOutcome
    confidence: float = 1.0  # 0.0-1.0
    rule_evaluations: list[RuleEvaluation] = []
    explanation: str = ""
    pension_type: str = ""  # "full", "partial", ""
    partial_ratio: Optional[str] = None  # e.g. "25/40"
    missing_evidence: list[str] = []
    flags: list[str] = []


# ---------------------------------------------------------------------------
# Human review
# ---------------------------------------------------------------------------

class ReviewAction(str, Enum):
    APPROVE = "approve"
    MODIFY = "modify"
    REJECT = "reject"
    REQUEST_INFO = "request_info"
    ESCALATE = "escalate"


class HumanReviewAction(BaseModel):
    id: str = Field(default_factory=_new_id)
    case_id: str
    recommendation_id: str
    reviewer: str = "officer"
    action: ReviewAction
    rationale: str = ""
    timestamp: datetime = Field(default_factory=_utcnow)
    final_outcome: Optional[DecisionOutcome] = None


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

class AuditEntry(BaseModel):
    timestamp: datetime = Field(default_factory=_utcnow)
    event_type: str
    actor: str  # "system" or reviewer id
    detail: str = ""
    data: dict = {}


class AuditPackage(BaseModel):
    case_id: str
    generated_at: datetime = Field(default_factory=_utcnow)
    jurisdiction: Optional[Jurisdiction] = None
    authority_chain: list[AuthorityReference] = []
    applicant_summary: dict = {}
    recommendation: Optional[Recommendation] = None
    review_actions: list[HumanReviewAction] = []
    audit_trail: list[AuditEntry] = []
    rules_applied: list[RuleEvaluation] = []
    evidence_summary: list[dict] = []
