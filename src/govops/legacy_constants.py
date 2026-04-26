"""Substrate bootstrap — loads ``lawcode/`` YAML at module import.

Per [ADR-003](../../docs/design/ADRs/ADR-003-yaml-over-json.md) and [ADR-004
](../../docs/design/ADRs/ADR-004-backcompat-during-migration.md), Phase 3
makes ``lawcode/<jurisdiction>/config/*.yaml`` the canonical store for every
ConfigValue the engine and seed code consume. This module's only job is to
load that tree into a private ``ConfigStore`` at import time so that
``resolve_param(key)`` calls — issued by ``seed.py``, ``jurisdictions.py``,
``i18n.py``, and ``engine.py`` at module load — return the substrate value.

Key schema (per [ADR-006](../../docs/design/ADRs/ADR-006-per-parameter-granularity.md)):
``<jurisdiction>.<domain>.<scope>.<param>``

The jurisdiction prefix is one of ``ca`` / ``br`` / ``es`` / ``fr`` / ``de``
/ ``ua`` (mapping to the full ``ca-oas`` / ``br-inss`` / etc. ids in the
substrate) — or ``global`` / ``ui`` for cross-jurisdictional values.

Path resolution: ``AIA_LAWCODE_PATH`` env var overrides the default of
``<repo-root>/lawcode/`` (three levels up from this file).

Phase 2 history: this module previously held register_legacy() calls
mirroring the engine's defaults during the migration. Those calls are
retired at Phase 3.3; ``LEGACY_CONSTANTS`` now stays empty in normal
operation, and the resolver hits SUBSTRATE every time. The dict is
preserved as a public symbol for ad-hoc test fixtures (see
``test_config_legacy.py``).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from govops.config import ConfigStore  # noqa: F401  re-exported for convenience

_resolver = ConfigStore()


def _default_lawcode_path() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "lawcode"


_lawcode_path = Path(os.environ.get("AIA_LAWCODE_PATH") or _default_lawcode_path())
if _lawcode_path.exists():
    _resolver.load_from_yaml(_lawcode_path)


_JURISDICTION_PREFIX_TO_ID = {
    "ca": "ca-oas",
    "br": "br-inss",
    "es": "es-jub",
    "fr": "fr-cnav",
    "de": "de-drv",
    "ua": "ua-pfu",
    # "global" and "ui" map to the global scope (None / "global" — equivalent).
}

_RP_MISSING: Any = object()


def resolve_param(key: str, default: Any = _RP_MISSING) -> Any:
    """Resolve a parameter from the substrate.

    Extracts the jurisdiction code from the first dotted segment of the key
    (``ca.rule.age-65.min_age`` → ``ca-oas``) so the substrate query matches
    YAML records scoped to the full jurisdiction id.

    Returns the bare value (not a ``ResolutionResult``). With no default,
    raises ``ConfigKeyNotMigrated`` in strict mode if the key is unknown.
    With an explicit ``default``, returns it instead — useful for optional
    lookups (e.g. translation fallbacks) that should never raise.
    """
    prefix = key.split(".", 1)[0]
    jurisdiction_id = _JURISDICTION_PREFIX_TO_ID.get(prefix)
    if default is _RP_MISSING:
        return _resolver.resolve_value(key, jurisdiction_id=jurisdiction_id).value
    return _resolver.resolve_value(
        key, jurisdiction_id=jurisdiction_id, default=default
    ).value
