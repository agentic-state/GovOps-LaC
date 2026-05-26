# Contracts

This directory holds **dispatch contracts** -- single-file Markdown documents
that declare scope, invariants, and acceptance gates for one atomic unit of
work. Each contract is self-contained enough that a fresh agent session (or a
new contributor) can read it cold and execute the work it scopes.

## What a contract is

A contract lives at `contracts/<slug>.contract.md` and follows a typed shape:

- **Frontmatter** declares identity (`name`, `description`, `type`, `layer`,
  `wave`, `instance`, `stage`).
- **Opening paragraph** frames the work + why now.
- **Pre-flight** (optional) lists actions a human must complete before
  execution starts.
- **Scope** enumerates atomic deliverables as a numbered list.
- **Out-of-scope** lists deliberate deferrals with one-clause rationale (the
  defense against scope drift).
- **Invariants** lists MUST conditions over the work itself (not acceptance
  gates -- these are constraints the agent maintains throughout).
- **Acceptance gates** is a table the PR body must cite gate-by-gate with
  concrete evidence (command output, artifact link, diff, URL).
- **Estimated time + cost** lets the reviewer size the work.
- **Cross-references** lists related artifacts.

## How to use the template

Start a new contract by copying [`_TEMPLATE.contract.md`](_TEMPLATE.contract.md)
to `<your-slug>.contract.md` and filling each section. The template has inline
comments explaining each section's purpose; remove the comments as you fill the
sections.

The frontmatter is machine-readable. The supplied template parses cleanly as
YAML. If you add fields, keep them in `metadata:` and document their meaning.

## When to write a contract

Write a contract when the work is non-trivial (more than a 30-minute edit,
multiple files, cross-cutting changes, new test coverage) AND has typed
acceptance (specific gates the PR must clear). Skip contracts for one-shot
edits, dep bumps, typos, or exploratory research.

The rule of thumb: if a future you (or a different contributor) opening a
fresh session would benefit from a typed scope + acceptance the PR can be
checked against, write a contract.

## Provenance

This contract pattern + template originated in a sibling project that has
been using it for 30+ atomic dispatches. The template is portable -- the same
shape works for CI wiring, schema design, deployment work, and documentation
sprints. Filename + section conventions are stable.
