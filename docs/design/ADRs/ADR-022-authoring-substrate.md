# ADR-022: Authoring substrate for non-ConfigValue records

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-11 |
| **Authors** | GovOps team |
| **Extends** | ADR-020 (lawcode-as-discovery) |
| **Lane** | v3.1 L7 |

## Context

ADR-020 made `lawcode/` the discovery source for `JURISDICTION_REGISTRY`. The promise was that adopting a new jurisdiction would be a YAML-only operation: drop `lawcode/<code>/config/jurisdiction.yaml` + `lawcode/<code>/programs/<id>.yaml` on disk, restart, and the running app picks it up.

That promise is still file-edit-mode for the operator. The v3.0 ConfigValue admin already proved a draft -> approve -> commit pattern works inside the app for parameter values. **What was missing**: the same pattern for the two file types ADR-020 actually reads — `jurisdiction.yaml` and program manifests. Without it, the "in-app adoption" story still requires the operator to either SSH into the box and edit YAML or open a PR.

L7 closes that gap with a generic authoring substrate the future v3.1.x UI wizards (Onboard, authority-chain editor, legal-documents editor, demo-cases editor — L8-L11 in the original plan) can drive through HTTP. The substrate itself ships in v3.1; the UI lanes follow in v3.1.x.

## Decision

A new module `src/govops/authoring.py` provides a `DraftStore` mirroring `ConfigStore`'s shape but for two new record types:

- `DraftType.JURISDICTION` -> targets `lawcode/<code>/config/jurisdiction.yaml`
- `DraftType.PROGRAM`      -> targets `lawcode/<code>/programs/<id>.yaml`

A `Draft` carries: `id`, `type`, `target_path` (relative to `lawcode/`), `content` (the YAML body as a dict), `status` (`pending` / `approved` / `rejected` / `committed`), authorship + approval audit fields.

HTTP API (under `/api/authoring/`):

| Endpoint | Purpose |
|---|---|
| `POST /drafts` | Create a draft (body: `{type, target_path, content, author, rationale?}`). |
| `GET /drafts?type=&status=` | List drafts with optional filters. |
| `GET /drafts/{id}` | Single draft. |
| `POST /drafts/{id}/approve` | Approve. Idempotent on `approved`. Refused on `rejected`/`committed` with 409. |
| `POST /drafts/{id}/reject` | Reject with a required `reason`. Idempotent on `rejected`. |
| `DELETE /drafts/{id}` | Discard a non-committed draft (204 on success). |
| `POST /commit` | Commit all `approved` drafts: write to `lawcode/<code>/...` then `reload_registry()`. Returns `{committed: [Draft], reloaded: bool}`. |

After a successful `POST /commit`, the registry rebuild rehydrates `JURISDICTION_REGISTRY` so the new jurisdiction is immediately visible on `/api/authority-chain?jurisdiction_id=<new>`, `/compare`, and `/screen`. The `/compare` manifest cache is also busted (it was added in L4 to fix the SQLAlchemy session race; commits introduce new manifests it must re-read).

### Storage + persistence

Drafts live in-memory plus a file-per-draft mirror at `lawcode/.drafts/<draft-id>.yaml`. On `DraftStore.__init__`, the store walks `.drafts/` and rehydrates any prior session's drafts. This survives process restart without introducing SQLite (the Phase-6 substrate gate per ADR-007 / ADR-010 explicitly applies to ConfigValue records, not to authoring scratchpad state).

### Path discipline

`create()` refuses target_paths that:

- start with `/` or contain `..` (path traversal)
- don't match the declared `type` (a `JURISDICTION` draft must end with `config/jurisdiction.yaml`; a `PROGRAM` draft must contain `/programs/`)

Test coverage: `tests/test_authoring_substrate.py::TestDraftStoreLifecycle::test_target_path_*`.

### Concurrent drafts on the same target

v3.1 ships **last-writer-by-`created_at` wins**: if two drafts target the same `target_path` and both are approved, both get committed in `created_at` order; the later one's content ends up on disk. Both are marked `COMMITTED`. **No conflict warning is raised in v3.1** — this is acceptable at the demo bar (one operator authoring at a time) but is a known v3.2 hardening item.

### Auth + RBAC

The substrate accepts whatever `author` / `approver` / `committer` strings the caller sends. There is no enforced separation between author and approver, and no role check. **v3.1 is single-operator demo bar**; v3.2 should add proper RBAC and a "approver != author" gate.

## Consequences

**Positive**:

