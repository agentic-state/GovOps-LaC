# GovOps Training Curriculum

Training programs for three audiences: public servants who use GovOps, legal/policy analysts who encode rules, and technical teams who deploy and maintain it.

---

## Track 1: Officer Training (2 days)

**Audience**: Case officers, supervisors, quality reviewers

### Day 1: Understanding GovOps

| Session | Duration | Content |
|---------|----------|---------|
| What GovOps does | 1 hour | The problem, the method, what it is and is not |
| The authority chain | 1 hour | How rules trace back to legislation; why this matters for accountability |
| Hands-on: case dashboard | 2 hours | Navigate cases, read applicant profiles, understand evidence |
| The recommendation | 1 hour | Rule-by-rule assessment, what PASS/FAIL/NEEDS EVIDENCE means |
| Q&A and discussion | 1 hour | Officers share concerns, ask questions |

### Day 2: Making Decisions

| Session | Duration | Content |
|---------|----------|---------|
| Human review workflow | 1.5 hours | Approve, modify, reject, request info, escalate — when to use each |
| Writing rationale | 1 hour | How to document decisions for audit and appeal |
| The audit package | 1 hour | What auditors see, how to explain a decision |
| Edge cases and escalation | 1.5 hours | When the system says "insufficient evidence" or "escalate" |
| Practice: end-to-end cases | 1 hour | Process 5 cases from intake to decision |

### Assessment
- Process 3 test cases independently
- Each decision must include written rationale
- All 3 must reference the correct statutory authority

---

## Track 2: Rule Encoding Training (3 days)

**Audience**: Legal analysts, policy advisors, domain experts

### Day 1: Legislative Analysis

| Session | Duration | Content |
|---------|----------|---------|
| From law to rules | 2 hours | How legislation creates testable conditions |
| The jurisdiction-first principle | 1 hour | Authority chains, constitutional constraints |
| Identifying rule types | 2 hours | Thresholds, minimums, statuses, evidence requirements, exclusions |
| Practice: extract rules from text | 1 hour | Manual extraction exercise |

### Day 2: The Encoding Pipeline

| Session | Duration | Content |
|---------|----------|---------|
| The encoding workflow | 1 hour | Ingest, extract, review, commit |
| AI-assisted extraction | 2 hours | How to use LLM extraction, what to watch for, how to review proposals |
| Reviewing and editing rules | 2 hours | Approve, edit, reject — quality criteria |
| Handling ambiguity | 1 hour | What to do when the law is unclear |

### Day 3: Advanced Encoding

| Session | Duration | Content |
|---------|----------|---------|
| Transitional provisions | 1.5 hours | Rules that change over time (phased thresholds, sunset clauses) |
| Cross-references | 1 hour | Rules that depend on other legislation |
| Exception handling | 1.5 hours | Exemptions, special populations, emergency provisions |
| Practice: encode a full article | 2 hours | End-to-end encoding of one legislative article |

### Assessment
- Encode 5 articles from unfamiliar legislation
- Each rule must have correct citation, parameters, and formal expression
- Peer review of another trainee's encoding

---

## Track 3: Technical Deployment (3 days)

**Audience**: Developers, system administrators, DevOps engineers

### Day 1: Architecture and Setup

| Session | Duration | Content |
|---------|----------|---------|
| GovOps architecture | 2 hours | Models, engine, store, API, templates, encoding pipeline |
| Local setup and testing | 2 hours | Install, run, test, explore the codebase |
| Adding a jurisdiction | 2 hours | Hands-on: add a new country's program |

### Day 2: Production Deployment

| Session | Duration | Content |
|---------|----------|---------|
| Database migration | 2 hours | Replacing in-memory store with PostgreSQL |
| Authentication and roles | 2 hours | Adding user management, RBAC |
| Containerization and CI/CD | 2 hours | Docker, GitHub Actions, deployment pipeline |

### Day 3: Operations and Integration

| Session | Duration | Content |
|---------|----------|---------|
| Monitoring and audit | 2 hours | Log integrity, audit trail verification |
| Security hardening | 2 hours | Penetration testing, HTTPS, secrets management |
| Integration patterns | 2 hours | Connecting to government registries, identity systems |

### Assessment
- Deploy GovOps to a container environment with PostgreSQL
- Add a new jurisdiction with 10+ rules
- Demonstrate the full workflow: encode rules, evaluate cases, produce audit package

---

## Training Delivery Options

| Format | Duration | Best For |
|--------|----------|----------|
| On-site instructor-led | 2-3 days per track | Government teams adopting GovOps |
| Virtual instructor-led | 2-3 days per track | Distributed teams |
| Self-paced online | 1-2 weeks per track | Individual learners, consultants |
| Train-the-trainer | 5 days (all tracks) | Organizations building internal capacity |

---

## Training Materials Included

- Slide decks for each session
- Hands-on exercise workbooks
- Test cases for assessment
- Reference card: rule types, encoding checklist, review criteria
- Access to the GovOps demo instance
