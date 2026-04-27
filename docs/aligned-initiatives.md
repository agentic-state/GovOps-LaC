# Aligned Initiatives — Where GovOps Sits in the Rules-as-Code / Law-as-Code Landscape

> A directory of peer projects, standards, convening bodies, and venues that
> share GovOps's posture or problem space — and a concrete five-step plan for
> how GovOps engages with them.

GovOps is one of several active efforts to make legal rules executable,
traceable, and auditable. This document maps the rest of the field and
spells out where collaboration is realistic. It is a living document — the
project deliberately stays plugged into the field rather than building in
isolation.

GovOps's posture, for context: Apache 2.0, multi-jurisdiction (CA / BR / ES /
FR / DE / UA today), six languages, decision support not autonomous
adjudication, evidence-first, full traceability through an effective-dated
ConfigValue substrate, human-in-the-loop at every critical point. GovOps is
**not** affiliated with any government, any standards body, or any of the
initiatives mapped below — it is an independent open-source prototype that
takes their framings seriously and builds against them.

Facts here were verified against primary sources in 2026-04. Each entry
links to its canonical URL. If a fact has decayed since, the entry is wrong
— please open an issue.

---

## Section 1 — Strong-alignment peers (engage actively)

### SPRIND Law as Code (Germany)

The German Federal Agency for Disruptive Innovation's strategic project to
publish legal norms as official, executable, machine-readable code.

