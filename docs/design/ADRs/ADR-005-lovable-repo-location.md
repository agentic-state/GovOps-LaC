# ADR-005 — Lovable code repo location

**Status**: Superseded — 2026-04-29. The Lovable authoring channel was retired at v2.0 launch. The `web/` artefact is now maintained directly in this repo. The decision below is preserved for historical context.
**Date**: 2026-04-25
**Gate**: 5 (locked at end of Phase 0; PLAN-introduced)
**Context**: Phase 6 of [PLAN.md](../../../PLAN.md) replaces the Jinja UI with a Lovable application. We need to decide whether the Lovable code lives in this repo or a sibling repo.

---

## Decision

**Same repo, single destination folder: `web/`**.

The Lovable application is **authored upstream** in Lovable's own tooling/environment, then the built artefact is **brought into this repo** under `web/` for versioning, review, and release alongside the backend. Lovable is the editor; this repo is the source of truth.

The OpenAPI snapshot at `docs/api/openapi-v0.2.0.json` (frozen in Phase 0) is the contract Lovable consumes. Any backend API change updates the snapshot in the same PR that introduces it; the next Lovable import that depends on the change picks up the new snapshot.

## Rationale

| Criterion | Same repo (`web/`) | Sibling repo (`61-GovOps-web/`) |
| --- | --- | --- |
| Cross-cutting feature lands in one PR | Yes | No (two PRs, two reviews) |
| OpenAPI contract drift caught by CI | Immediately | Only via versioned dependency upgrade |
| Single issue tracker / single release | Yes | No |
| Lovable can ship its own cadence | Possible (separate workflow) | Native |
| Repo size grows | Yes (UI + backend in one tree) | No |
| Convention | Same-tree `web/` is a familiar pattern | New folder layout |

The decisive factors:

- **Contract drift is the primary v2.0 risk.** Two-repo separation makes drift invisible until a version bump; same-repo makes it a CI failure on the PR that introduced it.
- **Same-tree `web/` is a familiar pattern.** Co-locating the frontend with the backend keeps the convention obvious; new contributors don't need to learn a multi-repo layout.
- **Single release.** A v2.0 release is "this repo at tag X" — backend + UI together. No version-pinning gymnastics.

The cost (repo size, two toolchains in CI) is acceptable. We can revisit and extract `web/` to a sibling repo if Lovable cadence diverges materially from backend cadence — that would be a future ADR superseding this one.

## Lovable-as-editor workflow

1. UI work happens in Lovable's environment, against the frozen OpenAPI contract.
2. Built artefact (or source export) is brought into `web/` via a PR.
3. PR review covers: dependency drift, accessibility regressions, contract alignment.
4. CI runs both backend (`pytest`) and (Phase 6+) UI gates from the same workflow file.
5. Tags release backend + UI together.

## Out of scope

- Whether `web/` contains the Lovable source export, the built bundle, or both. Decide during Phase 6 when the import workflow is exercised for the first time.
- UI test framework selection. Defer to Phase 6.
- Whether Lovable artefacts are committed as-is or post-processed. Defer to Phase 6.

## Consequences

- The Phase 6 entry checklist will include: "verify OpenAPI snapshot still matches `/openapi.json` from a running server".
- CI gains a UI workflow at Phase 6; until then, `web/` does not exist and CI is unchanged.
- The `web/` folder gets its own `.gitignore` rules for build artefacts when first added.
- Backend PRs that change the API schema must update `docs/api/openapi-v*.json` in the same PR — enforced by CI in Phase 6.
- If Lovable cadence diverges later, extracting `web/` to a sibling repo is a single-commit `git filter-repo` operation; the decision is reversible.
