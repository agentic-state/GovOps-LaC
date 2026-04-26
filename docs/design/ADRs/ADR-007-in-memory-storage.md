# ADR-007 — In-memory storage through Phase 10

**Status**: Accepted
**Date**: 2026-04-25
**Gate**: 3 (locked at start of Phase 1)
**Context**: [PLAN.md](../../../PLAN.md) §3 requires choosing the storage model for Phases 1–10. The choice is between **in-memory only** (consistent with v1.0; reseed-on-startup like the existing `DemoStore`) and a **persistence track** (SQLite/Postgres alongside the substrate work).

---

## Decision

**`ConfigStore` is in-memory through all 10 phases of Law-as-Code v2.0.**

State lives in process memory. On startup, the store is reseeded — from Python constants in Phases 1–2 (via the [ADR-004](ADR-004-backcompat-during-migration.md) backcompat fallback), from `lawcode/<jurisdiction>/config/*.yaml` files from Phase 3 onward. No database, no migrations, no state between runs.

Persistence is a **separate post-Phase-10 track** with its own ADR, its own gates, its own test suite, and its own decision on engine (SQLite vs Postgres vs file-based event log).

## Rationale

| Criterion | In-memory (chosen) | Persistence track in parallel |
| --- | --- | --- |
| Cognitive load during structural work | Low | High (substrate + DB schema + migration tooling concurrently) |
| Risk of substrate redesign forcing schema rework | Zero | High (Phases 1–5 reshape the model multiple times) |
| Test suite simplicity | Trivial fixtures | Per-test DB setup/teardown |
| Cross-platform startup | One Python process | Process + DB + connection management |
| Reproducibility of demo / `govops-demo` | Identical every run | Depends on DB state; non-deterministic without fixture loading |
| Match with v1.0 posture | Identical (1:1) | Divergent |
| Federation (Phase 8) implications | Trivial — load federated YAML at startup | Non-trivial — sync external data into local DB |
| Production-readiness gap | Real (no durability) | Closed |
| Time to ship structural work | Minimal | +20–30% across Phases 1–5 |

The thesis: the v2.0 work is about **substrate semantics** (effective dates, supersession, granularity, federation, prompts-as-config). Adding a persistence layer in parallel doubles the surface area without resolving any of those questions. Once the substrate is proven and the YAML schema is published (Phase 5), persistence becomes a focused, well-defined follow-up that can pick the right engine for the now-known shape.

## Consequences

### What this enables
- `ConfigStore` is a Python class with dicts and lists. No async, no connection pool, no migration framework.
- Tests use plain construction (`ConfigStore()`) and a small fixture helper. The full suite stays in-process.
- Demo (`govops-demo`) reseeds identically every run — same shape as v1.0.
- Federation (Phase 8) is "fetch YAML, parse, load into store" — no DB sync.
- Phase 6 admin UI writes go straight to the in-memory store. **Writes are lost on process restart by design** — admin actions are demonstrative; production deployments will need the persistence track before exposing real authoring.

### What this defers
- **Durability** of admin-written values. Phase 6 admin UI is a *reference implementation* of the configure-without-deploy flow, not a production authoring system.
- **Multi-instance deployment**. In-memory state means single-process; no horizontal scaling.
- **Event log** for change history beyond what the store itself remembers. The audit trail (`AuditPackage`) captures evaluations; it is not a durable journal of admin writes.

### What this does NOT preclude
- Reading from YAML on startup (Phase 3) — the YAML files *are* the durable artefact for jurisdictional content. Edits to `lawcode/**/*.yaml`, committed to git, survive restart.
- Federation snapshotting — fetched manifests under `lawcode/.federated/` (Phase 8) are durable on disk.
- The post-Phase-10 persistence track may layer durability **under** the existing `ConfigStore` interface without API changes. Designing the store for substitutability today.

## Implementation rules for `ConfigStore`

1. **Pure in-memory**: `dict[str, ConfigValue]` keyed by `id`, plus secondary indices keyed by `(jurisdiction_id, key)`.
2. **No I/O in core methods**: `put`, `get`, `list`, `resolve`, `list_versions` are all pure. YAML loading is a separate `load_from_yaml(path)` method (Phase 3).
3. **Thread-safety not required for v2.0**: FastAPI runs single-process by default; no concurrent writes assumed. Document this; revisit if persistence track adds workers.
4. **Substitutable interface**: define the read/write surface as a Protocol so a future `PersistentConfigStore` can implement it without changing call sites.
5. **Reseed on startup**: `lifespan` context in `api.py` reseeds the store on every boot. No cached state between runs.

## Consequences for the migration sequence

- Phase 1 ships `ConfigStore` and its API endpoints — empty store on boot, populated by ad-hoc test fixtures.
- Phase 2 migrates Python constants into `ConfigStore` seed calls inside `_seed_jurisdiction()`. State still in-memory, populated from Python.
- Phase 3 replaces those seed calls with `ConfigStore.load_from_yaml(...)`. State still in-memory, populated from YAML on disk.
- Phase 4 adds prompt records — same shape, same store.
- Phase 6 admin writes hit the store directly; values are lost on restart unless the YAML files are also amended (out of scope until persistence track).

## Alternatives considered

- **SQLite track in parallel** — rejected. Ships a real DB but introduces schema migrations, fixture management, and per-test cleanup costs across all of Phases 1–5. Risk of substrate redesign forcing schema rework is high.
- **Append-only file log (event-sourced)** — rejected for v2.0. Interesting model for the persistence track later; premature for the substrate phase.
- **Use git itself as the store** (commit each `ConfigValue` as a YAML file) — rejected for the runtime store; *adopted for the canonical artefact* (Phase 3 YAML files in git). Runtime read path is in-memory; durable artefact is git.
- **Postgres** — rejected as v2.0 dependency; revisit only in the persistence track when the YAML schema is stable.

## Out of scope

- Choice of engine for the persistence track.
- Multi-tenant isolation.
- Backup/restore semantics.
- Crash recovery.

These are real concerns for production. They are not v2.0 concerns.
