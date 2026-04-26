"""Phase 2 backcompat registry — Domain 1 (rule.parameter).

Per [ADR-004](../../docs/design/ADRs/ADR-004-backcompat-during-migration.md),
this module mirrors today's Python constants into ``LEGACY_CONSTANTS`` so
``ConfigStore.resolve_value()`` can resolve rule parameters via the legacy
tier while the substrate is still being seeded (Phase 2 -> Phase 3 -> Phase 6).

Key schema (per [ADR-006](../../docs/design/ADRs/ADR-006-per-parameter-granularity.md)):
``<jurisdiction>.rule.<rule-slug>.<param>``

The jurisdiction segment is the country code ``ca``, ``br``, ``es``, ``fr``,
``de``, or ``ua``. The rule slug is the ``LegalRule.id`` with the leading
``rule-`` (and country-prefix where present) stripped.

This whole module is **deleted at Phase 2 exit** once values move to
``lawcode/<jurisdiction>/config/*.yaml`` (Phase 3) and the substrate
(Phase 6 admin UI). Until then, the registry is the single source of truth
for these defaults.
"""

from __future__ import annotations

from typing import Any

from govops.config import ConfigStore, register_legacy

# ---------------------------------------------------------------------------
# Domain 1: rule.parameter.*
# ---------------------------------------------------------------------------

# Canada — Old Age Security (OAS)
register_legacy("ca.rule.age-65.min_age", 65)
register_legacy("ca.rule.residency-10.min_years", 10)
register_legacy("ca.rule.residency-10.home_countries", ["CA", "CANADA", "CAN"])
register_legacy("ca.rule.residency-pension-type.full_years", 40)
register_legacy("ca.rule.residency-pension-type.min_years", 10)
register_legacy("ca.rule.legal-status.accepted_statuses", ["citizen", "permanent_resident"])
register_legacy("ca.rule.evidence-age.required_types", ["birth_certificate"])

# Brazil — Aposentadoria por Idade (INSS)
register_legacy("br.rule.age.min_age", 65)
register_legacy("br.rule.contribution.min_years", 15)
register_legacy("br.rule.contribution.home_countries", ["BR", "BRAZIL"])
register_legacy("br.rule.contribution-calc.full_years", 40)
register_legacy("br.rule.contribution-calc.min_years", 15)
register_legacy("br.rule.status.accepted_statuses", ["citizen", "permanent_resident"])
register_legacy("br.rule.evidence.required_types", ["birth_certificate"])

# Spain — Pension de jubilacion
register_legacy("es.rule.age.min_age", 66)
register_legacy("es.rule.contribution-min.min_years", 15)
register_legacy("es.rule.contribution-min.home_countries", ["ES", "SPAIN"])
register_legacy("es.rule.contribution-calc.full_years", 36)
register_legacy("es.rule.contribution-calc.min_years", 15)
register_legacy("es.rule.status.accepted_statuses", ["citizen", "permanent_resident"])
register_legacy("es.rule.evidence.required_types", ["birth_certificate"])

# France — Retraite de base (CNAV)
register_legacy("fr.rule.age.min_age", 64)
register_legacy("fr.rule.trimestres-min.min_years", 2)
register_legacy("fr.rule.trimestres-min.home_countries", ["FR", "FRANCE"])
register_legacy("fr.rule.trimestres-calc.full_years", 43)
register_legacy("fr.rule.trimestres-calc.min_years", 2)
register_legacy("fr.rule.status.accepted_statuses", ["citizen", "permanent_resident"])
register_legacy("fr.rule.evidence.required_types", ["birth_certificate"])

# Germany — Regelaltersrente (DRV)
register_legacy("de.rule.age.min_age", 67)
register_legacy("de.rule.wartezeit.min_years", 5)
register_legacy("de.rule.wartezeit.home_countries", ["DE", "GERMANY"])
register_legacy("de.rule.beitragszeit.full_years", 45)
register_legacy("de.rule.beitragszeit.min_years", 5)
register_legacy("de.rule.status.accepted_statuses", ["citizen", "permanent_resident"])
register_legacy("de.rule.evidence.required_types", ["birth_certificate"])

# Ukraine — Pensiia za vikom (PFU)
register_legacy("ua.rule.age.min_age", 60)
register_legacy("ua.rule.stazh-min.min_years", 25)
register_legacy("ua.rule.stazh-min.home_countries", ["UA", "UKRAINE"])
register_legacy("ua.rule.stazh-calc.full_years", 35)
register_legacy("ua.rule.stazh-calc.min_years", 25)
register_legacy("ua.rule.status.accepted_statuses", ["citizen", "permanent_resident"])
register_legacy("ua.rule.evidence.required_types", ["birth_certificate"])


# ---------------------------------------------------------------------------
# Phase 2 helper — resolve via the two-tier resolver with no substrate set.
# At module load (seed time), the substrate ConfigStore is empty, so every
# call falls through to LEGACY_CONSTANTS. After Phase 3 lands the YAML
# loader, callers can switch to the populated singleton store transparently.
# ---------------------------------------------------------------------------

_resolver = ConfigStore()  # empty; only the LEGACY tier participates


def resolve_param(key: str) -> Any:
    """Resolve a rule parameter via the Phase 2 backcompat path.

    Returns the bare value (not a ``ResolutionResult``). Raises
    ``ConfigKeyNotMigrated`` in strict mode if the key has no entry.
    """
    return _resolver.resolve_value(key).value
