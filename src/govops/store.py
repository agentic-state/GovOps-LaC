"""In-memory store for the GovOps demo.

Provides a simple dict-backed store so the demo runs without any database.
All data lives in memory and resets on restart, seeded from seed.py.
"""

from __future__ import annotations

from govops.models import (
    AuditEntry,
    AuditPackage,
    AuthorityReference,
    CaseBundle,
    CaseEvent,
    CaseStatus,
    HumanReviewAction,
    Jurisdiction,
    LegalDocument,
    LegalRule,
    Recommendation,
)


class DemoStore:
    def __init__(self):
        self.jurisdictions: dict[str, Jurisdiction] = {}
        self.authority_chain: list[AuthorityReference] = []
        self.legal_documents: dict[str, LegalDocument] = {}
        self.rules: dict[str, LegalRule] = {}
        self.cases: dict[str, CaseBundle] = {}
        # Latest recommendation per case (for fast reads). Phase 10D adds
        # `recommendation_history` so the supersession chain is queryable.
        self.recommendations: dict[str, Recommendation] = {}  # keyed by case_id
        self.recommendation_history: dict[str, list[Recommendation]] = {}  # keyed by case_id
        self.review_actions: dict[str, list[HumanReviewAction]] = {}  # keyed by case_id
        self.audit_trails: dict[str, list[AuditEntry]] = {}  # keyed by case_id
        # Phase 10D — append-only event log per case.
        self.case_events: dict[str, list[CaseEvent]] = {}  # keyed by case_id

    def seed(
        self,
        jurisdiction: Jurisdiction,
        authority_chain: list[AuthorityReference],
        legal_documents: list[LegalDocument],
        rules: list[LegalRule],
        cases: list[CaseBundle],
    ):
        # Reset all state so re-seeding (e.g. between tests) starts clean
        self.jurisdictions = {}
        self.authority_chain = []
        self.legal_documents = {}
        self.rules = {}
        self.cases = {}
        self.recommendations = {}
        self.recommendation_history = {}
        self.review_actions = {}
        self.audit_trails = {}
        self.case_events = {}

        self.jurisdictions[jurisdiction.id] = jurisdiction
        self.authority_chain = list(authority_chain)
        for doc in legal_documents:
            self.legal_documents[doc.id] = doc
        for rule in rules:
            self.rules[rule.id] = rule
        for case in cases:
            self.cases[case.id] = case
            self.audit_trails[case.id] = [
                AuditEntry(
                    event_type="case_created",
                    actor="system:seed",
                    detail=f"Demo case created: {case.applicant.legal_name}",
                )
            ]

    def get_case(self, case_id: str) -> CaseBundle | None:
        return self.cases.get(case_id)

    def save_recommendation(self, rec: Recommendation, audit: list[AuditEntry]):
        self.recommendations[rec.case_id] = rec
        # Append to the history chain — preserves all prior recommendations
        # so the supersession trail is queryable even after multiple
        # reassessments. Latest in `recommendations`, full chain in
        # `recommendation_history`.
        self.recommendation_history.setdefault(rec.case_id, []).append(rec)
        case = self.cases.get(rec.case_id)
        if case:
            case.status = CaseStatus.RECOMMENDATION_READY
        self.audit_trails.setdefault(rec.case_id, []).extend(audit)

    def save_event(self, event: CaseEvent) -> None:
        """Append a life event to the case's event log.

        Per ADR-013, events are append-only: there is no edit, no delete.
        Corrections are new events with an explicit ``supersedes_event_id``
        in the payload.
        """
        self.case_events.setdefault(event.case_id, []).append(event)
        self.audit_trails.setdefault(event.case_id, []).append(
            AuditEntry(
                event_type="case_event_recorded",
                actor=event.actor,
                detail=f"{event.event_type.value} effective {event.effective_date.isoformat()}",
                data={
                    "event_id": event.id,
                    "event_type": event.event_type.value,
                    "effective_date": event.effective_date.isoformat(),
                    "payload": event.payload,
                },
            )
        )

    def save_review(self, review: HumanReviewAction):
        self.review_actions.setdefault(review.case_id, []).append(review)
        case = self.cases.get(review.case_id)
        if case:
            case.status = CaseStatus.DECIDED
        self.audit_trails.setdefault(review.case_id, []).append(
            AuditEntry(
                event_type="human_review",
                actor=review.reviewer,
                detail=f"Action: {review.action.value} | Rationale: {review.rationale}",
                data={"action": review.action.value, "final_outcome": review.final_outcome.value if review.final_outcome else None},
            )
        )

    def build_audit_package(self, case_id: str) -> AuditPackage | None:
        case = self.cases.get(case_id)
        if not case:
            return None
        jur = self.jurisdictions.get(case.jurisdiction_id)
        rec = self.recommendations.get(case_id)
        reviews = self.review_actions.get(case_id, [])
        trail = self.audit_trails.get(case_id, [])
        return AuditPackage(
            case_id=case_id,
            jurisdiction=jur,
            authority_chain=self.authority_chain,
            applicant_summary={
                "legal_name": case.applicant.legal_name,
                "date_of_birth": str(case.applicant.date_of_birth),
                "legal_status": case.applicant.legal_status,
            },
            recommendation=rec,
            review_actions=reviews,
            audit_trail=trail,
            rules_applied=rec.rule_evaluations if rec else [],
            evidence_summary=[
                {"type": e.evidence_type, "provided": e.provided, "verified": e.verified}
                for e in case.evidence_items
            ],
        )
