# ADR-004 — Backwards-compat strategy during ConfigValue migration

**Status**: Accepted
**Date**: 2026-04-25
**Gate**: 6 (locked at end of Phase 0; PLAN-introduced)
**Context**: Phases 1–2 of [PLAN.md](../../../PLAN.md) introduce `ConfigStore.resolve()` and migrate every hardcoded business constant. Tests must stay green at every phase exit. We need an explicit strategy for keeping the system green while the cutover is in flight.

---

## Decision

`ConfigStore.resolve(key, evaluation_date, jurisdiction_id=None)` implements a **two-tier resolution** during the migration window:

1. **Primary tier**: look up the key in the in-memory ConfigValue store. If a record exists with a matching effective period, return it.
2. **Fallback tier**: if no record exists, look up the key in a `LEGACY_CONSTANTS` registry that mirrors today's Python values. Return the legacy value and emit a `ConfigResolution` audit entry tagged `source=legacy`.
3. **Strict mode**: when `EVA_CONFIG_STRICT=1` is set, the fallback path raises `ConfigKeyNotMigrated`. CI runs in strict mode after Phase 2 exit; before that, it runs in lenient mode.

The legacy registry is populated at startup from the existing seed/jurisdiction modules. Phase 2 migrates one **domain at a time** (e.g. all `rule.parameter.*` keys, then all `engine.threshold.*`, then `enum.*`, then `ui.label.*`). After each domain migrates, its keys are removed from `LEGACY_CONSTANTS` and the corresponding Python constants are deleted.

---

## Rationale

The naive "rip-and-replace" approach forces every test to pass with the new substrate before any test passes against the old one. That's a flag-day cutover with no ability to bisect failures by domain.

Two-tier resolution lets us:

- Land the substrate (Phase 1) without breaking a single test
- Migrate domain-by-domain in Phase 2, with each domain's tests proving the cutover before the next domain begins
- Detect "I forgot to migrate this key" via the strict-mode CI gate at Phase 2 exit
- Keep the audit trail honest by recording which values came from substrate vs legacy

---

## Migration order (Phase 2)

| Order | Domain | Key shape | Files touched |
| ---: | --- | --- | --- |
| 1 | `rule.parameter.*` | `<jur>.rule.<rule-id>.<param>` | `seed.py`, `jurisdictions.py` |
| 2 | `engine.threshold.*` | `<jur>.engine.<rule-type>.<key>` | `seed.py`, `jurisdictions.py`, `engine.py` |
| 3 | `enum.*` | `global.enum.<name>` or `<jur>.enum.<name>` | `models.py`, `seed.py`, `jurisdictions.py` |
| 4 | `ui.label.*` | `ui.label.<key>` (per language) | `i18n.py`, `templates/*` |
| 5 | `global.config.*` | `global.config.<name>` | `i18n.py`, `cli.py` |

Per-domain exit gate: full pytest run green; corresponding Python constant deleted; lenient-mode warnings for that domain's keys = 0.

---

## Failure modes guarded against

- **Forgot to migrate a key** — strict-mode CI gate raises `ConfigKeyNotMigrated`.
- **Migrated a key but old call site still reads the constant** — Python constant deletion forces compile error; pre-commit hook checks for any remaining bare-name usage of removed constants.
- **Wrong effective_from date** — every Phase-2 ConfigValue defaults `effective_from = date(1900, 1, 1)` (i.e. "always in effect"); semantic dates are added in Phase 6 admin UI work.
- **Tests pass with legacy fallback but fail with strict mode** — pytest fixture `strict_config` forces strict mode for engine/encoder tests starting in Phase 1. UI tests stay lenient until Phase 4.

---

## Consequences

- `ConfigStore` ships with both a substrate and a legacy registry through Phase 2; the legacy registry is deleted at Phase 2 exit.
- Strict-mode CI gate is added in Phase 2; it stays on for all subsequent phases.
- Tests gain a `strict_config` fixture (Phase 1).
- The audit trail's `ConfigResolution.source` field distinguishes `substrate`, `legacy`, and (later) `federated`.
- Phase 2's per-domain commits are bisectable.
- Migration is resumable: stopping after domain 3 of 5 leaves a working system, just with i18n and global config still on the legacy path.

## What this is not

- This is not a permanent dual-mode system. The legacy registry is **deleted** at Phase 2 exit. The two-tier resolution is a migration scaffold, not a feature.
