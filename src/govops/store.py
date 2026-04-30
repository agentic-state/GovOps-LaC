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
    ProgramInteractionWarning,
    Recommendation,
)
from govops.programs import Program


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
        # v3 / ADR-018 — registered programs for the current jurisdiction,
        # keyed by `program_id`. Populated by api._seed_jurisdiction_programs
        # after `seed()`. Insertion order is preserved (Python dicts) so that
        # `program_evaluations` in the API response runs in registration order.
        self.programs: dict[str, Program] = {}
        # v3 / ADR-018 — latest recommendation per (case, program). Existing
        # `recommendations` (single, latest-of-any) is preserved unchanged for
        # back-compat. The audit package builds `program_evaluations` from
        # this map.
        self.program_recommendations: dict[str, dict[str, Recommendation]] = {}
        # v3 / ADR-018 — interaction warnings produced by the most recent
        # cross-program evaluation per case. Recomputed on each evaluate
        # call so it reflects the latest run, not history.
        self.program_warnings: dict[str, list[ProgramInteractionWarning]] = {}

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
        # v3 / ADR-018 — programs and per-program recommendations are also
        # per-jurisdiction state, so they reset alongside everything else.
        self.programs = {}
        self.program_recommendations = {}
        self.program_warnings = {}

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

    def register_program(self, program: Program) -> None:
        """Register a Program for the currently-seeded jurisdiction (ADR-018).

        Insertion order is preserved so the cross-program `evaluate` endpoint
        returns recommendations in registration order. Re-registering the
        same `program_id` overwrites the prior entry (last-write-wins) —
        useful for tests that swap a program in place.
        """
        self.programs[program.program_id] = program

    def save_recommendation(self, rec: Recommendation, audit: list[AuditEntry]):
        """Save a *primary* recommendation for the case.

        The primary chain is what the back-compat surfaces read: the
        singular `recommendations[case_id]` and the flat
        `recommendation_history[case_id]` (which the supersession-chain
        contract from ADR-013 walks). Phase E keeps this chain
        single-program — the cross-program API designates one program as
        primary per evaluation (OAS when present, otherwise the first
        evaluated program) and saves it here. Secondary programs are
        saved via :meth:`save_secondary_program_recommendation` and live
        only in the per-program index.
        """
        self.recommendations[rec.case_id] = rec
        self.recommendation_history.setdefault(rec.case_id, []).append(rec)
        # v3 / ADR-018 — when the rec carries a `program_id`, also index it
        # under the per-program map so cross-program audit consumers can
        # read latest-per-program in O(1).
        if rec.program_id:
            self.program_recommendations.setdefault(rec.case_id, {})[rec.program_id] = rec
        case = self.cases.get(rec.case_id)
        if case:
            case.status = CaseStatus.RECOMMENDATION_READY
        self.audit_trails.setdefault(rec.case_id, []).extend(audit)

    def save_secondary_program_recommendation(
        self, rec: Recommendation, audit: list[AuditEntry]
    ) -> None:
        """Save a non-primary program rec (ADR-018).

        Touches only the per-program index and the audit trail — leaves the
        primary chain (`recommendations`, `recommendation_history`) alone so
        ADR-013 supersession semantics stay single-program by design.
        """
        if rec.program_id:
            self.program_recommendations.setdefault(rec.case_id, {})[rec.program_id] = rec
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
        # v3 / ADR-018 — per-program slots. When the case has been evaluated
        # via the cross-program API, `program_recommendations` carries one
        # rec per program; render them in `programs` (insertion) order so
        # the audit consumer sees a stable layout. When the case was only
        # ever evaluated through the legacy single-program path,
        # `program_evaluations` stays empty and `recommendation` is the
        # only surface that matters.
        per_program = self.program_recommendations.get(case_id, {})
        program_evals: list[Recommendation] = []
        for program_id in self.programs.keys():
            if program_id in per_program:
                program_evals.append(per_program[program_id])
        # Pick up any per-program recs that aren't in the current programs
        # registry (e.g. the jurisdiction was switched between evaluations).
        for program_id, prec in per_program.items():
            if program_id not in self.programs:
                program_evals.append(prec)
        warnings = list(self.program_warnings.get(case_id, []))
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
            program_evaluations=program_evals,
            program_warnings=warnings,
        )
