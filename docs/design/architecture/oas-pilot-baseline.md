# OAS Pilot Baseline - Initial Eligibility Determination

**Artifact Timestamp**: 20260318_204402 UTC
**Project**: GovOps-LaC (formerly 61-GovOps)
**Status**: Canonical pilot baseline for Phase 1 scope lock

---

## Selected First Pilot

**Pilot Case Type**: Old Age Security (OAS) - Initial Eligibility Determination

**Narrow MVP Service Name**: OAS Age-65 Residency Eligibility Check

**Decision Type**: Rule-based eligibility screening for core statutory criteria, with human review retained for exceptions, ambiguity, and final determination.

---

## Why OAS Is The First Pilot

The first pilot is OAS initial eligibility, not Employment Insurance.

OAS is the stronger first implementation target because:

1. The core eligibility structure is narrower and more stable.
2. The decision path is closer to deterministic threshold logic than highly contextual adjudication.
3. Residency, age, and legal status produce a cleaner authority-to-evidence mapping for a first machine.
4. The operational service can be bounded tightly without pretending to solve all pension administration.
5. The pilot can prove the GovOps method on a real federal service without starting in a politically volatile, procedurally noisy domain.

Employment Insurance may remain a later expansion path, but it is not the first proof target.

---

## Authority Chain

Use this authority chain as the canonical Phase 1 baseline for the pilot:

1. Government of Canada
2. Constitution Act, 1867
3. Old Age Security Act (R.S.C., 1985, c. O-9)
4. Old Age Security Regulations
5. Federal department responsible for OAS program delivery
6. Old Age Security Program
7. Initial Eligibility Determination for OAS Pension

This is the minimum chain that grounds the pilot in sovereign context, legislative authority, regulatory detail, administrative delivery, program scope, and service-level decisioning.

---

## Jurisdiction Baseline

**Country**: Canada

**Jurisdiction Level**: Federal

**Authority Model**: Federal statutory benefit program administered through the Government of Canada.

**Modeling Rule**: The pilot must not treat OAS rules as free-floating business logic. Every rule, evidence request, and recommendation path must remain anchored to this federal authority context.

---

## MVP Service Boundary

The MVP does not attempt full OAS administration.

It is bounded to a narrow decision-support service that:

1. accepts structured applicant facts and supporting evidence inputs,
2. checks age threshold and residency-related baseline conditions,
3. identifies missing or contradictory evidence,
4. produces a reviewable eligibility recommendation draft,
5. shows authority and evidence traceability, and
6. routes uncertain or exceptional cases to human review.

The MVP excludes appeals, overpayment recovery, broad pension operations, complex exception handling, and end-to-end program administration.

---

## Evidence Scope

The initial evidence model should be designed around:

1. age verification,
2. legal status or identity status as applicable,
3. residency history,
4. evidence sufficiency and gaps, and
5. traceable linkage between evidence items and the authority-backed rule or threshold they satisfy.

---

## Architectural Consequences

Selecting OAS first means the Phase 1 to Phase 2 architecture baseline should now assume:

1. a federal jurisdiction object as first-class context,
2. an explicit authority chain from legislation to service decision,
3. a rule-and-threshold-oriented pilot before more discretionary case types,
4. deterministic handling where the law and evidence allow it, and
5. human escalation where the evidence is incomplete, conflicting, or outside the bounded pilot path.

---

## Immediate Use In Governance

This artifact is now the canonical source for:

1. the selected first pilot,
2. the pilot authority chain,
3. the pilot jurisdiction boundary, and
4. the initial evidence scope for architecture work.

`PLAN.md`, `STATUS.md`, `ACCEPTANCE.md`, `README.md`, and `.github/copilot-instructions.md` should align to this baseline.
