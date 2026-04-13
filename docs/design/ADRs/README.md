# Architecture Decision Records (ADRs)

This directory contains architectural decisions for the GovOps project, following the ADR format.

## ADR Format

Each ADR follows this structure:
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: What is the issue we're trying to solve?
- **Decision**: What did we decide to do?
- **Consequences**: What are the implications (positive and negative)?
- **Alternatives Considered**: What other options did we evaluate?

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](ADR-001-agent-framework.md) | Agent Framework Selection | Proposed | 2026-03-13 |
| 002 | Policy Formalization DSL Design | Pending | TBD |
| 003 | Graph Database Selection | Pending | TBD |
| 004 | Legal Parser Architecture | Pending | TBD |
| 005 | Change Detection Strategy | Pending | TBD |

## Contributing ADRs

When proposing a significant architectural decision:

1. Copy the ADR template
2. Number it sequentially (ADR-###)
3. Fill in all sections
4. Submit PR for review
5. Update status after decision

Significant decisions include:
- Technology stack choices
- Data model design
- Integration patterns
- Security/privacy approaches
- Performance strategies
- Testing frameworks
