"""Tests for the ConfigValue substrate (Phase 1)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from govops.config import (
    ApprovalStatus,
    ConfigStore,
    ConfigValue,
    ValueType,
)


UTC = timezone.utc


def _cv(
    key: str,
    value,
    effective_from: datetime,
    *,
    jurisdiction_id=None,
    language=None,
    effective_to=None,
    value_type=ValueType.NUMBER,
    domain="rule",
    citation="OAS Act, s. 3(1)",
    status=ApprovalStatus.APPROVED,
    supersedes=None,
) -> ConfigValue:
    return ConfigValue(
        domain=domain,
        key=key,
        jurisdiction_id=jurisdiction_id,
        value=value,
        value_type=value_type,
        effective_from=effective_from,
        effective_to=effective_to,
        citation=citation,
        status=status,
        language=language,
        supersedes=supersedes,
    )


# ---------------------------------------------------------------------------
# Round-trip and identity
# ---------------------------------------------------------------------------


def test_put_returns_ulid_id():
    store = ConfigStore()
    cv = _cv("ca-oas.rule.age-65.min_age", 65, datetime(2000, 1, 1, tzinfo=UTC))
    rid = store.put(cv)
    assert rid == cv.id
    # Crockford base32 ULID is 26 chars.
    assert len(rid) == 26


def test_get_round_trip():
    store = ConfigStore()
    cv = _cv("ca-oas.rule.age-65.min_age", 65, datetime(2000, 1, 1, tzinfo=UTC))
    store.put(cv)
    retrieved = store.get(cv.id)
    assert retrieved is not None
    assert retrieved.value == 65
    assert retrieved.key == "ca-oas.rule.age-65.min_age"


def test_get_unknown_returns_none():
    store = ConfigStore()
    assert store.get("nonexistent") is None


# ---------------------------------------------------------------------------
# Effective-date semantics
# ---------------------------------------------------------------------------


def test_resolve_returns_value_in_effect():
    store = ConfigStore()
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            65,
            datetime(1985, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
        )
    )
    out = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert out is not None
    assert out.value == 65


def test_resolve_returns_none_before_effective_from():
    store = ConfigStore()
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            65,
            datetime(2027, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
        )
    )
    out = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert out is None


def test_resolve_returns_none_after_effective_to():
    store = ConfigStore()
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            65,
            datetime(1985, 1, 1, tzinfo=UTC),
            effective_to=datetime(2027, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
        )
    )
    out = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2030, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert out is None


def test_resolve_excludes_non_approved():
    store = ConfigStore()
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            67,
            datetime(2000, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
            status=ApprovalStatus.PENDING,
        )
    )
    out = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert out is None


# ---------------------------------------------------------------------------
# Supersession chain
# ---------------------------------------------------------------------------


def test_supersede_closes_prior_and_creates_new():
    store = ConfigStore()
    original = _cv(
        "ca-oas.rule.age-65.min_age",
        65,
        datetime(1985, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    store.put(original)

    new = store.supersede(
        prior_id=original.id,
        new_value=67,
        effective_from=datetime(2027, 1, 1, tzinfo=UTC),
        author="reviewer",
        approved_by="maintainer",
        rationale="Statute amended",
    )

    assert new.value == 67
    assert new.supersedes == original.id
    assert store.get(original.id).effective_to == datetime(2027, 1, 1, tzinfo=UTC)


def test_resolve_picks_correct_version_across_supersession():
    store = ConfigStore()
    original = _cv(
        "ca-oas.rule.age-65.min_age",
        65,
        datetime(1985, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    store.put(original)
    store.supersede(
        prior_id=original.id,
        new_value=67,
        effective_from=datetime(2027, 1, 1, tzinfo=UTC),
        author="reviewer",
        approved_by="maintainer",
    )

    before = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    after = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2027, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )

    assert before.value == 65
    assert after.value == 67


def test_list_versions_sorted_by_effective_from():
    store = ConfigStore()
    v1 = _cv(
        "ca-oas.rule.age-65.min_age",
        65,
        datetime(1985, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    store.put(v1)
    store.supersede(
        prior_id=v1.id,
        new_value=67,
        effective_from=datetime(2027, 1, 1, tzinfo=UTC),
        author="reviewer",
        approved_by="maintainer",
    )

    versions = store.list_versions(
        "ca-oas.rule.age-65.min_age", jurisdiction_id="ca-oas"
    )
    assert len(versions) == 2
    assert versions[0].value == 65
    assert versions[1].value == 67


# ---------------------------------------------------------------------------
# Jurisdiction scoping + global fallback
# ---------------------------------------------------------------------------


def test_jurisdiction_scoping_isolates_keys():
    store = ConfigStore()
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            65,
            datetime(1985, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
        )
    )
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            65,
            datetime(1985, 1, 1, tzinfo=UTC),
            jurisdiction_id="br-prev",
        )
    )

    ca = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    br = store.resolve(
        "ca-oas.rule.age-65.min_age",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id="br-prev",
    )
    assert ca.jurisdiction_id == "ca-oas"
    assert br.jurisdiction_id == "br-prev"
    assert ca.id != br.id


def test_global_fallback_when_jurisdiction_record_missing():
    store = ConfigStore()
    store.put(
        _cv(
            "global.ui.label.cases.title",
            "Cases",
            datetime(2000, 1, 1, tzinfo=UTC),
            jurisdiction_id=None,
            language="en",
            domain="ui",
            value_type=ValueType.STRING,
        )
    )
    out = store.resolve(
        "global.ui.label.cases.title",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
        language="en",
    )
    assert out is not None
    assert out.value == "Cases"


def test_global_scope_alias_matches_none():
    store = ConfigStore()
    store.put(
        _cv(
            "global.ui.label.cases.title",
            "Cases",
            datetime(2000, 1, 1, tzinfo=UTC),
            jurisdiction_id="global",
            language="en",
            domain="ui",
            value_type=ValueType.STRING,
        )
    )
    via_none = store.resolve(
        "global.ui.label.cases.title",
        datetime(2020, 6, 1, tzinfo=UTC),
        jurisdiction_id=None,
        language="en",
    )
    assert via_none is not None
    assert via_none.value == "Cases"


# ---------------------------------------------------------------------------
# List + filter
# ---------------------------------------------------------------------------


def test_list_filters_by_domain_and_prefix():
    store = ConfigStore()
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            65,
            datetime(1985, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
        )
    )
    store.put(
        _cv(
            "ca-oas.rule.residency.min_years",
            10,
            datetime(1985, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
        )
    )
    store.put(
        _cv(
            "global.ui.label.cases.title",
            "Cases",
            datetime(2000, 1, 1, tzinfo=UTC),
            language="en",
            domain="ui",
            value_type=ValueType.STRING,
        )
    )

    rules_only = store.list(domain="rule")
    ui_only = store.list(domain="ui")
    age_only = store.list(key_prefix="ca-oas.rule.age")

    assert len(rules_only) == 2
    assert len(ui_only) == 1
    assert len(age_only) == 1
    assert age_only[0].value == 65


def test_list_filters_by_jurisdiction():
    store = ConfigStore()
    store.put(
        _cv(
            "ca-oas.rule.x",
            1,
            datetime(2000, 1, 1, tzinfo=UTC),
            jurisdiction_id="ca-oas",
        )
    )
    store.put(
        _cv(
            "br-prev.rule.x",
            2,
            datetime(2000, 1, 1, tzinfo=UTC),
            jurisdiction_id="br-prev",
        )
    )

    ca = store.list(jurisdiction_id="ca-oas")
    br = store.list(jurisdiction_id="br-prev")
    assert len(ca) == 1 and ca[0].value == 1
    assert len(br) == 1 and br[0].value == 2


# ---------------------------------------------------------------------------
# Boundary conditions
# ---------------------------------------------------------------------------


def test_resolve_at_exact_effective_from_inclusive():
    """effective_from is inclusive: a record effective at midnight is in effect at midnight."""
    store = ConfigStore()
    boundary = datetime(2027, 1, 1, tzinfo=UTC)
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            67,
            boundary,
            jurisdiction_id="ca-oas",
        )
    )
    out = store.resolve(
        "ca-oas.rule.age-65.min_age",
        boundary,
        jurisdiction_id="ca-oas",
    )
    assert out is not None and out.value == 67


def test_resolve_at_exact_effective_to_exclusive():
    """effective_to is exclusive: a record ending at midnight is NOT in effect at midnight."""
    store = ConfigStore()
    end = datetime(2027, 1, 1, tzinfo=UTC)
    store.put(
        _cv(
            "ca-oas.rule.age-65.min_age",
            65,
            datetime(1985, 1, 1, tzinfo=UTC),
            effective_to=end,
            jurisdiction_id="ca-oas",
        )
    )
    out = store.resolve(
        "ca-oas.rule.age-65.min_age",
        end,
        jurisdiction_id="ca-oas",
    )
    assert out is None


def test_supersede_on_unknown_id_raises():
    store = ConfigStore()
    with pytest.raises(KeyError):
        store.supersede(
            prior_id="nonexistent",
            new_value=99,
            effective_from=datetime(2027, 1, 1, tzinfo=UTC),
            author="reviewer",
        )
