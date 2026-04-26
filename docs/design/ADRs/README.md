# Architecture Decision Records (ADRs)

Decisions captured here are load-bearing — they shape what gets built and what does not. The format is intentionally light: context, decision, consequences, alternatives. New ADRs get the next sequential number; superseded ADRs stay in place with a `Superseded by ADR-NNN` (or `Superseded by reality`) line in the status header.

Active track: **Law-as-Code v2.0** (see [PLAN.md](../../../PLAN.md)).

## ADR Format

Each ADR follows this structure:
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: ISO-8601
- **Context**: What is the issue?
- **Decision**: What did we decide?
- **Consequences**: What are the implications (positive, negative, mitigations)?
- **Alternatives Considered**: What other options did we evaluate?

## Index

| # | Title | Status | Track / Gate |
| --- | --- | --- | --- |
| 001 | [Agent Framework Selection](ADR-001-agent-framework.md) | Superseded by reality (2026-04-25) | v1.0 (never adopted) |
| 002 | [Phase 0 coupling audit of `seed.py` and `jurisdictions.py`](ADR-002-coupling-audit.md) | Accepted | v2.0 / — |
| 003 | [YAML over JSON for Law-as-Code artefacts](ADR-003-yaml-over-json.md) | Accepted | v2.0 / Gate 1 |
| 004 | [Backwards-compat strategy during ConfigValue migration](ADR-004-backcompat-during-migration.md) | Accepted | v2.0 / Gate 6 |
| 005 | [Lovable code repo location](ADR-005-lovable-repo-location.md) | Accepted | v2.0 / Gate 5 |
| 006 | [Per-parameter ConfigValue granularity](ADR-006-per-parameter-granularity.md) | Accepted | v2.0 / Gate 2 |
| 007 | [In-memory storage through Phase 10](ADR-007-in-memory-storage.md) | Accepted | v2.0 / Gate 3 |
| 008 | [Prompt-as-config dual approval](ADR-008-prompt-as-config-dual-approval.md) | Accepted | v2.0 / Gate 4 |
| 009 | Federation trust model | Pending Phase 7 | v2.0 / Gate 7 |
| 010 | [SQLite-backed ConfigStore from Phase 6](ADR-010-sqlite-from-phase-6.md) | Accepted | v2.0 / Gate 3 (revised) |

## Contributing ADRs

When proposing a significant architectural decision:

1. Use the next sequential number (`ADR-NNN`)
2. Filename pattern: `ADR-NNN-short-kebab-title.md`
3. Status starts at `Proposed`; flip to `Accepted` when the decision is locked
4. Cross-link to the PLAN gate it satisfies (if any)
5. Add a row to the Index above in the same PR

Significant decisions include: technology stack choices, data model design, integration patterns, security/privacy approaches, performance strategies, testing frameworks, governance policies.
