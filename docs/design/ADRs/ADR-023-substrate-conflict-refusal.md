# ADR-023: Substrate conflict refusal on same target_path

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-12 |
| **Authors** | GovOps team |
| **Extends** | ADR-022 (authoring substrate) |
| **Lane** | v3.2 L2 |

## Context

ADR-022 shipped the authoring substrate in v3.1 L7 with a deliberate v3.2 deferral: "Concurrent drafts targeting the same path: the last-writer-by-`created_at` wins; earlier ones are committed first then overwritten. Explicit conflict handling is a v3.2 hardening item."

The deferral was honest at the v3.1 demo bar (one operator, in-process, no contention) but does not survive the moment two operators try. Two operators starting drafts against the same `lawcode/<code>/programs/<id>.yaml` would today both succeed `POST /api/authoring/drafts`, both `approve`, and `commit_approved()` would silently project both -- the later `created_at` wins on disk, the earlier one's content is gone with no audit trail beyond the substrate's own `COMMITTED` markers on both drafts. A correct overwrite is indistinguishable from a lost edit.

This is the headline lane of v3.2's "two-operator floor" framing (`docs/IDEA-GovOps-v3.2-SubstrateHardening.md`): below it, the substrate is a single-operator scratchpad; at it, the substrate is a small-team authoring tool.

## Decision

`DraftStore.create()` refuses any new draft whose `target_path` is already held by a PENDING or APPROVED draft. The refusal raises a new exception class `TargetPathConflict(AuthoringError)` carrying the id of the conflicting draft, so the HTTP layer can surface the exact draft the operator needs to deal with.

A draft "holds" its target path while in PENDING or APPROVED status. REJECTED and COMMITTED drafts have settled and release the hold:

- PENDING -- operator can still mutate the payload (PATCH); a second draft would race the edit
- APPROVED -- operator can no longer mutate; the draft is committed-bound and the path is reserved
- REJECTED -- explicitly closed; the path frees for a fresh attempt
- COMMITTED -- already on disk; future drafts represent a new edit cycle, not a conflict

The HTTP layer (`POST /api/authoring/drafts`) maps `TargetPathConflict` to HTTP `409 Conflict` with body:

```json
{
  "detail": {
    "error": "target_path already held by an open draft",
    "target_path": "pl/programs/oas.yaml",
    "conflicting_draft_id": "abc123def456"
  }
}
```

The UI's draft-creation surfaces (the Onboard wizard for jurisdiction drafts; the program-scaffold endpoint for program drafts; future treaty/notification-template editors per v4) handle 409 by routing the operator to the conflicting draft's edit view rather than silently failing or retrying.

## What this does NOT do

This ADR ships **strict refusal**, not merge. The substrate offers no affordance for "merge my changes into the existing draft" -- the operator's options on collision are:

1. Approve / reject / discard the conflicting draft, then re-create
2. PATCH the conflicting draft directly (L9-L11 editors already do this for the three program-manifest slices)

A "merge into existing draft" mode is a v3.3 candidate, deferred until the strict-refusal model has bedded in. Strict refusal is the conservative posture and is reversible (a merge mode is additive on top); the inverse would be a behaviour break.

## Consequences

### Positive

- **No silent overwrites**. Two operators cannot lose each other's work without an explicit step (approve / reject / discard) by one of them.
- **The UI gets actionable refusal.** The 409 body identifies the conflicting draft so the UI can deep-link the operator to it rather than swallow the error.
- **Backward-compatible to v3.1's API shape.** `POST /api/authoring/drafts` adds a 409 response code; the 200 path is unchanged. Existing UI handlers that only handle 200 / 400 see a new error class instead of a silent stomp -- a strictly better failure mode.

### Negative

- **Operators who genuinely want to start over must explicitly close the prior draft first.** This adds a step versus the v3.1 behaviour of "just create another one." Acceptable: the v3.1 behaviour was wrong and the new step is the correct mental model.
- **No merge tooling yet.** Two operators authoring overlapping changes still have to coordinate out-of-band on who keeps the draft. v3.3 follow-up.

### Mitigations

- **The L9-L11 in-place editors already cover most edit-an-existing-draft cases.** PATCH on a PENDING draft does not collide with the L2 refusal; the refusal only fires on `create()`. So the common workflow (open an existing draft, edit it, save) needs no operator change.
- **Approval auto-frees nothing.** Approving a draft pushes it from PENDING to APPROVED -- still holding the path. This is deliberate: the approval has committed-bound the path. If an operator approves the wrong thing, they reject the approval through the normal reject flow rather than racing a fresh create against an APPROVED draft.

## Verification

- New pytest coverage in `tests/test_authoring_substrate.py`:
  - `test_open_draft_holds_target_path_against_second_create` -- PENDING draft holds; second create raises `TargetPathConflict` with the right ids
  - `test_approved_draft_still_holds_target_path` -- APPROVED also holds
  - `test_rejected_draft_releases_target_path` -- rejecting frees the path
  - `test_discarded_draft_releases_target_path` -- discarding frees the path
  - `test_create_409_on_same_target_path` -- HTTP 409 with the right body shape

## Related

- ADR-022 -- the substrate this hardens
- ADR-024 (planned) -- author/approver role separation + thin RBAC (v3.2 L3)
- ADR-025 (planned) -- structural-aware YAML emission (v3.2 L4)
- ADR-026 (planned) -- git-projection commit mode (v3.2 L5)
- `docs/IDEA-GovOps-v3.2-SubstrateHardening.md` -- the v3.2 charter framing this lane