- The "in-app adoption" promise of v3.1 has concrete API surface. UI wizards (Onboard, authority-chain editor, legal-docs editor, demo-cases editor) can build on this substrate without re-inventing the lifecycle.
- The substrate is generic enough that future record types (e.g. `DraftType.SHAPE_EVALUATOR` for in-app shape catalog edits if the v4 charter wants it) can extend it without refactoring.
- Operators who don't want to wait for the UI can use `curl` against `/api/authoring/*` today; the v3.1 walkthrough doc (L14) covers this path.
- Drafts persist across restart, so a wizard partway through onboarding can pick up after a redeploy.

**Negative / accepted**:

- No structural-aware YAML emission. `yaml.safe_dump` is fine for v3.1 because none of the seven existing manifests use the `{include: formulas/oas-amount.yaml}` marker syntax for the *demo cases* / *authority chain* / *legal documents* sections — only the rule parameters do, and rule parameter edits flow through ConfigValue admin which already preserves them. If a future authoring flow touches a manifest that uses includes elsewhere, the emitter swap to the existing `yaml_emitter.py` machinery would be straightforward.
- No conflict resolution on same-path drafts. Documented as v3.2 hardening.
- No author/approver role separation. Documented as v3.2 hardening.

**Neutral**:

- The L4 `_COMPARE_MANIFEST_CACHE` (`api.py:1854`) is busted on every successful commit. The cache only holds 7 entries per program, so the cost of a full rebuild is negligible.

## Alternatives considered

1. **Re-use `ConfigStore` for jurisdiction and program drafts.** Rejected. `ConfigStore` is keyed by `(key, jurisdiction_id, effective_from)` and assumes scalar values with a dated history. Jurisdictions + program manifests are whole-file YAML documents without effective-from semantics. Forcing them through ConfigStore's shape would deform both APIs.

2. **One draft per section of a manifest** (authority chain, legal documents, demo cases each as their own `DraftType`). Rejected for v3.1: adds complexity without earning the cognitive load. A program editor that updates only the authority chain just produces a new full-manifest draft with the rest of the content preserved. The UI lanes can present a section-specific form without changing the substrate shape.

3. **Commit to a git branch instead of disk.** Rejected as v3.1 scope creep. Git-friendly diffs are a great future direction (operator wants version control beyond local sandbox) but require git CLI access in the container and complicate the HF-deployment story. The walkthrough doc (L14) notes this as a v4 candidate.

4. **In-DB drafts with SQLite.** Rejected. The Phase-6 substrate gate (ADR-007 / ADR-010) applies to ConfigValue records that need durable history. Authoring scratchpad state is more ephemeral — a few-hour or few-day work-in-progress — and file-per-draft is more transparent to a curious operator inspecting `lawcode/.drafts/`.

## Implementation notes

- `src/govops/authoring.py` (~280 lines) houses the `Draft` dataclass, `DraftType` / `DraftStatus` enums, `AuthoringError`, and `DraftStore`. Mirrors the layering in `src/govops/config.py`.
- `src/govops/api.py` adds the 7 `/api/authoring/*` endpoints. The module-level singleton `draft_store = DraftStore(_LAWCODE_ROOT)` is created at import time the same way `config_store` and `encoding_store` are.
- `tests/test_authoring_substrate.py` (23 tests) covers lifecycle, target-path discipline, persistence-across-restart, HTTP wiring, and the end-to-end ADR-022 promise: a brand-new jurisdiction draft + program draft -> approve -> commit -> the L3 loader picks it up.
- The HTTP test fixture monkeypatches both `draft_store` and `_LAWCODE_ROOT` to `tmp_path`, then snapshots + restores `JURISDICTION_REGISTRY` on teardown. Without the snapshot/restore, `reload_registry()` against the test sandbox wipes the 7 real jurisdictions from the global dict and downstream tests fail.

## Related

- ADR-013 — ConfigValue draft / approve / commit substrate (the v2 pattern this ADR generalizes for v3.1).
- ADR-014 — Program-as-primitive manifest model (defines the YAML shape `DraftType.PROGRAM` drafts target).
- ADR-019 — Jurisdiction metadata block (defines the YAML shape `DraftType.JURISDICTION` drafts target).
- ADR-020 — Lawcode-as-discovery loader (the read path the commit triggers a reload of).

## Deferred to v3.1.x / v3.2

- L8-L12 UI wizards on top of this substrate (Onboard, authority-chain, legal-docs, demo-cases, program creator).
- Per-path conflict refusal when two drafts target the same `target_path`.
- Author / approver role separation + RBAC.
- Structural-aware YAML emission preserving comments + ordering on the canonical files.
- Git-commit-diff projection for operators who want PR-style review beyond local sandbox.
