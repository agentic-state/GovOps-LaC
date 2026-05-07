# ADR-001: Agent Framework Selection

**Status**: Superseded by reality (2026-04-25) — never adopted  
**Date**: 2026-03-13  
**Participants**: Project Lead, AI Architecture Advisor

> **2026-04-25 superseding note**: This ADR was authored before the v1.0 working demo was built. The actual implementation does not depend on Microsoft Agent Framework or any agent-orchestration library. `pyproject.toml` shows the runtime stack: FastAPI + Pydantic + Jinja2 only. The encoder pipeline (`src/govops/encoder.py`) handles AI-assisted rule extraction with a pluggable backend, not a multi-agent framework. This ADR is preserved as historical context; the v2.0 Law-as-Code track ([PLAN.md](../../../PLAN.md)) does not introduce an agent framework either.

---

## Context

GovOps requires a **multi-agent orchestration system** to coordinate specialized agents (Legal Parser, Ontology Builder, Policy Formalization, Code Generator, Test Generator, Governance).

The framework must support:
- **Python** (target language for MVP)
- **Multi-agent workflows** (sequential, parallel, conditional routing)
- **State management** (track context across agent interactions)
- **Tool/function calling** (agents invoke external systems)
- **Observability** (tracing, debugging, monitoring)
- **Enterprise-grade** (production-ready, not experimental)
- **Open source** (Apache 2.0 or MIT compatible)

---

## Decision

**Use Microsoft Agent Framework** for multi-agent orchestration.

### Rationale

1. **Native Multi-Agent Support**: Built for agent workflows (not general-purpose chatbot library)
2. **State Management**: Thread-based state with checkpointing for long-running processes
3. **Observability**: Integrated tracing for debugging agent interactions
4. **Flexible Orchestration**: Supports sequential, concurrent, dynamic routing patterns
5. **Human-in-the-Loop**: Native support for approval gates (critical for legal validation)
6. **Open Source**: Community-maintained, vendor-neutral
7. **Cross-Platform**: Python and .NET (future polyglot option)
8. **Proven**: Used in production Azure AI applications
9. **Framework Familiarity**: Team has prior experience with this framework

### Architecture Fit

