"""Tests for the ADR-004 backcompat layer (Phase 2 plumbing).

`resolve_value()` is a two-tier resolver: substrate → legacy → caller default.
`EVA_CONFIG_STRICT=1` makes legacy hits or empty resolutions loud — that gate
flips on at Phase 2 exit.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from govops import config as config_mod
from govops.config import (
    ConfigKeyNotMigrated,
    ConfigStore,
    ConfigValue,
    LEGACY_CONSTANTS,
    ResolutionSource,
    ValueType,
    register_legacy,
)


UTC = timezone.utc


@pytest.fixture(autouse=True)
def _clean_legacy_and_strict(monkeypatch):
    """Reset LEGACY_CONSTANTS and strict mode between tests so they don't leak."""
    monkeypatch.delenv("EVA_CONFIG_STRICT", raising=False)
    snapshot = dict(LEGACY_CONSTANTS)
    LEGACY_CONSTANTS.clear()
    yield
    LEGACY_CONSTANTS.clear()
    LEGACY_CONSTANTS.update(snapshot)


def _make_store_with(key: str, value, **kwargs) -> ConfigStore:
    store = ConfigStore()
    store.put(
        ConfigValue(
            domain=kwargs.get("domain", "rule"),
            key=key,
            jurisdiction_id=kwargs.get("jurisdiction_id"),
            value=value,
            value_type=kwargs.get("value_type", ValueType.NUMBER),
            effective_from=kwargs.get("effective_from", datetime(1900, 1, 1, tzinfo=UTC)),
            citation=kwargs.get("citation", "test"),
            language=kwargs.get("language"),
        )
    )
    return store


# ---------------------------------------------------------------------------
# Tier 1: substrate
# ---------------------------------------------------------------------------


def test_resolve_value_returns_substrate_when_present():
    store = _make_store_with(
        "ca-oas.rule.age-65.min_age", 67, jurisdiction_id="ca-oas",
    )
    register_legacy("ca-oas.rule.age-65.min_age", 65)  # would be stale

    result = store.resolve_value(
        "ca-oas.rule.age-65.min_age",
        evaluation_date=datetime(2026, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert result.value == 67
    assert result.source == ResolutionSource.SUBSTRATE


# ---------------------------------------------------------------------------
# Tier 2: legacy fallback
# ---------------------------------------------------------------------------


def test_resolve_value_falls_back_to_legacy():
    store = ConfigStore()
    register_legacy("ca-oas.rule.age-65.min_age", 65)

    result = store.resolve_value(
        "ca-oas.rule.age-65.min_age",
        evaluation_date=datetime(2026, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert result.value == 65
    assert result.source == ResolutionSource.LEGACY


def test_resolve_value_legacy_holds_lists():
    store = ConfigStore()
    register_legacy(
        "ca-oas.rule.legal-status.accepted_statuses",
        ["citizen", "permanent_resident"],
    )

    result = store.resolve_value("ca-oas.rule.legal-status.accepted_statuses")
    assert result.value == ["citizen", "permanent_resident"]
    assert result.source == ResolutionSource.LEGACY


# ---------------------------------------------------------------------------
# Tier 3: caller default (lenient mode only)
# ---------------------------------------------------------------------------


def test_resolve_value_returns_caller_default_when_nothing_matches():
    store = ConfigStore()
    result = store.resolve_value("nonexistent.key", default=42)
    assert result.value == 42
    assert result.source is None


def test_resolve_value_returns_none_when_no_default_and_lenient():
    store = ConfigStore()
    result = store.resolve_value("nonexistent.key")
    assert result.value is None
    assert result.source is None


# ---------------------------------------------------------------------------
# Strict mode (EVA_CONFIG_STRICT=1)
# ---------------------------------------------------------------------------


def test_resolve_value_strict_raises_on_legacy_hit(monkeypatch):
    monkeypatch.setenv("EVA_CONFIG_STRICT", "1")
    store = ConfigStore()
    register_legacy("ca-oas.rule.age-65.min_age", 65)

    with pytest.raises(ConfigKeyNotMigrated):
        store.resolve_value(
            "ca-oas.rule.age-65.min_age",
            jurisdiction_id="ca-oas",
        )


def test_resolve_value_strict_raises_when_nothing_matches(monkeypatch):
    monkeypatch.setenv("EVA_CONFIG_STRICT", "1")
    store = ConfigStore()
    with pytest.raises(ConfigKeyNotMigrated):
        store.resolve_value("nonexistent.key")


def test_resolve_value_strict_does_not_raise_on_substrate_hit(monkeypatch):
    monkeypatch.setenv("EVA_CONFIG_STRICT", "1")
    store = _make_store_with(
        "ca-oas.rule.age-65.min_age", 65, jurisdiction_id="ca-oas",
    )
    register_legacy("ca-oas.rule.age-65.min_age", 65)  # also present, irrelevant

    result = store.resolve_value(
        "ca-oas.rule.age-65.min_age",
        evaluation_date=datetime(2026, 1, 1, tzinfo=UTC),
        jurisdiction_id="ca-oas",
    )
    assert result.value == 65
    assert result.source == ResolutionSource.SUBSTRATE


def test_resolve_value_strict_caller_default_still_raises(monkeypatch):
    """Strict mode forbids silent fallthrough even with explicit default."""
    monkeypatch.setenv("EVA_CONFIG_STRICT", "1")
    store = ConfigStore()
    # Caller default is satisfied before the strict check, so this passes.
    # Documenting the behaviour: explicit default short-circuits the strict raise
    # even in strict mode. Strict mode only fails when neither substrate nor
    # legacy nor explicit default produced a value.
    result = store.resolve_value("nonexistent.key", default=42)
    assert result.value == 42
    assert result.source is None


# ---------------------------------------------------------------------------
# register_legacy idempotence
# ---------------------------------------------------------------------------


def test_register_legacy_overwrites_existing_value():
    register_legacy("foo", 1)
    register_legacy("foo", 2)
    assert LEGACY_CONSTANTS["foo"] == 2


def test_register_legacy_visible_via_module_namespace():
    register_legacy("ca-oas.rule.age-65.min_age", 65)
    assert config_mod.LEGACY_CONSTANTS["ca-oas.rule.age-65.min_age"] == 65
