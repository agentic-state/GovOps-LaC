# Runbook: Drafting and landing an ADR

## When to use

When making a load-bearing architectural decision — something that shapes what gets built and what does not. Examples from the existing record:

- Choosing a data format (ADR-003: YAML over JSON)
- Designing a substrate model (ADR-006: per-parameter granularity)
- Picking a security/trust posture (ADR-009: federation Ed25519 + allowlist)
- Choosing a refactor scope and migration strategy (ADR-016: OASEngine → ProgramEngine)
- API shape decisions with backward-compat implications (ADR-018: cross-program evaluation)

If the decision can be reversed by editing one file in one PR with no migration path, it's not ADR-worthy. Capture it in a code comment instead. ADRs document the decisions that have **consequences** if you ever change them.

## Pre-flight

Three checks before you write a word:

| Check | Command | Why |
|---|---|---|
| Next available ADR number | `ls docs/design/ADRs/ADR-*.md | tail -1` | Avoid collisions with peers (see [Common gotchas → ADR number races](#common-gotchas)) |
| Open PRs that may also be claiming a number | `gh pr list --search "ADR" --state open` | Required check per [`feedback_adr_number_pre_claim_check`](../../../eva-foundation/.claude-memory/feedback_adr_number_pre_claim_check.md) |
| Recent commits on origin/main that landed an ADR | `git log origin/main --oneline -- 'docs/design/ADRs/ADR-*.md' | head -5` | Catch numbers claimed in the last hour that haven't propagated to your local branch yet |

If your number is already claimed, take the next one. **Never two ADRs with the same number.**

## Steps

### Step 1 — Decide the number and filename

Format: `ADR-NNN-short-kebab-title.md`

- Number: zero-padded to 3 digits (`001`, `017`, `099`)
- Title: short, kebab-case, captures the decision verb-form (`-program-as-primitive`, not `-program-decision`)

Example: `ADR-019-replace-cookie-locale-with-url-prefix.md`

### Step 2 — Write the ADR using the canonical structure

Every ADR has these sections, in this order:

```markdown
# ADR-NNN — <Title>

**Status**: Proposed | Accepted | Deprecated | Superseded
**Date**: YYYY-MM-DD
**Track / Gate**: <project track + plan gate, e.g. "GovOps v3.0 — Phase E. Locks v3 Decision Gate 5">

## Context

What is the issue? What forces are at play? What constraints exist? What did
prior ADRs leave open? Cite memory, plans, or external references that bear
on the decision.

This section should make the decision feel inevitable to a future reader who
arrives without the conversation context.

## Decision

What did we decide? State it crisply — single sentence first, then the
mechanism / contract / shape. Include code samples / API shapes / SQL
diagrams as needed; ADRs are not allergic to concreteness.

If the decision has sub-decisions, number them (1., 2., 3.) and address
each.

## Consequences

What follows from the decision? Both directions:

- **Positive**: what becomes easier; what bug class is closed.
- **Negative**: what becomes harder; what we're now committed to.
- **Mitigations**: how the negatives are bounded.

This section is what protects future-you from undoing the decision lightly.

## Alternatives Considered

What else was on the table? For each: brief description, why it lost. Be
honest — sometimes alternatives lose for legitimate reasons that may
re-emerge as constraints change.
```

The **Track / Gate** line is load-bearing — it ties the ADR to the operational plan that calls for it. ADRs without a track are orphan decisions and tend to regress.

### Step 3 — Update the ADR index

Append a row to `docs/design/ADRs/README.md` in the same PR:

```markdown
| 019 | [Replace cookie locale with URL prefix](ADR-019-replace-cookie-locale-with-url-prefix.md) | Proposed | v3.1 / Gate 1 |
```

Status starts at `Proposed`. Flip to `Accepted` in a follow-up commit when the decision is locked. Don't mix proposing and accepting in the same PR — keep them separable so peers can review the proposal independent of the lock-in.

### Step 4 — Cross-link from code

If the ADR governs a specific code path, add a comment at the relevant entry point:

```python
# Per ADR-019, the locale source is the URL prefix, not the govops-locale
# cookie. The cookie path is retained for backward-compat but is read AFTER
# the URL.
```

This is what keeps ADRs alive — code that references its ADR survives refactors with the rationale attached.

### Step 5 — Open a PR

```bash
git checkout -b feat/adr-019-url-prefix-locale
git add docs/design/ADRs/ADR-019-*.md docs/design/ADRs/README.md
git commit -m "docs(adr-019): propose replacing cookie locale with URL prefix"
git push -u origin feat/adr-019-url-prefix-locale
gh pr create --fill
```

PR title pattern: `docs(adr-NNN): <verb> <decision summary>`. ASCII-only per [`feedback_pr_quality_gate_conventions`](../../../eva-foundation/.claude-memory/feedback_pr_quality_gate_conventions.md).

### Step 6 — Iterate or land

In review:
- If reviewers push back on the decision: keep status `Proposed`, iterate the Decision and Alternatives sections, repush.
- If reviewers approve: flip status to `Accepted` in a follow-up commit on the same branch, repush, merge.
- If the decision is rejected: do NOT delete the file. Land it as `Status: Deprecated` with a one-line note explaining what was decided instead. Rejected ADRs are still load-bearing — they document what the project is NOT doing and why.

### Step 7 — Implement under the ADR's authority

Subsequent commits that implement the decision should reference the ADR in the commit message:

```
feat(locale)(adr-019): switch /screen/$jur loader to URL-prefix locale
```

Future grep queries (`git log --grep "adr-019"`) reconstruct the implementation timeline of the decision.

## Post-checks

The ADR is properly landed when:

- [ ] File at `docs/design/ADRs/ADR-NNN-<kebab-title>.md` exists
- [ ] Index row added to `docs/design/ADRs/README.md`
- [ ] Status reflects current state (Proposed during review, Accepted when locked)
- [ ] Code that implements the decision references the ADR in comments and commit messages
- [ ] If the ADR supersedes an earlier ADR, the earlier ADR's Status header has been updated to `Superseded by ADR-NNN`

## Rollback

If an Accepted ADR turns out to be wrong:

- **Don't delete.** Mark it `Deprecated` (general retreat) or `Superseded` (specific replacement). Add a `Superseded by ADR-MMM` line to the status header. Update the index.
- The new ADR's Context section should explain what changed about the world that made the original decision wrong. This is the most-read kind of ADR by future readers — "why did they reverse course on X?"

## Common gotchas

- **ADR number races.** Two contributors drafting ADRs simultaneously can both claim ADR-019. The pre-flight grep + `gh pr list` check prevents this. If a race happens anyway: whoever lands first keeps the number; the other re-numbers in their branch before merge. See [`feedback_adr_number_pre_claim_check`](../../../eva-foundation/.claude-memory/feedback_adr_number_pre_claim_check.md).

- **Skipping the Alternatives section because "it was obvious."** Future readers don't have your context. The 30 seconds to write "we considered X but it lost because Y" are worth hours of rework when X re-emerges as someone else's "obvious" idea.

- **Mixing decision and implementation in one PR.** ADRs land first, implementation follows. Reviewing a 2000-line implementation diff doesn't give the decision the airtime it needs. Keep them separable.

- **Drift between ADR and code.** When the implementation changes, the ADR stays. If the decision behind the implementation has actually changed, that's a new ADR (or a Deprecated marker on the old one), not a stealth edit of the original ADR's Decision section. ADRs are append-only documents about the past; they don't get rewritten.

- **No Track / Gate.** ADRs without a track tend to be unrooted decisions that nobody owns. If the decision doesn't tie to a plan or a user need, it's likely premature.

## Last validated

- **2026-05-02** by Claude — runbook captures the conventions visible across ADR-001 through ADR-018 in `docs/design/ADRs/`. Pattern proven by the v3 phase A-I sequence: each phase landed an ADR before the implementation PR, and the implementation cross-referenced the ADR throughout.
