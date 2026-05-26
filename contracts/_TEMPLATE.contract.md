---
# REQUIRED. Kebab-case slug. Becomes the contract identity. MUST match the filename
# (minus `.contract.md`). Used in cross-references and dispatch prompts
# ("Read contracts/<name>.contract.md and execute.").
name: example-contract-slug

# REQUIRED. One paragraph (1-3 sentences). The "what + why" in a single block.
# Reviewers + dispatched agents read THIS first; it should be self-contained
# enough that someone with no prior context understands what the contract does.
description: One paragraph stating what this contract delivers and why it's worth dispatching now.

metadata:
  type: contract            # REQUIRED. Always literally "contract".
  layer: <layer>            # REQUIRED. Functional layer this contract touches.
                            # Examples: hooks, ci, schema, deploy, docs, infra.
                            # Pick the most specific term that fits.
  wave: <wave>              # REQUIRED. Wave / plan identifier this contract is part of.
  instance: <instance>      # REQUIRED. Position within the wave (e.g., 2.1, 2.2).
  stage: 3                  # REQUIRED. Maturity stage. Contracts default to 3
                            # (durable rules + facts).
---

# Contract: <name>

One opening paragraph that frames the dispatch. Re-state the wave/instance, the
problem the contract closes, and what makes this the right moment to dispatch.
Should read naturally even after the rest of the contract is skimmed.

## Pre-flight (PO action; not part of the dispatch)

OPTIONAL. Only include if a human must take an action (resource provisioning,
secret rotation, manual setup) BEFORE the dispatch fires. List actions as a
numbered checklist. Skip this section entirely if no human action is needed.

1. **<Action>** -- one-sentence rationale. Verifiable outcome.
2. **<Action>** -- one-sentence rationale.

## Scope

REQUIRED. Numbered list of atomic deliverables for the dispatched session.
Each item describes ONE concrete artifact (file, directory, PR, configuration
change). Prefer bullet sub-lists over paragraphs. The dispatched agent uses
this list as the de-facto todo list.

1. **`<path/to/artifact>`** -- one-line role description:
   - Sub-bullet (specific requirement)
   - Sub-bullet (specific requirement)
2. **<Higher-level deliverable>** -- one-line role description:
   - Sub-bullet
   - Sub-bullet

## Out-of-scope

REQUIRED. Bulleted list of items reviewers might expect to see but which are
deliberately deferred. Each item carries a one-clause rationale (e.g.,
"future enhancement", "depends on X landing first", "separate dispatch").
Without this section, scope drift is the default failure mode.

- **<Item>** -- why deferred.
- **<Item>** -- why deferred.

## Invariants

REQUIRED. Bulleted list of MUST conditions the dispatched session must respect
throughout the work. These are invariants, not acceptance gates -- they
constrain HOW the work is done. Always include the worktree path invariant if
the dispatch uses git worktrees:

- **<Behavioral invariant>** (e.g., "Backward compatible", "Observe-only mode",
  "No production-config drift").
- **<Scope invariant>** (e.g., "Read-only on existing files beyond the
  `<dir>/` addition").
- Worktree at `<workspace>/.claude/worktrees/<contract-slug>-<YYYY-MM-DD>/`.

## Acceptance gates (PR body must cite each)

REQUIRED. Table with Gate | Spec | Status columns. Each gate is something the
PR body cites with concrete evidence (command output, artifact link, file diff,
URL). The Status column starts as `---` and the dispatched agent fills it as
PASS / FAIL / N/A in the final PR. Format:

| Gate | Spec | Status |
|---|---|---|
| <Gate name> | <Evidence type cited in PR body> | --- |
| <Gate name> | <Evidence type cited in PR body> | --- |

## Estimated time + cost

REQUIRED. Bullets covering session duration, code size, and dollar cost.
Helps reviewers size the dispatch + decide if it needs splitting.

- One agent session, ~<X-Y> min
- ~<N> LOC of <files>
- $<cost> (free / paid / cloud-spend estimate)

## Cross-references

REQUIRED. Bulleted list of related artifacts (other contracts, docs, ADRs).
Cross-references answer: "what other artifacts does this contract depend on
or relate to?"

- `<repo>/<path>` -- one-line role description
- `<repo>/<path>` -- one-line role description
