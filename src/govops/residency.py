"""Residency-period math used by the engine and by shape evaluators.

Extracted from ``engine.py`` at the v3 Phase B refactor (per ADR-016) so the
engine and the ``old_age_pension`` shape evaluator can both read this without
introducing a circular import. Pure functions, no engine state.
"""

from __future__ import annotations

from datetime import date

from govops.models import ResidencyPeriod


def years_between(start: date, end: date) -> float:
    """Calculate years between two dates as a decimal (365.25 days/year)."""
    days = (end - start).days
    return days / 365.25


def home_residency_years_after_18(
    dob: date,
    residency_periods: list[ResidencyPeriod],
    ref_date: date,
    home_countries: tuple[str, ...],
) -> float:
    """Total years of home-country residency (or contribution) after age 18.

    Sums every residency period that overlaps with ``[age_18_date, ref_date]``
    and whose ``country`` (case-insensitive) appears in ``home_countries``.
    Periods entirely before age 18 contribute zero; periods straddling the
    cutoff contribute only the post-18 portion.

    Used by the engine's residency-rule evaluators for satisfaction checks
    AND by the ``old_age_pension`` shape's eligible-branch logic for the
    full-vs-partial pension determination — keeping both paths in sync by
    reading from the same module.
    """
    age_18_date = date(dob.year + 18, dob.month, dob.day)
    total_days = 0
    for period in residency_periods:
        if period.country.upper() not in home_countries:
            continue
        start = max(period.start_date, age_18_date)
        end = period.end_date or ref_date
        end = min(end, ref_date)
        if start < end:
            total_days += (end - start).days
    return total_days / 365.25
