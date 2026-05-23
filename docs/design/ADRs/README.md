# Architecture Decision Records (ADRs)

Decisions captured here are load-bearing — they shape what gets built and what does not. The format is intentionally light: context, decision, consequences, alternatives. New ADRs get the next sequential number; superseded ADRs stay in place with a `Superseded by ADR-NNN` (or `Superseded by reality`) line in the status header.

Active track: **Substrate-Hardening v3.2** (shipped 2026-05-13 — see [CHANGELOG.md](../../../CHANGELOG.md)). Prior tracks: **Program-as-Primitive v3.0** (charter at [`docs/IDEA-GovOps-v3.0-ProgramAsPrimitive.md`](../../IDEA-GovOps-v3.0-ProgramAsPrimitive.md), shipped 2026-05-10) and **Law-as-Code v2.0** (shipped 2026-04-29). Per-release scope is in [CHANGELOG.md](../../../CHANGELOG.md).

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
| 009 | [Federation trust model: signed lawcode packs with Ed25519 + publisher allowlist](ADR-009-federation-trust-model.md) | Accepted | v2.0 / Gate 7 |
| 010 | [SQLite-backed ConfigStore from Phase 6](ADR-010-sqlite-from-phase-6.md) | Accepted | v2.0 / Gate 3 (revised) |
| 011 | [Calculation rules as typed AST in YAML](ADR-011-calculation-rules-as-typed-ast.md) | Accepted | v2.0 / Phase 10B |
| 012 | [Notice rendering: derived artefact, template-as-ConfigValue](ADR-012-notice-rendering.md) | Accepted | v2.0 / Phase 10C |
| 013 | [Event-driven reassessment with supersession chain](ADR-013-event-driven-reassessment.md) | Accepted | v2.0 / Phase 10D |
| 014 | [Program-as-Primitive (manifest model)](ADR-014-program-as-primitive.md) | Accepted | v3.0 / Gate 1 |
| 015 | [Canonical Program Shape Library](ADR-015-program-shape-library.md) | Accepted | v3.0 / Gate 2 |
| 016 | [Engine refactor scope: OASEngine → ProgramEngine](ADR-016-engine-refactor-scope.md) | Accepted | v3.0 / Gate 3 |
| 017 | [Bounded-benefit rule primitives](ADR-017-bounded-benefit-rule-primitives.md) | Accepted | v3.0 / Gate 4 |
| 018 | [Cross-Program Evaluation API](ADR-018-cross-program-evaluation-api.md) | Accepted | v3.0 / Gate 5 |
| 019 | [Lawcode jurisdiction-metadata block](ADR-019-lawcode-jurisdiction-metadata.md) | Accepted | v3.1 / Lane 1 |
| 020 | [Lawcode-as-discovery (registry retired from Python)](ADR-020-lawcode-as-discovery.md) | Accepted | v3.1 / Lane 3 |
| 021 | [Citation impact groups by country, not by program-scoped jurisdiction_id](ADR-021-citation-impact-by-country.md) | Accepted | v3.1 / L5 |
| 022 | [Authoring substrate for non-ConfigValue records](ADR-022-authoring-substrate.md) | Accepted | v3.1 / L7 |
| 023 | [Substrate conflict refusal on same target_path](ADR-023-substrate-conflict-refusal.md) | Accepted | v3.2 / L2 |
| 024 | _(deliberately gap — see CHANGELOG v3.2.0 §Known Issues)_ | — | — |
| 025 | [Structural-aware YAML emission for commit_approved](ADR-025-structural-yaml-emission.md) | Accepted | v3.2 / L3 |

## Contributing ADRs

When proposing a significant architectural decision:

1. Use the next sequential number (`ADR-NNN`)
2. Filename pattern: `ADR-NNN-short-kebab-title.md`
3. Status starts at `Proposed`; flip to `Accepted` when the decision is locked
4. Cross-link to the release-readiness gate or runbook it satisfies (if any)
5. Add a row to the Index above in the same PR

Significant decisions include: technology stack choices, data model design, integration patterns, security/privacy approaches, performance strategies, testing frameworks, governance policies.