```
┌─────────────────────────────────────────────────────────┐
│         Microsoft Agent Framework (Python)              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Legal Parser │→ │  Ontology    │→ │   Policy     │ │
│  │    Agent     │  │   Builder    │  │Formalization │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         ↓                                      ↓        │
│  ┌──────────────┐                     ┌──────────────┐ │
│  │   System     │                     │     Code     │ │
│  │  Architect   │                     │  Generator   │ │
│  └──────────────┘                     └──────────────┘ │
│                          ↓                             │
│                  ┌──────────────┐                      │
│                  │  Governance  │                      │
│                  │    Agent     │                      │
│                  └──────────────┘                      │
│                                                         │
│  Shared State: Legal corpus, extracted rules, policy   │
│               model, generated artifacts                │
│  Checkpointing: Save progress for long-running tasks   │
│  Human Gates: Legal expert approval before formalize   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Consequences

### Positive

- **Reduced complexity**: Built-in orchestration (no custom state management)
- **Debugging support**: Tracing visualizes agent interactions
- **Scalability**: Supports horizontal scaling of agent executions
- **Maintainability**: Well-documented, active community
- **Future-proof**: .NET option enables polyglot team (Python + C#)
- **Azure integration**: If deploying to Azure, native support for Azure AI services

### Negative

- **Learning curve**: Team must learn framework concepts (agents, workflows, state)
- **Framework lock-in**: Switching to different orchestration would require refactor
- **Preview status**: Framework is in preview (breaking changes possible, pin versions)
- **Python 3.10+ required**: Older Python environments incompatible
- **Less mature than LangChain**: Smaller ecosystem of pre-built tools

### Mitigations

- **Pin versions** during preview: `agent-framework-core==1.0.0b260107` (avoid breaking changes)
- **Isolate framework**: Keep agents loosely coupled to framework (minimal SDK surfaces in agent code)
- **Document patterns**: Create runbook for common operations (so knowledge transfer is easier)
- **Fallback plan**: If framework proves unsuitable, agents are modular (can migrate to DAG orchestration like Prefect/Airflow)

---

## Alternatives Considered

### 1. LangChain
**Pros**: Mature ecosystem, many integrations, large community  
**Cons**: Not designed for complex multi-agent workflows, state management weak, debugging difficult  
**Verdict**: Rejected - good for single-agent chatbots, insufficient for our multi-agent orchestration needs

### 2. AutoGen (Microsoft Research)
**Pros**: Multi-agent conversations, group chat patterns  
**Cons**: Research project (not production-ready), less structured workflows, Microsoft Agent Framework supersedes it  
**Verdict**: Rejected - Microsoft Agent Framework is the production version of AutoGen concepts

### 3. CrewAI
**Pros**: Multi-agent orchestration, role-based agents  
**Cons**: Less mature, smaller community, limited observability  
**Verdict**: Rejected - too early stage for production system

### 4. Custom Orchestration (Prefect/Airflow)
**Pros**: Full control, mature workflow systems, proven at scale  
**Cons**: No LLM/agent primitives, would need to build state management, tool calling, agent patterns ourselves  
**Verdict**: Rejected - reinventing wheel, but viable fallback if framework fails

### 5. Azure Logic Apps / Durable Functions
**Pros**: Cloud-native, serverless, state management built-in  
**Cons**: Azure-specific (not portable), expensive at scale, no agent-specific primitives  
**Verdict**: Rejected - deployment lock-in, but could use for production deployment later (agents as serverless functions)

---

## Implementation Notes

### Setup

```bash
# Pin version while in preview
pip install agent-framework-azure-ai==1.0.0b260107
pip install agent-framework-core==1.0.0b260107
```

### Key Concepts to Use

- **Agents**: Each specialized agent (Legal Parser, Ontology Builder, etc.)
- **Workflows**: Graph-based orchestration (define agent execution order)
- **State**: Shared context across agents (legal corpus, extracted rules)
- **Tools**: External system integrations (data model query, NLP APIs)
- **Checkpointing**: Save progress for long-running legal document parsing

### Code Structure

```
src/agents/
├── base_agent.py          # Base class for all agents
├── legal_parser.py        # Legal Parser Agent
├── ontology_builder.py    # Ontology Builder Agent
├── policy_formalization.py # Policy Formalization Agent
├── code_generator.py      # Code Generator Agent
└── governance.py          # Governance Agent

src/workflows/
├── parse_legal_corpus.py  # Workflow: Legal text → Extracted rules
├── generate_engine.py     # Workflow: Rules → Decision engine API

src/tools/
├── data_model_client.py   # Tool: Query/write data model
├── nlp_client.py          # Tool: NLP APIs (NER, relation extraction)
└── legal_corpus_loader.py # Tool: Load legal documents
```

---

## Validation Criteria

This decision will be validated by:
- [ ] Successfully implementing Legal Parser Agent (MVP Phase)
- [ ] Agent orchestration works for multi-step workflows (parse → formalize → generate)
- [ ] State management handles large legal documents (100+ pages)
- [ ] Tracing provides useful debugging information
- [ ] Human-in-the-loop gates work for legal expert validation
- [ ] Performance acceptable (< 10 min to parse benefit program legislation)

If framework proves unsuitable, we can migrate to Prefect/Airflow with minimal agent code changes (agents are modular).

---

## References

- [Microsoft Agent Framework](https://github.com/microsoft/agent-framework)
- [Agent Framework Documentation](https://learn.microsoft.com/en-us/azure/ai-studio/how-to/develop/multi-agent)
- [AutoGen (predecessor)](https://github.com/microsoft/autogen)
- [Multi-Agent Patterns](https://learn.microsoft.com/en-us/azure/ai-studio/concepts/agent-patterns)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-13 | Project Lead | Initial proposal |
