# GovOps v3.2 -- Substrate Hardening

**Status**: Charter, draft 2026-05-12. Not yet planned.
**Predecessor**: v3.1.x editor set (PRs #50/#51/#52/#53 on `main`, all merged 2026-05-11/12). v3.1.0 release tagged 2026-05-11.
**One-sentence pitch**: *The authoring substrate works end-to-end through the UI; v3.2 makes it safe enough that two operators can use it at the same time without stepping on each other.*

> This document is the strategic vision for v3.2. It does not constrain implementation. PLAN-v3.2.md will track execution once it begins.

---

## Disclaimer

GovOps is an independent open-source prototype. It is **not affiliated with, endorsed by, or representing any government, department, or public agency**. Legislative text is publicly available law interpreted by the author for illustrative purposes -- not authoritative operational guidance.

## Why v3.2 exists

v3.1 + v3.1.x landed the lanes that closed v3.0's "adoption is a hand-edit Python PR" debt:

- ADR-020 lawcode-as-discovery: `JURISDICTION_REGISTRY` is built at startup from `lawcode/`; no Python literal authority left
- ADR-022 authoring substrate: jurisdictions and program manifests are draftable, approvable, committable through the same pattern ConfigValue admin uses
- L8 onboard wizard + L12 program scaffolder: a new jurisdiction can be authored through the UI from empty state
- L9 + L10 + L11 structured editors: a pending program draft's `authority_chain[]`, `legal_documents[]`, and `demo_cases[]` can be edited in-place through dedicated forms

What v3.1.x explicitly deferred:

- **Browser end-to-end coverage of the editor flow**. The pytest substrate coverage + vitest helper coverage pin every piece of logic that doesn't race the live `JURISDICTION_REGISTRY` dict; the missing piece is a Playwright spec that walks `/admin/onboard` -> approval -> commit -> editor edits -> re-commit. Tried in v3.1.0 L14 (`adoption.spec.ts`), dropped because the in-process `reload_registry()` mutates global state mid-test and concurrent browser reads see partial state.
- **Substrate safety under concurrent authoring**. Today the substrate accepts two drafts targeting the same `lawcode/<code>/programs/<id>.yaml` file; on commit, last-writer-by-`created_at` wins silently. Acceptable at the demo bar; not acceptable the moment two operators try.
- **Author vs approver role separation**. Today the same operator can create, approve, and commit a draft. ConfigValue admin's mature pattern requires distinct identities; the substrate should match.
- **Structural-aware YAML emission**. Today `commit_approved()` writes `yaml.safe_dump(draft.content)`. This loses comments and reorders keys against the human-authored canonical files. For a public-facing showcase the diff between authored and projected YAML should be minimal.
- **Git-projection of commits**. Today the substrate writes in-place to `lawcode/<code>/...`; on HF Space the writes are ephemeral until the operator manually tags. A "commit projection" mode that produces a git diff branch (without auto-pushing) would let an operator review and submit a PR from the substrate's output, restoring the source-control story even on ephemeral disks.

These are five separate problems but they share one root: the substrate was built for the demo bar (one operator, in-process, no contention). v3.2 takes it to the **safe-for-two** bar without scope creep into auth platforms or distributed coordination.

## The bet: substrate that survives two operators

v3.1.x proved the authoring loop works. v3.2 proves it stays sound under contention. The three constraints:

- A second operator opening the same draft sees what the first operator just saved
- A commit that races against another commit refuses cleanly instead of silently overwriting
- A commit projects a git diff the operator can review before it touches the canonical files

This is the **"two-operator floor"**. Below it, the substrate is a single-operator scratchpad; at it, the substrate is a small-team authoring tool. v3.2 stops there because the next bar (federation, RBAC platforms, distributed coordination) is a v5-class problem, not v3-class.

## Lanes

### Lane 1 -- Browser E2E with worker-scoped lawcode roots (carry from v3.1.x)

Today every Playwright worker shares one `LAWCODE_ROOT` because the registry is process-global. v3.2 makes the substrate parametric on a per-worker root, so each Playwright worker authors against its own sandboxed `lawcode/` tree. The `JURISDICTION_REGISTRY` becomes either:
- per-request from a context store (preferred), or
- per-process where each Playwright worker spawns its own backend

Whichever path lands, the L14 `adoption.spec.ts` (drafted in v3.1.0, deferred) gets the worker-scoped root + a full walk: wizard -> approval -> commit -> editor -> re-commit -> verify `/api/authority-chain?jurisdiction_id=xx` returns the new chain.

This is also where the visual regression gate (LO-011, deferred 2026-05-10) can be re-attempted, since the settle-helper hydration race is in the same neighbourhood.

### Lane 2 -- ADR-022 conflict refusal

Two drafts targeting the same `target_path` is currently silently allowed; on commit, last-writer wins. v3.2 refuses the second `create` (or warns on the second) and requires explicit handling: approve one, reject the other, or merge through the structural editor pre-approval.

Implementation: track active `target_path` in `DraftStore`; on `create()`, raise `AuthoringError` if a PENDING or APPROVED draft already targets that path. v3.2 ships the strict refusal; a future v3.3 can add a "merge into existing draft" affordance.

### Lane 3 -- Author/approver role separation + thin RBAC

ConfigValue admin enforces "approver != author" (the approve endpoint refuses if `approver == draft.author`). The L7 substrate does not. v3.2 fixes the asymmetry.

Thin RBAC = a small actor allowlist (`config_authors`, `lawcode_authors`, `lawcode_approvers`) loaded from `lawcode/.actors.yaml` (a new authored file, draftable through the same substrate -- so the RBAC system is itself an opt-in lawcode component, not infrastructure).

### Lane 4 -- Structural-aware YAML emission

`commit_approved()` today calls `yaml.safe_dump(draft.content, sort_keys=False, allow_unicode=True)`. This works but produces noisy diffs against the canonical files (lost block scalars, lost comments, no spacing discipline). v3.2 uses `ruamel.yaml` round-trip mode so the projected file resembles the human-authored shape.

The bar: a no-op commit (load -> commit unchanged) should produce a zero-byte diff. Currently it produces hundreds of lines of reformat noise.

### Lane 5 -- Git-projection mode for ephemeral hosts

Today `commit_approved()` writes directly to `lawcode/<code>/...`. v3.2 adds an opt-in mode:

```
POST /api/authoring/commit?mode=git-projection
```

Instead of in-place write, the substrate creates a local branch (`authoring/<draft-id>-<timestamp>`), writes the projected YAML to that branch, commits with the draft's rationale as the commit message, and returns the diff as the response body. The operator can review the diff, then opt to:
- `mode=apply` -- merge the branch back into the working tree (the v3.1.x behaviour)
- `mode=submit` -- push the branch to `origin` and open a PR via `gh` (requires gh auth)
- `mode=discard` -- delete the branch

On HF (ephemeral disk), `mode=git-projection` + `mode=submit` lets an operator author through the substrate, review the diff, and land the change in the canonical repo without any hand-edit step. This restores the source-control story v3.0 promised but couldn't actually deliver on the hosted demo.

### Lane 6 -- Lint baseline cleanup

`main` carries ~982 prettier errors as of 2026-05-12 (none introduced by today's PRs, but the baseline is dirty). v3.2 ships one mechanical `prettier --write` pass over `web/` plus a CI lint gate so future PRs cannot regrow the count. Not architectural; just hygiene.

## Audiences and surfaces

v3.2 does not introduce a new audience or a new surface. Every surface that v3.1 + v3.1.x ships continues to work; the changes are internal:

| Audience | v3.1 today | v3.2 delta |
| --- | --- | --- |
| Citizen (`/check`) | Unchanged | Unchanged |
| Officer (`/cases`) | Unchanged | Unchanged |
| Program leader (`/compare`) | Unchanged | Unchanged |
| Authoring operator (`/admin/*`) | Single-operator-safe | Two-operator-safe (Lanes 2 + 3); diff-reviewable commits (Lanes 4 + 5) |
| Developer / contributor | Unchanged | E2E coverage gains the editor walk (Lane 1); lint gate restored (Lane 6) |

## Out of scope (deferred to v4 or later)

- **Federated identity** (operators across orgs) -- v5 axis per `p61_v4_charter_intent_2026-05-07`
- **Conflict-aware merge UI** -- v3.3 candidate, after v3.2's strict-refusal proves the model
- **Distributed coordination** (multiple backends sharing draft state) -- not a v3 problem; the demo bar is one process
- **Citizen authoring** (citizens submitting drafts) -- explicitly off v3.2 scope; the substrate stays operator-only

## Why v3.2, not v3.1.x?

The five lanes are not corrections to v3.1.x -- they are the next-bar-up. v3.1.x delivered everything v3.1.0 promised plus the editor set; the v3.2 work is "what changes when you actually try to use the substrate in a small team," which is a different question from "does the substrate work."

Tagging this as v3.2 keeps `v3.1` clean: it shipped what it scoped, and v3.1.x closed its backlog. v3.2 is the next release line, sized to land before v4 charters open so v4 inherits a substrate that's already safe-for-two.

## Estimate

Six lanes, none of them shape-breaking. Most of the implementation is mechanical; the design contracts (conflict semantics, RBAC actor model, projection-vs-apply flow) deserve their own ADRs:

- ADR-023: substrate conflict refusal (Lane 2)
- ADR-024: actor model + thin RBAC for authoring (Lane 3)
- ADR-025: round-trip YAML emission for projected lawcode (Lane 4)
- ADR-026: git-projection commit mode (Lane 5)

Lanes 1 and 6 don't need ADRs (mechanical / test-infra).

Bundled release pattern as v3.1 ran: one tag, ~6 PRs in sequence, ~1-2 weeks of focused work depending on bandwidth. Smaller than v3.1; bigger than a hotfix.

## Verification

End-to-end checks before declaring v3.2 done:

| Check | How | Pass criteria |
| --- | --- | --- |
| Adoption E2E green (the L14 spec from v3.1.0) | `cd web && npm run test:e2e -- adoption.spec.ts` | Cross-browser pass on Chromium / Firefox / WebKit |
| Concurrent-draft refusal | Two `POST /api/authoring/drafts` with same `target_path` | First 200; second 409 |
| Author/approver separation | Operator A approves their own draft | 409 with `approver must differ from author` |
| YAML round-trip clean | Load `lawcode/ca/programs/oas.yaml`, commit unchanged | `git diff` shows 0 lines changed |
| Git-projection mode | `POST /api/authoring/commit?mode=git-projection` | Returns a diff body; branch exists locally; canonical file untouched |
| Lint gate | `cd web && npm run lint` on `main` | Exit 0; CI fails on new violations |
| Full suite | `pytest -q` + `cd web && npm run test && npm run test:e2e` | All green |
| HF deploy | Push to `hf` remote | New v3.2 surfaces visible at `agentic-state-govops-lac.hf.space` |

## Memory hooks (post-merge)

- New entry: `p61_v3_2_release_<date>.md` -- bundled v3.2 release record
- Update `p61_open_followups.md` -- close all five carryover items (browser E2E, conflict refusal, RBAC, structural YAML, git projection)
- Update `p61_v4_charter_intent_2026-05-07.md` -- mark substrate-hardening assumption met
