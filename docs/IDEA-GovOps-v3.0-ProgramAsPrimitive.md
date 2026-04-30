# GovOps v3.0 — Program as Primitive

**Status**: Charter, approved 2026-04-29. Not yet planned.
**Predecessor**: v2.0 (Law-as-Code), shipped as v0.4.0 on `main`.
**One-sentence pitch**: *Add one program once. Six jurisdictions answer. Anyone can fork the shape library and run their own.*

> This document is the strategic vision for v3. It does not constrain implementation. PLAN-v3.md will track v3 execution once it begins.

---

## Disclaimer

GovOps is an independent open-source prototype. It is **not affiliated with, endorsed by, or representing any government, department, or public agency**. Legislative text is publicly available law interpreted by the author for illustrative purposes — not authoritative operational guidance.

## Why v3 exists

v2 (Law-as-Code, shipped as v0.4.0) proved:

- A deterministic engine for old-age pension eligibility
- Multi-jurisdiction reach (7 countries: CA, BR, ES, FR, DE, UA, JP)
- Multi-language reach (6 locales)
- Full audit trail from constitution through to service decision
- AI-assisted rule encoding pipeline
- ConfigValue substrate for runtime parameters
- A premium frontend serving program leaders, officers, and reviewers

What v2 did **not** prove:

- That **adding a program** is as cheap and uniform as adding a jurisdiction
- That programs interact when one citizen draws benefits from more than one
- That a **citizen** audience exists — v2 is officer-facing
- That a **government-leader** audience exists — v2 has no cross-program / cross-jurisdiction comparison surface

## The bet: Program-as-Primitive

v2 made *jurisdiction* a first-class declarable thing. v3 does the same for *program*.

Today a program is an ad-hoc collection of rules attached to a jurisdiction in code. In v3:

- A **program** is a manifest (YAML)
- A **jurisdiction** is a directory of manifests
- The **engine** is a binary that reads manifests and answers questions
- Adding a program once causes it to appear in every jurisdiction that adopts the manifest

This is the **"Unix of Public Sector"** thesis: small composable primitives, a universal interface, inspectable by humans, scriptable by machines, no jurisdiction privileged over another. POSIX-shaped — the contribution is the *interface*, not the implementation. Anyone can fork the shape library and run their own.

## The proof: Employment Insurance, six at once

The second program shipped is **unemployment insurance**, instantiated symmetrically across the six active jurisdictions:

| Jurisdiction | Program | Authority |
| --- | --- | --- |
| CA | Employment Insurance (EI) | *Employment Insurance Act* |
| BR | Seguro-Desemprego | *Lei nº 7.998/1990* |
| ES | Prestación por Desempleo | *Real Decreto Legislativo 8/2015* |
| FR | Allocations chômage | *Code du travail* |
| DE | Arbeitslosengeld | *Sozialgesetzbuch III* |
| UA | Допомога по безробіттю | *Закон України «Про загальнообов'язкове державне соціальне страхування на випадок безробіття»* |

**Japan remains untouched** — the architectural control. It proves the architecture does not *require* symmetric extension; adopters choose where to extend. Japan's old-age pension surfaces from v2 stay exactly as they are.

### Why unemployment insurance

- Exists in all six jurisdictions
- Shares structure with old-age pension (contribution period, evidence, exclusions) — engine reuses primitives
- Introduces *one* genuinely new primitive — **bounded benefit duration with active obligation** — which sets up the citizen surface

Contributory pension was the runner-up. Rejected because it is structurally similar to v2's old-age pension; it would be "more pension," not a different shape of program.

## New primitives EI forces (reusable for future programs)

- **Bounded-duration timeline** — eligibility expressed as weeks of benefit, not lifetime status. Reusable for any program with a clock.
- **Active-obligation surface** — "must be actively job-searching" is a different shape from passive eligibility; needs both case-worker verification and citizen acknowledgement.
- **Program-interaction warning** — when EI and old-age pension conflict for the same claimant, the UI surfaces it instead of silently picking one.
- **Cross-program evaluation** — one case evaluates against multiple programs; per-program eligibility + citation chain returned in a single audit package.

## Audiences and surfaces

| Audience | v2 today | v3 delta |
| --- | --- | --- |
| **Program leaders** | Encoder, ConfigValue admin | Manifest editor extended to EI; program shape catalog |
| **Officers / servants** | Case workflow | Multi-program evaluation; per-program citation chain |
| **Government leaders** | — | **New** — cross-program / cross-jurisdiction comparison surface |
| **Citizens** | — | **New** — "What am I entitled to?" entry path + one life-event reassessment example (job loss → EI) |

**Citizen-surface scoping**: capped at entry path + one life-event example for v3. Proactive notifications, full life-event taxonomy, accounts and identity become their own v4 track.

## Adoption substrate (the Unix bit)

What makes a program leader in Estonia, Kenya, or Uruguay run this tomorrow:

1. **YAML manifests** for jurisdictions and programs — pull v2's Phase 3 externalization forward into v3
2. **`govops init <country-code>`** scaffolds a new jurisdiction from the canonical shape catalog
3. **Canonical program shape library** — schemas anyone can fork: old-age pension, unemployment insurance, contributory pension stub, and so on
4. **`docker compose up`** demo — no Python+Node+Bun ceremony required to see it running
5. **Plain-language doc beside each YAML** — so a non-coder program leader can read what their team encoded and disagree with it

## Included-by-default floor

Inherited from v2's enterprise floor — never optional in v3:

- **a11y** — every new EI surface passes axe WCAG 2.1 AA
- **E2E** — Playwright specs for new EI flows across Chromium / Firefox / WebKit
- **i18n** — EI keys in all six locales from day one; the §12.4 native-speaker review backlog folds into the EI rollout rather than staying as standalone backlog
- **Demo seed** — `GOVOPS_SEED_DEMO=1` includes EI demo cases for all six jurisdictions
- **Security** — gitleaks + CodeQL coverage extended to new code paths
- **Backend test discipline** — every new rule type, manifest loader, and API route has tests; pre-commit pytest hook stays in force

## Out of scope for v3 (parking lot)

Surfaced here so they don't drift back in:

- **Sub-national jurisdictions** (provinces, Länder, régions) — v4 axis. Same symmetry rule will apply, but stacking it on v3 doubles the surface.
- **Ed25519 federation between running instances** — defer until a real peer instance signs up to run. Without a peer it is self-signing across localhost: TCP/IP without a network.
- **Adjacent domains** (immigration eligibility, occupational licensing, tax credits) — each is a new *shape* of program, each its own v3-sized bet.
- **Citizen account / identity / proactive notifications** — v4 citizen track.
- **Production hardening** (managed Postgres, multi-tenant, AuthN/AuthZ at scale, full observability stack) — GovOps remains an MVP demo for contributors to clone and run, not a production service.

## The test for "is this still v3?"

If a Public Sector Program Leader, on first encounter, reads:

> *v3 makes program a primitive. Add one program once, six jurisdictions answer. Anyone can fork the shape library and run their own.*

…and replies *"obvious and useful"*, the work is on track. If they reply *"interesting but abstract"*, the spine is wrong — keep iterating before committing more scope.

## Rollback point

`v0.4.0` (v2 shipped) — tag and `main` reference. v3 work happens on a feature branch; `main` remains v2 until v3 ships.
