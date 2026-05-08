# GovOps RFP Template

A template for government procurement teams issuing a Request for Proposals for GovOps implementation. Adapt to your jurisdiction's procurement rules.

---

## 1. Background

[Government name] seeks to implement a policy-driven decision-support system for [program name]. The system must turn existing legislation into traceable, deterministic, auditable eligibility determinations while preserving human accountability for all decisions.

The selected approach is GovOps, an open-source (Apache 2.0) method for encoding legislation into structured rules and evaluating cases against those rules with full authority traceability.

## 2. Scope of Work

### Phase 0: Validation (4 weeks)
- Encode the full rule set from [legislation citation] using the GovOps Encoding Pipeline
- Build realistic test cases from published program guidance
- Validate outputs with [number] subject matter experts
- Deliver a working prototype with documented rule coverage

### Phase 1: Production Deployment (8 weeks)
- Replace in-memory store with persistent database
- Implement user authentication and role-based access
- Build case lifecycle management (intake through archive)
- Deploy to [government cloud / sovereign hosting environment]
- Complete security review

### Phase 2: Pilot Operation (12 weeks)
- Process [number] cases through the system alongside existing process
- Measure and report: time per case, consistency, audit readiness
- Collect structured feedback from officers and supervisors
- Deliver evidence report with recommendations

### Phase 3 (optional): Second Program
- Encode a second program using the same platform
- Demonstrate method reusability

## 3. Mandatory Requirements

The proposed solution must:
- [ ] Use the GovOps open-source project as its foundation
- [ ] Trace every recommendation to specific sections of [legislation]
- [ ] Produce deterministic results (identical inputs = identical outputs)
- [ ] Preserve human authority for all final decisions
- [ ] Generate audit-ready packages for oversight and appeal
- [ ] Support [language(s)] in the user interface
- [ ] Deploy on [government-approved cloud / sovereign infrastructure]
- [ ] Pass security assessment per [security standard]

## 4. Evaluation Criteria

| Criterion | Weight |
|-----------|--------|
| Understanding of GovOps method and legislative encoding | 25% |
| Team qualifications (certified encoders, implementers) | 20% |
| Implementation approach and timeline | 20% |
| Past experience with government decision-support systems | 15% |
| Price | 10% |
| Open-source contribution commitment | 10% |

## 5. Team Requirements

The proposer must provide:
- At least 1 GovOps Certified Implementer (GCI) or equivalent experience
- At least 1 legal/policy analyst with experience in [relevant legislation]
- A project manager with government sector experience
- Security review capability

## 6. Deliverables

| Deliverable | Phase | Due |
|-------------|-------|-----|
| Encoded rule set with citations | 0 | Week 4 |
| Validation report from domain experts | 0 | Week 4 |
| Production system with auth and persistence | 1 | Week 12 |
| Security assessment report | 1 | Week 12 |
| Pilot results and evidence report | 2 | Week 24 |
| Training delivery (officers + encoders) | 1-2 | Week 16 |

## 7. Intellectual Property

- GovOps core remains Apache 2.0 open source
- Jurisdiction-specific rule encodings produced under this contract become [government property / open source contribution / negotiable]
- Custom integrations and configurations are owned by [government name]

## 8. Submission Requirements

- Technical proposal (max 20 pages)
- Team CVs and relevant certifications
- Two references from government engagements
- Fixed-price proposal for Phase 0; time-and-materials estimate for Phases 1-2
- Draft project plan with milestones

---

*This template is provided as a starting point. Adapt to your jurisdiction's procurement rules, security requirements, and program context.*
