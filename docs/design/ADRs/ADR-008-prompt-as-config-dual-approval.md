# ADR-008 — Prompt-as-config dual approval

**Status**: Accepted
**Date**: 2026-04-26
**Gate**: 4 (locked at start of Phase 4 per [PLAN.md §3](../../../PLAN.md))
**Context**: Phase 4 promotes LLM prompts to dated `ConfigValue` records (`value_type=prompt`). A bad prompt change has wider blast radius than a single rule parameter — a prompt regression silently degrades extraction across **all jurisdictions** at once, while a rule parameter only affects one specific evaluation step. This ADR locks the approval policy.

---

## Decision

**Prompt ConfigValue records require two approvers** before the substrate accepts them as `status=approved`:

1. **Domain expert** — someone who has reviewed the linguistic / legal content of the prompt. Knows what the LLM should produce and can read the rationale for the change.
2. **Maintainer** — someone with commit access who has reviewed the technical shape (formatting, variables, downstream effects).

The two approvals must come from **distinct identities**. Self-approval (one person playing both roles) is not allowed.

`ConfigValue` for prompts gains an additional `co_approved_by: Optional[str]` field (Phase 6 admin UI work). Until that field lands, dual approval is enforced **procedurally**: every PR that touches `lawcode/global/prompts.yaml` requires two GitHub review approvals, with at least one explicitly identified as the domain-expert reviewer in the PR description.

---

## Rationale

| Criterion | Single approval (rejected) | Dual approval (chosen) |
| --- | --- | --- |
| Blast radius if a bad prompt ships | Wide — every encoder run worse | Caught by the second pair of eyes |
| Cognitive load on reviewer | Lower | Slightly higher; offset by the fact prompts change rarely |
| Cost of the safeguard | None | One extra reviewer per prompt change |
| Aligns with the "humans decide" thesis | Partially | Explicitly: "two humans decide" |
| Prevents one rogue actor | No | Yes |

A prompt is the most powerful single artefact in GovOps after the engine logic itself. The encoder pipeline turns prompts into rules; rules into recommendations; recommendations into officer-facing decisions. A prompt amendment that subtly shifts extraction priorities — say, drops the "every testable condition" instruction — would silently hide rules from new statutes for years. The cost of one extra reviewer per change is trivial against that risk.

## What this is *not*

- This is **not** consensus or majority approval — two distinct sign-offs is enough.
- This is **not** an n-of-m scheme. Specifically two: domain expert + maintainer. Adding more approvers is welcome but doesn't substitute for the role split.
- This is **not** technical access control. Maintainers can technically commit a prompt without dual approval — the ADR is policy, enforced by PR review and (Phase 6) by the admin UI.

## Implementation phases

| Phase | Mechanism |
| --- | --- |
| Phase 4 (this ADR) | Procedural: PR description must name the domain-expert reviewer; reviewers + maintainers + branch protection enforce the rest |
| Phase 6 | `ConfigValue.co_approved_by` field added; admin UI's "Approve" CTA on prompt drafts is disabled until both approvers have signed |
| Post-Phase-10 (optional) | Cryptographic signing of prompt manifests when federation lands ([ADR-009](ADR-009-federation-trust-model.md), still pending Gate 7) |

## Consequences

- `lawcode/global/prompts.yaml` carries `author` and `approved_by` per record; PR review supplies the second approver until the admin UI lands.
- Encoder records the prompt key + resolved record id per batch (Phase 4 work) so the audit trail tells you *exactly* which prompt produced each batch's proposals — a precondition for the reproducibility test.
- Re-running an extraction with a pinned prompt id produces deterministic input to the LLM (the LLM itself may not be deterministic, but the prompt is — the test harness may use a fake LLM).
- New ConfigValues with `value_type=prompt` and `status=approved` should be flagged by review tooling for human attention; a future CI check could ensure the PR description names two approvers.

## Out of scope

- The fake-LLM harness for reproducibility testing (Phase 4 work, not this ADR).
- Per-jurisdiction prompt overrides — globally-scoped prompts only for v2.0 (revisit when a jurisdiction needs different extraction style).
- Prompt versioning UI features (drag-drop, A/B test) — Phase 6 admin UI design.
