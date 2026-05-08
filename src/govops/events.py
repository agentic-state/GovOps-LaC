"""Life-event application for case reassessment (Phase 10D / ADR-013).

A ``CaseEvent`` is an append-only record describing a change to a citizen's
circumstances: they moved country, their legal status changed, they
supplied new evidence, or they explicitly asked for a re-evaluation. Each
event has an ``effective_date`` (when the change takes effect from the
case's perspective) and a ``recorded_at`` (when it was captured).

``apply_event`` projects an event onto a case, returning a new
``CaseBundle`` with the change applied. The function is pure: the input
case is not mutated, and applying the same event twice yields equivalent
state. The store keeps both the case and the event log; replaying events
chronologically reconstructs the case as of any historical date.
"""

from __future__ import annotations

from datetime import date

from govops.models import (
    CaseBundle,
    CaseEvent,
    EventType,
    EvidenceItem,
    ResidencyPeriod,
)


class EventApplicationError(ValueError):
    """Raised when an event's payload is malformed or inapplicable."""


def apply_event(case: CaseBundle, event: CaseEvent) -> CaseBundle:
    """Apply an event to a case, returning a new CaseBundle.

    The original case is not mutated. Each event_type knows how to project
    its payload onto the case state. New event types add a branch here +
    a corresponding test in ``tests/test_events.py``.
    """
    # Pydantic deep-copy preserves the case shape; we mutate the copy.
    new_case = case.model_copy(deep=True)

    if event.event_type is EventType.MOVE_COUNTRY:
        _apply_move_country(new_case, event)
    elif event.event_type is EventType.CHANGE_LEGAL_STATUS:
        _apply_change_legal_status(new_case, event)
    elif event.event_type is EventType.ADD_EVIDENCE:
        _apply_add_evidence(new_case, event)
    elif event.event_type is EventType.RE_EVALUATE:
        # Marker only — no state delta. Triggers reassessment without
        # changing the case.
        pass
    else:  # pragma: no cover — exhaustive over EventType
        raise EventApplicationError(f"unhandled event type: {event.event_type}")

    return new_case


# ---------------------------------------------------------------------------
# Per-event-type appliers
# ---------------------------------------------------------------------------


def _apply_move_country(case: CaseBundle, event: CaseEvent) -> None:
    """Close the current open residency period (if any) and optionally open
    a new one in the destination country.

    Payload schema:
        {
          "to_country": "BR",          # required — ISO code
          "from_country": "CA",        # optional — for documentation; if omitted we close any open period
          "open_new": true             # optional, default true — open a new ongoing period
        }
    """
    payload = event.payload
    to_country = payload.get("to_country")
    if not to_country:
        raise EventApplicationError("move_country requires payload.to_country")
    from_country = payload.get("from_country")  # optional documentation
    open_new = payload.get("open_new", True)

    # Close the most recent open residency period whose country matches
    # `from_country` if provided; else close any open period.
    for period in reversed(case.residency_periods):
        if period.end_date is not None:
            continue
        if from_country and period.country.upper() != from_country.upper():
            continue
        period.end_date = event.effective_date
        break

    if open_new:
        case.residency_periods.append(
            ResidencyPeriod(
                country=to_country,
                start_date=event.effective_date,
                end_date=None,
                verified=False,
            )
        )


def _apply_change_legal_status(case: CaseBundle, event: CaseEvent) -> None:
    """Update the applicant's legal_status as of the event's effective_date.

    Payload schema:
        {
          "to_status": "permanent_resident",   # required
        }

    Phase 10D v1 keeps no per-field history on the applicant — the latest
    status wins. A future event-sourcing pass may surface a status timeline.
    """
    payload = event.payload
    to_status = payload.get("to_status")
    if not to_status:
        raise EventApplicationError("change_legal_status requires payload.to_status")
    case.applicant.legal_status = to_status


def _apply_add_evidence(case: CaseBundle, event: CaseEvent) -> None:
    """Append an EvidenceItem to the case.

    Payload schema:
        {
          "evidence_type": "tax_record",   # required
          "description": "...",            # optional
          "verified": false,               # optional, default false
          "source_reference": "..."        # optional
        }
    """
    payload = event.payload
    evidence_type = payload.get("evidence_type")
    if not evidence_type:
        raise EventApplicationError("add_evidence requires payload.evidence_type")
    case.evidence_items.append(
        EvidenceItem(
            evidence_type=evidence_type,
            description=payload.get("description", ""),
            provided=True,
            verified=payload.get("verified", False),
            source_reference=payload.get("source_reference", ""),
        )
    )


# ---------------------------------------------------------------------------
# Event replay — reconstruct case state as-of a historical date
# ---------------------------------------------------------------------------


def replay_events(
    base_case: CaseBundle,
    events: list[CaseEvent],
    *,
    as_of: date,
) -> CaseBundle:
    """Replay events whose effective_date <= as_of onto base_case in order.

    Order is by ``(effective_date, recorded_at)`` so two events at the
    same effective_date are applied in the order they were captured —
    the deterministic tiebreaker matters for reproducibility.

    The function is pure; ``base_case`` and ``events`` are not mutated.
    """
    relevant = [e for e in events if e.effective_date <= as_of]
    relevant.sort(key=lambda e: (e.effective_date, e.recorded_at))
    case = base_case
    for event in relevant:
        case = apply_event(case, event)
    return case
