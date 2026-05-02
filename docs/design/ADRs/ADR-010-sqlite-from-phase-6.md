# ADR-010 — SQLite-backed ConfigStore from Phase 6

**Status**: Accepted
**Date**: 2026-04-26
**Track / Gate**: Law-as-Code v2.0 / Gate 3 (revised)
**Supersedes**: [ADR-007 — In-memory storage through Phase 10](ADR-007-in-memory-storage.md), storage clause only — the rest of ADR-007 (no managed-DB ops surface, no production hardening, no auth) stays in force.

## Context

ADR-007 locked pure in-memory storage for Phases 1–10, deferring all persistence to a separate "storage track" after Phase 10. That call was right for Phases 1–5: the substrate's job was to be a clean dated-key/value contract, and a Python dict + ULIDs + reseeding-from-YAML-on-startup was the simplest possible thing that demonstrated the contract worked. With 324 ConfigValues and a write-rate of zero, the dict was indistinguishable from a database except in cost.

Phase 6 changes the calculus. The phase exit line, verbatim from [PLAN.md §Phase 6](../../../PLAN.md):

> a maintainer can change `ca-oas.rule.age-65.min_age` from 65 to 67 effective 2027-01-01 entirely through the UI, and a case evaluated on 2027-01-02 picks up the new value

The implication is that a runtime change **survives a process restart**. With pure in-memory storage, the only way to make that true is to hand-edit `lawcode/ca/config/rules.yaml` and reseed — which defeats the configure-without-deploy promise the entire project is built around.

Three scenarios were considered. Two violate either the exit line or the YAML-as-authored-truth principle. The third — embedded SQLite hydrated from YAML — satisfies both.

## Decision

`ConfigStore` moves from a pure in-memory dict to a SQLite-backed implementation, accessed via [SQLModel](https://sqlmodel.tiangolo.com/) (Pydantic-friendly, one new dependency, well-supported, type-coherent with the existing `ConfigValue` model).

Operating contract:

- **YAML stays the authored source-of-truth.** `lawcode/<jurisdiction-or-global>/*.yaml` remains the canonical input. Translators, policy editors, and contributors continue to PR YAML files. Schema validation (Phase 5) still gates them.
- **DB is hydrated from YAML on startup.** The hydrator is idempotent and reconciliation-based:
  - Records present in YAML and missing from DB → inserted
  - Records present in both, matched by `(key, jurisdiction_id, effective_from, language)` → skipped (DB row wins; YAML never silently overwrites runtime state)
  - Records present in DB but absent from YAML (i.e. created via runtime API) → kept untouched
- **Runtime writes hit SQLite directly.** `POST /api/config/values`, `/approve`, `/request-changes`, `/reject` survive process restarts.
- **Audit becomes a real table.** Approval state transitions and resolution provenance are queryable instead of being a Python list.
- **DB file location**: `var/govops.db` (relative to repo root), gitignored. Configurable via `GOVOPS_DB_PATH` env var.
- **Tests** use `:memory:` SQLite (or a temp file per test where state needs to survive a fixture).
- **`ConfigStore`'s public interface is preserved.** `put`, `resolve`, `resolve_value`, `list`, `list_versions`, `supersede`, `load_from_yaml`, `get`, `all`, `clear`, `__len__` keep their signatures. Callers don't change.

## Consequences

### Positive

- Phase 6 exit line is literally satisfiable; configure-without-deploy is real
- Phase 7 reverse index (citation → records) becomes a SQL index, not a full Python scan
- Phase 8 federation has a natural home for `(source_repo, source_commit, fetched_at)` provenance per record
- Approval state machine becomes transactional; concurrent reviewer actions are sequenced cleanly
- Audit log is queryable (by case, by actor, by date) — useful for Phase 7+ even without API surface for it
- Demo experience unchanged: clone, `pip install -e .`, `govops-demo`. SQLite file is created on first run, seeded from YAML, no external service.

### Negative

- One new dependency: `sqlmodel`
- Test fixtures need light changes (use `:memory:` SQLite or per-test temp file)
- ADR-007's "in-memory through Phase 10" storage clause is partially reversed; this ADR makes that explicit
- A `var/` directory now exists in the workspace at runtime (gitignored)

### Mitigations

- The hedge in [PLAN.md §11](../../../PLAN.md) — *"Persistence layer (SQLite / PostgreSQL) — separate track after Phase 10"* — referred to **production operational databases**: managed PostgreSQL with HA, backup, monitoring, ops on-call. **SQLite as embedded storage — a file beside the code, not infrastructure** — is a different category. PLAN.md will be updated alongside this ADR's first commit to make the distinction explicit.
- Test migration is mechanical, not architectural — the public interface holds, so most call sites don't change.
- The hydrator is ~50 lines, idempotent, and safe to re-run on every startup. No migration framework needed at this scale.
- `var/govops.db` is local-machine state. CI runs from a fresh DB seeded by the YAML hydrator each run. No machine-to-machine state coupling.

## Alternatives Considered

### A. Pure in-memory; accept restart-loss
Cleanest fidelity to original ADR-007. Phase 6 exit cannot be satisfied across restarts.
**Rejected**: configure-without-deploy is a project pillar; punting it is not an option for the phase whose entire purpose is to deliver it.

### B. In-memory + YAML round-trip on every runtime write
Satisfies persistence, but mutates the authored source-of-truth tree at runtime. Phase 8 federation would have to disambiguate *"this YAML row was authored by a contributor PR"* vs. *"this YAML row was inserted by an admin button-click."* Merge-conflict risk if two writers race. ADR-008's prompt dual-approval becomes harder to reason about.
**Rejected**: muddies the YAML-as-source contract; pushes complexity onto every downstream phase.

### D. Defer write persistence to the post-Phase-10 storage track
Means Phase 6 ships with mock-only writes; the UI works, but the backend doesn't close the loop.
**Rejected**: the whole point of Phase 6 is to close that loop.

## Notes

This ADR amends Gate 3 (Phase 1 storage-model gate). The original Gate 3 lock — "in-memory; storage migration is a separate track" — held cleanly through Phases 1–5 because writes were zero. From Phase 6 onward writes are the point, and the original Gate 3 framing no longer fits without the embedded-SQLite refinement codified here.
