---
name: Second benefit program in an existing jurisdiction
about: Propose a non-pension program in CA / BR / ES / FR / DE / UA / JP
title: "[PROGRAM] <jurisdiction> — <program name>"
labels: program, jurisdiction
---

GovOps's seven jurisdictions all encode one program (pension eligibility). Adding a second program inside an existing jurisdiction proves cross-program federation without requiring a new country.

**Jurisdiction**: (CA / BR / ES / FR / DE / UA / JP)
**Program name**: 
**Authority** (statute + section): 
**URL to the legislative text**: 

**Eligibility shape** — which of the existing rule types apply, and which (if any) need new ones?
- [ ] `age_threshold` (e.g. minimum / maximum age)
- [ ] `residency_minimum` (years lived / contributed)
- [ ] `residency_partial` (pro-rata calculation)
- [ ] `legal_status` (citizen / permanent resident / refugee / other)
- [ ] `evidence_required` (specific documents)
- [ ] `exclusion` (disqualifying conditions)
- [ ] `calculation` (benefit-amount formula — Phase 10B)
- [ ] **New rule type required** — describe:

**Existing infrastructure that should carry over without changes**
- [ ] Authority chain browser (`/authority`)
- [ ] Self-screening (`/screen/<jurisdiction>`)
- [ ] Decision notice template
- [ ] Life-event reassessment (`POST /api/cases/{id}/events`)
- [ ] Federation (the program ships as part of the existing jurisdiction's lawcode pack)

**Are you the domain expert?** (yes / no)
**Can you provide the legislative text?** (yes / no)
**Open question for the maintainer**: anything you want a design decision on before you start?