- **Origin / lead**: [SPRIND](https://www.sprind.org/en/law-as-code), headed by **Dr. Hakke Hansen, LL.M.** with **Jörg Resch** on the team.
- **Mission**: *"Building a lingua franca for digital legal systems — the foundation for tomorrow's government."*
- **Five foundational elements** (verbatim from the project page): definition of a legal code; open-source legal coding editors; AI-powered legal coding processes; central repository of the official legal code; training and capacity building. GovOps's element-by-element mapping with code references is in [docs/design/LAW-AS-CODE.md](design/LAW-AS-CODE.md).
- **Status**: Active — open call closed **11 January 2026**.
- **Named partner project to cite**: **Rulemapping** ([sprind.org/en/actions/projects/rulemapping](https://www.sprind.org/en/actions/projects/rulemapping)) is the working sibling inside SPRIND's portfolio.
- **GovOps offers**: an Apache-2.0 multi-jurisdiction reference implementation that includes the German jurisdiction (`lawcode/de/` + `GERMANY_RULES` in `jurisdictions.py`), with effective-dated supersession, citation-impact querying, and an explicit element-by-element mapping to SPRIND's framework.
- **They offer**: convening power inside the German federal-government context; funding programs; the most active "Law as Code" framing in Europe.

### The Agentic State (vision paper)

The 2025 vision paper that maps how agentic AI can transform public administration across 12 functional layers while preserving democratic accountability.

- **Citation**: Ilves, L., Kilian, M., Parazzoli, S.M., Peixoto, T.C., & Velsberg, O. (2025). *The Agentic State — Vision Paper* (v1.0.1). Tallinn Digital Summit, 09 October 2025. [agenticstate.org/paper.html](https://agenticstate.org/paper.html).
- **Position**: GovOps is a practical implementation of **Layer 3 (Policy & Rule-Making)** and **Layer 7 (Agent Governance)**. The paper explicitly cites New Zealand's *Better Rules* initiative as the conceptual ancestor of executable-policy work — that's exactly the lineage GovOps continues.
- **Status**: Active — paper launched October 2025; framework actively cited in 2026.
- **GovOps offers**: a working open-source implementation of the layers the paper articulates, demonstrating that "decision support, not autonomous adjudication" is achievable as a posture rather than a slogan.
- **They offer**: a coherent framework that places GovOps in the broader public-administration context — useful when explaining the project to government audiences.

### OpenFisca

Open-source Python microsimulation framework for tax-and-benefit rules with a country-package plug-in model.

- **Origin**: France's [beta.gouv.fr](https://beta.gouv.fr) / Etalab incubator (~2011); now community-governed via the [OpenFisca org](https://github.com/openfisca).
- **License**: AGPL-3.0 (core).
- **Status**: Active. `openfisca-core` last push **2026-04-22**. Country packages currently maintained: France, Tunisia, Senegal, Paris, Nouvelle-Calédonie, Paraguay (in `openfisca/`); Aotearoa New Zealand in [`ServiceInnovationLab/openfisca-aotearoa`](https://github.com/ServiceInnovationLab/openfisca-aotearoa) (slowing). The UK lineage moved into the [PolicyEngine fork](https://github.com/PolicyEngine/policyengine-uk).
- **Alignment**: same problem (encode law as executable rules), same posture (open, jurisdiction-agnostic, plug-in), overlapping audience (public-sector + civic tech). Different angle: OpenFisca leans toward microsimulation (what-if policy modeling), GovOps toward service delivery + audit trail.
- **GovOps offers**: bidirectional adapter (read OpenFisca parameter YAMLs as ConfigValues; export GovOps rules as OpenFisca variables). A reference implementation of authority-chain provenance OpenFisca currently lacks. ConfigValue effective-dating semantics as a pattern proposal.
- **They offer**: the largest, most-adopted peer community (~10 country teams). Mature parameter-versioning concepts. Slack workspace (invite from openfisca.org). Annual community calls.

### Catala

A domain-specific programming language for transcribing legislation, with formal semantics traceable back to statute.

- **Origin / lead**: [Inria](https://www.inria.fr/en/catala-software-dgfip-cnaf) + Sorbonne Université. Lead: **Denis Merigoux** (Inria, Paris center, leading Catala within the "Apollo" digital programs initiative). Originally targeted French tax code (CIR, family benefits).
- **License**: Apache-2.0. [github.com/CatalaLang/catala](https://github.com/CatalaLang/catala) — last push **2026-04-25**.
- **Status**: Active. Inria Apollo programme work continues; toolchain commits in 2026.
- **Alignment**: the academically-rigorous sibling to GovOps's pragmatic Python engine. Same north star (executable law with audit trail to source statute), different stack and different research posture.
- **GovOps offers**: a multi-jurisdiction practitioner case study; a pragmatic Python reference that complements Catala's compile-down approach; ConfigValue effective-dating semantics as a deployable pattern.
- **They offer**: formal-semantics rigour, a pathway into [POPL](https://popl27.sigplan.org/) / [PLDI](https://pldi.acm.org/) academic venues, intellectual scaffolding for proving rule equivalence across rewrites. The [ProLaLa workshop](https://prolala.org) (POPL satellite) is the natural meeting venue.

### PolicyEngine (US / UK / CA)

Microsimulation tool for tax-and-benefit policy, built on a fork of OpenFisca and oriented toward policy *analysis* (what-if simulation) rather than service delivery.

- **Origin / lead**: founders **Max Ghenis** (CEO) and **Nikhil Woodruff** (CTO). [github.com/PolicyEngine](https://github.com/PolicyEngine).
- **License**: AGPL.
- **Status**: Very active. `policyengine-us`, `policyengine-uk`, `policyengine-canada`, `policyengine-core`, `policyengine-api`, `policyengine-app` all show pushes in **April 2026**.
- **Validators**: Nuffield Foundation funding. **Nikhil Woodruff joined 10 Downing Street's 10DS data-science team in summer 2025 as Innovation Fellow** adapting PolicyEngine's microsimulation for UK government use ([source](https://www.policyengine.org/ca/research/policyengine-10-downing-street)).
- **Alignment**: same technical lineage as OpenFisca. Natural collaborator on the parameter / effective-dating story.

### Better Rules NZ lineage

The 2018 New Zealand Service Innovation Lab experiment that named the modern Rules-as-Code movement.

- **Origin**: NZ government Service Innovation Lab; **Pia Andrews** et al.
- **Status**: Original Lab is sunset — `github.com/ServiceInnovationLab` shows nearly all repos archived **except** `openfisca-aotearoa` (last push **2025-03-13**), `country-template`, and `FSD`. The lineage lives on via OpenFisca-Aotearoa and Pia Andrews's continued public-sector advocacy.
- **Pia Andrews's current role**: **Special Advisor / Digital & Client Data Workstream Lead at Employment and Social Development Canada (ESDC), Canada** — the same country where GovOps's CA jurisdiction is anchored.
- **GovOps offers**: a live, maintained reference implementation that carries the Better Rules torch forward.
- **They offer**: founding-narrative legitimacy; the Better Rules methodology document is canonical citation material.

### Blawx

Visual / declarative logic-programming environment for encoding legal rules, with explanation generation built on s(CASP) goal-directed answer-set programming.

- **Origin / lead**: Canada. **Jason Morris** (Lexpedite Legal Technologies Ltd. / Round Table Law, Sherwood Park, Alberta; **Rules-as-Code Director at Service Canada** as of 2026).
- **Repo**: [github.com/Lexpedite/blawx](https://github.com/Lexpedite/blawx).
- **Status**: Maintained but low-cadence. Last commit November 2024; ~200 open issues.
- **Alignment**: Canadian-origin like GovOps, complementary technique (logic programming + explanations vs. deterministic dispatch), shared values around defeasibility and human-readable justifications.
- **GovOps offers**: a Canadian peer project, deterministic execution as a complement to s(CASP), a multi-jurisdiction surface to demo against.
- **They offer**: defeasible-reasoning patterns, explanation-generation techniques, an established voice in the Canadian legaltech and Code-X-adjacent community. Jason Morris's Service Canada role makes him a natural touch-point for the CA jurisdiction story.

---

## Section 2 — Standards bodies (interop track)

### OASIS LegalDocML TC — Akoma Ntoso

OASIS XML standard for parliamentary, legislative, and judicial documents.

- **TC**: [oasis-open.org/committees/legaldocml](https://www.oasis-open.org/committees/tc_home.php?wg_abbrev=legaldocml).
- **Co-chairs**: **Monica Palmirani** + **Fabio Vitali** (both University of Bologna).
- **Status**: Active. Akoma Ntoso v1.0 OASIS Standard since 2018. **Akoma Ntoso 3.0 in Committee Specification Draft** (minutes 11 June 2025) — the standard is moving, not frozen.
- **GovOps engagement**: an Akoma Ntoso → ConfigValue/Rule import adapter is a clear interop play. The Brazilian [LexML](https://www.lexml.gov.br) standard aligns to Akoma Ntoso, so the same adapter would unlock authoritative BR statute ingestion.

### OASIS LegalRuleML TC

OASIS standard for representing legal rules in XML.

- **Status**: LegalRuleML Core Specification **v1.0 OASIS Standard**, published 30 August 2021. TC remains active. GitHub repo [oasis-tcs/legalruleml](https://github.com/oasis-tcs/legalruleml) for ongoing examples.
- **Lead**: Palmirani co-chairs both TCs; Tara Athan and Guido Governatori are key contributors.
- **GovOps engagement**: a LegalRuleML import/export adapter would make GovOps a working implementation of the standard with multi-jurisdiction coverage.

---

## Section 3 — Convening bodies & adjacent platforms

### OECD OPSI Rules-as-Code Forum

OECD Observatory of Public Sector Innovation's RaaS programme.

- **Status**: **Programme is highly active.** OPSI **launched a Rules-as-Code forum for government and IGO officials on 24 February 2026** ([source](https://oecd-opsi.org/blog/launch-of-rules-as-code-forum-for-government-officials/)). Published "[Rules as Code in Canada — Summary of Experiments and Lessons Learned](https://oecd-opsi.org/wp-content/uploads/2024/04/Rules-as-Code-in-Canada.pdf)" (April 2024) — directly relevant citation for CA-jurisdiction work. **OECD Call for Government Innovations 2026 edition** is live.
- **GovOps engagement**: this is now the most active formal convening venue in the field. Engaging with the forum is the highest-leverage move available.

### EU Joinup + Interoperable Europe Act

EU framework for cross-border digital public services and the Joinup open-source catalogue.

- **Status**: **Regulation (EU) 2024/903** entered into force 11 April 2024; main provisions apply from 12 July 2024 ([source](https://commission.europa.eu/news-and-media/news/interoperable-europe-act-enters-force-today-2024-04-11_en)). [Joinup](https://joinup.ec.europa.eu) remains the ecosystem hub, now under the Interoperable Europe Portal.
- **GovOps engagement**: Joinup historically catalogues public-sector open-source solutions. Eligibility for an independent (non-government) project is ambiguous — listings are typically government-led. **Recommended path**: contact Joinup before asserting eligibility. If eligible, the listing would surface GovOps to every EU public-sector procurement officer.
- **Note**: the **European Open Source Awards** are run by the **[European Open Source Academy](https://awards.europeanopensource.academy/)**, not the European Commission. Second annual ceremony was 29 January 2026 at Bibliothèque Solvay, Brussels.

### Docassemble

Open-source guided-interview platform for legal automation, widely used by legal-aid organisations.

- **Origin / lead**: Originated by **Jonathan Pyle** (Philadelphia Legal Assistance); strong A2J Lab adoption.
- **Repo**: [github.com/jhpyle/docassemble](https://github.com/jhpyle/docassemble) — last push **2026-04-21**.
- **License**: MIT.
- **Alignment**: adjacent — front-end interview/form-filling rather than rule encoding. A natural pairing — GovOps could be the rule engine behind a Docassemble interview.

---

## Section 4 — Conferences and venues to publish or speak at

| Venue | When | Where | Notes |
| --- | --- | --- | --- |
| [JURIX 2026](https://www.irit.fr/jurix2026/) | 14–18 December 2026 | Toulouse, France (IRIT) | Premier AI-and-law venue. Demo track is a natural fit. |
| [POPL 2027 + ProLaLa workshop](https://conf.researchr.org/home/POPL-2027) | January 2027 | Mexico City | Catala's home turf; specific ProLaLa CFP not yet posted. |
| ICAIL 2027 | TBD | TBD | Biennial; IAAIL has called for bids. ICAIL 2025 was Northwestern, Chicago; ICAIL 2026 is at Singapore Management University Yong Pung How School of Law, 8–12 June 2026. |
| [ICEGOV 2026](https://www.icegov.org/2026/) | 28 Sep – 1 Oct 2026 | Riyadh, Saudi Arabia | Theme: "Strengthening Digital Governance through Innovation, Human-Centered and Trustworthy Services". |
| FOSDEM | 31 Jan – 1 Feb 2026 | Brussels | Already past for 2026. Track FOSDEM 2027 for relevant devrooms. |
| TICTeC | 2026 dates not yet announced | TBD | Last confirmed: Mechelen, June 2025. Check [tictec.mysociety.org/events](https://tictec.mysociety.org/events/conferences/). |
| CodeX FutureLaw | 16 April 2026 (already past) | Stanford | Track FutureLaw 2027 once announced. |

Submission tip: a JURIX 2026 demo paper + ProLaLa 2027 short paper is a
balanced pair for academic and language-theory audiences in one cycle.

---

## Section 5 — Five-step engagement plan

Concrete moves, ROI-ordered:

### 1. Join the OECD OPSI Rules-as-Code Forum

Highest-leverage move available. The forum launched February 2026 and is now
the most active formal convening venue in the field. Contact the OPSI team
via the [forum launch post](https://oecd-opsi.org/blog/launch-of-rules-as-code-forum-for-government-officials/);
the project's CA + DE + multi-jurisdiction posture is exactly the kind of
profile they curate. Concretely: introduce GovOps, share the
[LAW-AS-CODE.md](design/LAW-AS-CODE.md) mapping doc, ask to be added to the
forum's distribution list.

### 2. Ship an OpenFisca interop adapter

A bidirectional adapter (read OpenFisca parameter YAMLs as GovOps
ConfigValues; export GovOps rules as OpenFisca variables) instantly makes
GovOps legible to ~10 country teams. Pair with a blog post comparing
posture: deterministic dispatch + authority chain (GovOps) vs. microsimulation
+ what-if (OpenFisca). Announce on the OpenFisca Slack
(invite from [openfisca.org](https://openfisca.org)).

### 3. Submit a JURIX 2026 demo paper + ProLaLa 2027 short paper

JURIX 2026 (Toulouse, 14–18 December) gets the AI-and-law academic audience.
ProLaLa 2027 puts the project in the room with Catala — the single most
strategic relationship to build given shared values and complementary
technique. A "pragmatic Python + ConfigValue substrate" framing will read
as complementary, not competitive, to Catala's formal-semantics approach.
Co-authorship with Denis Merigoux (Inria) on a comparison piece would be a
credibility multiplier.

### 4. Engage SPRIND directly with the DE jurisdiction as the calling card

You have already started the conversation with SPRIND. The DE jurisdiction
in `lawcode/de/` and `GERMANY_RULES` in `jurisdictions.py` is the calling
card — it is now SPRIND-grade after the audit and corrections in this
session (umlauts restored, citations corrected to current SGB VI, conceptual
simplifications acknowledged in code comments). The next concrete touch:
share a link to the about-rebuild + LAW-AS-CODE.md mapping with Hansen and
Resch; mention complementarity with SPRIND's [Rulemapping](https://www.sprind.org/en/actions/projects/rulemapping)
project as a sibling under the same framework.

### 5. Recruit Pia Andrews + Jason Morris as informal advisors

The Better Rules / Blawx lineage is the doctrinal core of the field. Both
are now in **Canada** — Pia at ESDC, Jason as Rules-as-Code Director at
Service Canada — which makes the CA jurisdiction story the natural
conversation starter. Even informal advisory connections compound: Pia
connects to the AU/NZ public sector and the international Better Rules
network; Jason connects to the Canadian legaltech and Code-X-adjacent
community. Concrete ask: 30-minute call each, share the v2.0 PLAN, listen.

Rationale for ordering: Steps 1–2 are visibility-and-interop moves with no
permission required and immediate compounding effects. Step 3 is the
long-lead academic pipeline (JURIX 2026 and ProLaLa 2027 deadlines fall
mid-2026). Step 4 is the highest-value funding/legitimacy bet but requires
the about-rebuild to land first. Step 5 is relationship infrastructure that
pays dividends across all other steps.

---

## What this document is not

- **Not an endorsement claim.** GovOps is not affiliated with, endorsed by, or representing any of the initiatives mapped above.
- **Not exhaustive.** There are more Rules-as-Code / legal-tech projects than fit on one page. Inclusion here means the project is materially aligned and engagement is realistic; absence means tangential, dormant, or out of the project's current scope.
- **Not a fixed-in-time snapshot.** The field moves quickly. Each entry links to its canonical source — verify against the source if a fact is load-bearing for a decision.

---

## Cross-references

- The five-elements mapping to SPRIND: [docs/design/LAW-AS-CODE.md](design/LAW-AS-CODE.md)
- The strategic argument: [docs/IDEA-GovOps-v2.0-LawAsCode.md](IDEA-GovOps-v2.0-LawAsCode.md)
- The execution plan: [PLAN.md](../PLAN.md)
- Architecture & decisions: [docs/design/ADRs/](design/ADRs/)
- Live legal-code artefacts: [lawcode/](../lawcode/)
- Schema for the legal-code shape: [schema/configvalue-v1.0.json](../schema/configvalue-v1.0.json), [schema/lawcode-v1.0.json](../schema/lawcode-v1.0.json)
