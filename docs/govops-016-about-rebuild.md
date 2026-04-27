# GovOps Spec — About page rebuild (story + Law as Code framing)
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002, govops-013] -->
type: route
priority: p1
depends_on: [govops-001, govops-002, govops-013]
spec_id: govops-016

## Intent

The current `/about` tells a design-philosophy story (Statute meets System +
provenance ribbons) but does not tell the **project** story or name the **Law
as Code** framing. The page is also the artefact the project owner will share
with **SPRIND** (Dr. Hakke Hansen, LL.M. and Jörg Resch) when introducing the
work; that audience deserves accuracy, dignity, and clear positioning of GovOps
relative to the SPRIND framework + the Agentic State paper.

This rebuild keeps everything that already works (provenance ribbons, the
Statute meets System framing, BrandingCheck) and adds the missing story
layers: an honest disclaimer card, the FKTE pipeline, the jurisdiction-first
authority chain, twin reference cards for SPRIND and the Agentic State, an
expanded operating-principles list, a "what this is NOT" section, and a
consolidated "Read deeper" block linking to the in-repo Law-as-Code artefacts
and the new aligned-initiatives directory.

The page must read as a peer-grade artefact — neither vendor pitch nor
academic essay. Honest about what GovOps is and isn't, generous in citation,
careful in attribution, and clearly designed for a reader who arrived from
SPRIND's network and wants to know what they're looking at in 90 seconds.

## Acceptance criteria

### Page structure (top-down)

The page renders the following sections in order. Each is its own
`<section>` with `aria-labelledby`. Sections are spaced via the existing
`space-y-14` pattern from the current `/about`.

- [ ] **§1 Hero + Disclaimer card** — h1 "About GovOps", lede paragraph, and a prominent disclaimer card (NOT a footer afterthought). The disclaimer reads: "GovOps is an independent open-source prototype. It is **not affiliated with, endorsed by, or representing any government, department, agency, or initiative** — including SPRIND, the Agentic State authors, Deutsche Rentenversicherung, or any of the six jurisdictions used as illustrative case studies. Legislative text is publicly available law interpreted by the author for illustrative purposes only — **not authoritative operational guidance**." Disclaimer card has `ProvenanceRibbon variant="human"` and `border-warning` styling (or equivalent — use a slightly elevated visual treatment so it's read).
- [ ] **§2 What GovOps does** — one paragraph (60–100 words). Names the demo (Old Age Security, Canada) as the first bounded case study; mentions six jurisdictions, six languages, deterministic engine, full audit trail. No bullet points — this is prose.
- [ ] **§3 FKTE pipeline** — visual diagram of the four-step transformation: Unstructured → Structured → Executable → Operational. Use the new `<PipelineDiagram>` component (see "Components" below). Includes a one-sentence caption explaining what FKTE stands for.
- [ ] **§4 Two frameworks GovOps takes seriously** — heading + caption, then **two `<ReferenceCard>` components side-by-side on desktop, stacked on mobile**:
  - **SPRIND Law as Code (Germany)**: reference card with the verbatim definition quote, the lingua-franca mission line, attribution to "Dr. Hakke Hansen, LL.M. and Jörg Resch", external link to [sprind.org/en/law-as-code](https://www.sprind.org/en/law-as-code), AND a "Five-element mapping →" link to [docs/design/LAW-AS-CODE.md](design/LAW-AS-CODE.md).
  - **The Agentic State (Tallinn 2025)**: reference card with one of the load-bearing quotes (recommend the transparency one — see "Reference quotes" below), full 5-author attribution (Ilves, Kilian, Parazzoli, Peixoto, Velsberg, 2025; v1.0.1), external link to [agenticstate.org/paper.html](https://agenticstate.org/paper.html), AND a one-line claim: "GovOps is a working implementation of Layer 3 (Policy & Rule-Making) and Layer 7 (Agent Governance)."
- [ ] **§5 Jurisdiction-first chain** — visual diagram of the authority chain: Jurisdiction → Constitution → Authority → Law → Regulation → Program → Service → Decision. Use `<AuthorityChainDiagram>` component (see "Components"). One-sentence caption explaining the design rule: "Every recommendation traces back from decision to jurisdiction."
- [ ] **§6 Operating principles** — heading + 6 cards (replace the current 3). Each card: a `ProvenanceRibbon` strip + one-line principle. Six principles:
  - "Decision support, not autonomous adjudication." (variant: human)
  - "Evidence-first — the system flags missing inputs rather than guessing." (variant: hybrid)
  - "Full traceability — Decision → Rule → ConfigValue → Citation → Authority → Jurisdiction." (variant: agent)
  - "Reproducibility — an evaluation on date D produces identical output if re-run with the same inputs, because the substrate is dated." (variant: system)
  - "Human-in-the-loop at every critical point." (variant: human)
  - "Open and forkable — Apache 2.0, no vendor lock-in." (variant: citizen)
- [ ] **§7 Statute meets System** — KEPT from current /about with no change. Same heading, same body, same `provenance: hybrid` ribbon.
- [ ] **§8 Provenance ribbons** — KEPT from current /about with no change. Same heading, same caption, same five-row legend (agent / human / hybrid / system / citizen).
- [ ] **§9 What this is NOT** — heading + four-row list with strikethrough + restatement pattern (see Reference implementation below). Items: "Not autonomous decision-making." / "Not a replacement for legal or policy authority." / "Not a hidden-reasoning AI assistant." / "Not a claim to automate political judgment."
- [ ] **§10 Read deeper** — heading + two-column layout (in-repo / external). In-repo: PLAN.md, IDEA-GovOps-v2.0-LawAsCode.md, LAW-AS-CODE.md, ADRs/, lawcode/, schema/, **aligned-initiatives.md** (new directory of peer projects). External: SPRIND page, Agentic State paper. Each link has a small ↗ icon if external, no icon if in-repo.
- [ ] **§11 Origin and lineage** — short prose section attributing the inspiration to the Agentic State paper (with the corrected 5-author citation), naming SPRIND's Law as Code as a parallel framework GovOps takes seriously, and closing with the Apache 2.0 + nights-and-weekends framing from the current README. Disclaimer reiterated in one sentence: "Independent prototype; not affiliated with the cited initiatives."
- [ ] **§12 `<BrandingCheck />`** — KEPT at the bottom as the existing dev sanity widget.

### Tone & content rules

- [ ] **No vendor pitch language.** No "we believe", no "the future of", no "transform", no "revolutionize". The page reads like a project README, not a sales page.
- [ ] **No claims of partnership, endorsement, or affiliation** with SPRIND, Agentic State, Deutsche Rentenversicherung, OECD, or any of the cited initiatives. Where a relationship is purely "we read their work and built against the framework", say exactly that.
- [ ] **No promises about future jurisdictions or features.** Describe what's shipped, not what's planned. The PLAN.md link in §10 is sufficient for readers who want to know what's next.
- [ ] **No solicitation.** No "we'd love to hear from you", no contact form, no newsletter signup. Hansen has already heard from the project owner.
- [ ] **First reference of any named person uses full title and last name.** "Dr. Hakke Hansen, LL.M." on first mention; "Hansen" subsequent. Same pattern for Merigoux, Andrews, Morris, etc. — though most don't appear on this page (they live in `aligned-initiatives.md`).
- [ ] **Citation format for the Agentic State paper**: "Ilves, Kilian, Parazzoli, Peixoto & Velsberg (2025), *The Agentic State — Vision Paper*, v1.0.1, Tallinn Digital Summit, 09 October 2025." Do NOT abbreviate to "Ilves et al." anywhere on this page — full author list preserves the credit Hansen will recognize.
- [ ] **All external links open in new tab** (`target="_blank" rel="noopener noreferrer"`) and carry an ↗ icon (use the lucide-react `ExternalLink` icon at `size={12}`, inline with the link text).
- [ ] **All in-repo links use TanStack `<Link>` for SPA navigation** where the destination is another route; for documentation links into `docs/` use `<a href="https://github.com/...">` pointing at the GitHub render of the file (since SPA routes don't serve markdown).

### Reference quotes (verbatim — accuracy is load-bearing)

Use these exact strings inside the `<ReferenceCard>` quote slot:

**SPRIND Law as Code**:
> "Legal norms will not only be published as analogue legal text, but also as official executable and machine-readable legal code."
>
> Source: SPRIND Law as Code project page, mission section.

**The Agentic State**:
> "Government agents must operate with complete transparency where private sector applications tolerate opacity. Citizens need to understand not just decisions but reasoning."
>
> Source: Ilves, Kilian, Parazzoli, Peixoto & Velsberg (2025), §1 Public Service Design & UX.

These quotes are not translatable — they ship in their original English.
The surrounding chrome (heading, attribution line, link labels) is
translated.

### a11y & i18n discipline

- [ ] All sections have `aria-labelledby` pointing at the heading id (`about-§N-heading`).
- [ ] Diagrams (PipelineDiagram, AuthorityChainDiagram) have `role="img"` + `aria-label` describing the chain in words for screen readers.
- [ ] Reference cards have a clear semantic structure: `<article>` wrapper, `<h3>` for the framework name, `<blockquote>` for the quote, `<footer>` for attribution + link.
- [ ] Six locales required (en, fr, pt-BR, es-MX, de, uk). NO new locales — the project does not ship Arabic or any seventh language during structural work (per PLAN §7).
- [ ] All numeric/date values via `react-intl` (`<FormattedDate>`, `<FormattedNumber>`).
- [ ] The disclaimer card text is fully translated and ICU-formatted.
- [ ] The two reference quotes stay in English with attribution; the surrounding chrome translates.

## Files to create / modify

```
src/routes/about.tsx                            (rewrite — replace existing)
src/components/govops/ReferenceCard.tsx         (new — quote card with attribution + external link)
src/components/govops/PipelineDiagram.tsx       (new — FKTE 4-step horizontal flow)
src/components/govops/AuthorityChainDiagram.tsx (new — 8-step vertical/horizontal chain)
src/messages/en.json                            (modify — add about.* keys; keep existing about keys per "What stays" below)
src/messages/fr.json                            (modify)
src/messages/pt-BR.json                         (modify)
src/messages/es-MX.json                         (modify)
src/messages/de.json                            (modify)
src/messages/uk.json                            (modify)
```

Do not touch `routeTree.gen.ts`. Do not modify any other route. Do not add
an Arabic locale.

### What stays from the current `/about`

- All existing `about.title`, `about.lede`, `about.philosophy.*`,
  `about.principles.*`, `about.ribbons.*` ICU keys are still referenced
  from the new layout (§1, §6, §7, §8) — keep them, with revised values
  where the spec calls for it. Do not delete them.
- The `<BrandingCheck />` widget at the page bottom — unchanged.
- The `head()` meta block — extend with a richer `description` reflecting
  the new content; keep the og:title / og:description pair.

## Tokens / data

No new tokens. Existing tokens used: `--surface`, `--surface-sunken`,
`--border`, `--foreground`, `--foreground-muted`, `--foreground-subtle`,
`--agentic`, `--authority`, `--font-serif`, `--font-mono`, `--ring-focus`.

If the disclaimer card needs a slightly elevated visual treatment, prefer
adjusting border weight or padding over introducing a new color token.

## Reference implementation

```tsx
// src/components/govops/ReferenceCard.tsx
import { ExternalLink } from "lucide-react";
import { ProvenanceRibbon } from "./ProvenanceRibbon";

export interface ReferenceCardProps {
  /** Short framework / paper name shown as the card heading. */
  name: string;
  /** One-line subtitle: organisation + role (e.g. "German Federal Agency for Disruptive Innovation"). */
  subtitle: string;
  /** Verbatim quote — kept in source language; not translated. */
  quote: string;
  /** Citation / source line shown beneath the quote. */
  attribution: string;
  /** Optional one-line claim about how GovOps relates to this framework. */
  claim?: string;
  /** Primary external link (the framework's canonical URL). */
  externalHref: string;
  /** Optional in-repo link label + URL (e.g. SPRIND's element-by-element mapping). */
  inRepoLink?: { label: string; href: string };
}

export function ReferenceCard({
  name, subtitle, quote, attribution, claim, externalHref, inRepoLink,
}: ReferenceCardProps) {
  return (
    <article className="flex items-stretch rounded-lg border border-border bg-surface">
      <ProvenanceRibbon variant="hybrid" />
      <div className="flex-1 p-5 space-y-3">
        <header>
          <h3 className="text-lg text-foreground" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
            {name}
          </h3>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle" style={{ fontFamily: "var(--font-mono)" }}>
            {subtitle}
          </p>
        </header>
        <blockquote className="border-l-2 border-authority ps-4 italic text-sm text-foreground">
          "{quote}"
        </blockquote>
        <p className="text-xs text-foreground-muted">{attribution}</p>
        {claim && <p className="text-sm text-foreground">{claim}</p>}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-border">
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-authority hover:underline focus-visible:shadow-[var(--ring-focus)]"
          >
            {externalHref.replace(/^https?:\/\//, "")}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
          {inRepoLink && (
            <a href={inRepoLink.href} className="text-sm text-foreground-muted hover:underline">
              {inRepoLink.label} →
            </a>
          )}
        </footer>
      </div>
    </article>
  );
}
```

```tsx
// src/components/govops/PipelineDiagram.tsx
import { useIntl } from "react-intl";
import { ArrowRight } from "lucide-react";

const STEPS = [
  "about.fkte.unstructured",
  "about.fkte.structured",
  "about.fkte.executable",
  "about.fkte.operational",
] as const;

export function PipelineDiagram() {
  const intl = useIntl();
  const ariaLabel = intl.formatMessage({ id: "about.fkte.aria_label" });
  return (
    <div role="img" aria-label={ariaLabel} className="rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2">
        {STEPS.map((id, i) => (
          <div key={id} className="flex items-center gap-2">
            <div className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm" style={{ fontFamily: "var(--font-mono)" }}>
              {intl.formatMessage({ id })}
            </div>
            {i < STEPS.length - 1 && <ArrowRight size={16} aria-hidden="true" className="text-foreground-subtle hidden sm:block" />}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-foreground-muted">
        {intl.formatMessage({ id: "about.fkte.caption" })}
      </p>
    </div>
  );
}
```

```tsx
// src/components/govops/AuthorityChainDiagram.tsx
import { useIntl } from "react-intl";

const STEPS = [
  "about.chain.jurisdiction",
  "about.chain.constitution",
  "about.chain.authority",
  "about.chain.law",
  "about.chain.regulation",
  "about.chain.program",
  "about.chain.service",
  "about.chain.decision",
] as const;

export function AuthorityChainDiagram() {
  const intl = useIntl();
  const ariaLabel = intl.formatMessage({ id: "about.chain.aria_label" });
  return (
    <div role="img" aria-label={ariaLabel} className="rounded-lg border border-border bg-surface p-6">
      <ol className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center" style={{ fontFamily: "var(--font-mono)" }}>
        {STEPS.map((id, i) => (
          <li key={id} className="flex items-center gap-2 text-sm">
            <span className="rounded bg-surface-sunken px-2 py-1">{intl.formatMessage({ id })}</span>
            {i < STEPS.length - 1 && <span className="text-foreground-subtle" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-foreground-muted">
        {intl.formatMessage({ id: "about.chain.caption" })}
      </p>
    </div>
  );
}
```

```tsx
// src/routes/about.tsx — top-of-page sketch (only §1 + §4 shown to anchor structure)
function About() {
  const intl = useIntl();
  return (
    <div className="space-y-14">
      {/* §1 Hero + disclaimer */}
      <header className="space-y-6">
        <div className="flex items-stretch">
          <ProvenanceRibbon variant="human" />
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground-subtle" style={{ fontFamily: "var(--font-mono)" }}>
              about · govops
            </p>
            <h1 className="text-4xl tracking-tight text-foreground sm:text-5xl" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
              {intl.formatMessage({ id: "about.title" })}
            </h1>
            <p className="max-w-2xl text-lg text-foreground-muted">
              {intl.formatMessage({ id: "about.lede" })}
            </p>
          </div>
        </div>
        <aside aria-labelledby="about-disclaimer-heading" className="flex items-stretch rounded-lg border-2 border-border bg-surface-sunken">
          <ProvenanceRibbon variant="human" />
          <div className="p-5 space-y-2">
            <h2 id="about-disclaimer-heading" className="text-sm uppercase tracking-[0.18em] text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {intl.formatMessage({ id: "about.disclaimer.title" })}
            </h2>
            <p className="text-sm text-foreground">
              {intl.formatMessage({ id: "about.disclaimer.body" })}
            </p>
          </div>
        </aside>
      </header>

      {/* §4 Two frameworks */}
      <section aria-labelledby="about-frameworks-heading" className="space-y-6">
        <h2 id="about-frameworks-heading" className="text-2xl text-foreground" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
          {intl.formatMessage({ id: "about.frameworks.heading" })}
        </h2>
        <p className="max-w-2xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "about.frameworks.caption" })}
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <ReferenceCard
            name={intl.formatMessage({ id: "about.frameworks.sprind.name" })}
            subtitle={intl.formatMessage({ id: "about.frameworks.sprind.subtitle" })}
            quote="Legal norms will not only be published as analogue legal text, but also as official executable and machine-readable legal code."
            attribution={intl.formatMessage({ id: "about.frameworks.sprind.attribution" })}
            externalHref="https://www.sprind.org/en/law-as-code"
            inRepoLink={{
              label: intl.formatMessage({ id: "about.frameworks.sprind.mapping_link" }),
              href: "https://github.com/your-org/61-GovOps/blob/main/docs/design/LAW-AS-CODE.md",
            }}
          />
          <ReferenceCard
            name={intl.formatMessage({ id: "about.frameworks.agentic.name" })}
            subtitle={intl.formatMessage({ id: "about.frameworks.agentic.subtitle" })}
            quote="Government agents must operate with complete transparency where private sector applications tolerate opacity. Citizens need to understand not just decisions but reasoning."
            attribution={intl.formatMessage({ id: "about.frameworks.agentic.attribution" })}
            claim={intl.formatMessage({ id: "about.frameworks.agentic.claim" })}
            externalHref="https://agenticstate.org/paper.html"
          />
        </div>
      </section>

      {/* …§2, §3, §5, §6, §7, §8, §9, §10, §11 follow the same pattern… */}

      <BrandingCheck />
    </div>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: not_applicable
copy_keys:
  # §1 Hero + disclaimer
  - about.title                              # KEPT — revise to "About GovOps" if not already
  - about.lede                               # REVISE — one paragraph framing GovOps as "open public-good Law-as-Code reference implementation"
  - about.disclaimer.title                   # NEW — short label, e.g. "Independent prototype"
  - about.disclaimer.body                    # NEW — full disclaimer copy per §1 acceptance

  # §2 What GovOps does
  - about.intro.heading                      # NEW
  - about.intro.body                         # NEW — 60–100 words

  # §3 FKTE pipeline
  - about.fkte.heading                       # NEW
  - about.fkte.caption                       # NEW — "Fractal Knowledge Transformation Engine: every artefact moves through these four states with traceability preserved at every step."
  - about.fkte.aria_label                    # NEW — screen-reader description of the diagram
  - about.fkte.unstructured                  # NEW — "Unstructured" (in source language)
  - about.fkte.structured                    # NEW — "Structured"
  - about.fkte.executable                    # NEW — "Executable"
  - about.fkte.operational                   # NEW — "Operational"

  # §4 Frameworks
  - about.frameworks.heading                 # NEW — "Two frameworks GovOps takes seriously"
  - about.frameworks.caption                 # NEW — one-line intro
  - about.frameworks.sprind.name             # NEW — "SPRIND Law as Code (Germany)"
  - about.frameworks.sprind.subtitle         # NEW — "German Federal Agency for Disruptive Innovation"
  - about.frameworks.sprind.attribution      # NEW — "SPRIND Law as Code project page · headed by Dr. Hakke Hansen, LL.M. and Jörg Resch"
  - about.frameworks.sprind.mapping_link     # NEW — "Five-element mapping →"
  - about.frameworks.agentic.name            # NEW — "The Agentic State"
  - about.frameworks.agentic.subtitle        # NEW — "Tallinn Digital Summit, 2025"
  - about.frameworks.agentic.attribution     # NEW — "Ilves, Kilian, Parazzoli, Peixoto & Velsberg (2025), §1 Public Service Design & UX, v1.0.1"
  - about.frameworks.agentic.claim           # NEW — "GovOps is a working implementation of Layer 3 (Policy & Rule-Making) and Layer 7 (Agent Governance)."

  # §5 Authority chain
  - about.chain.heading                      # NEW
  - about.chain.caption                      # NEW
  - about.chain.aria_label                   # NEW
  - about.chain.jurisdiction
  - about.chain.constitution
  - about.chain.authority
  - about.chain.law
  - about.chain.regulation
  - about.chain.program
  - about.chain.service
  - about.chain.decision

  # §6 Operating principles (expanded from current 3 → 6)
  - about.principles.title                   # KEPT
  - about.principles.decision_support        # NEW
  - about.principles.evidence_first          # NEW
  - about.principles.traceability            # NEW
  - about.principles.reproducibility         # NEW
  - about.principles.human_in_loop           # NEW
  - about.principles.open_forkable           # NEW
  # the existing about.principles.{provenance,bilingual,auditability} can stay or be retired — your call

  # §7 Statute meets System (KEPT verbatim)
  - about.philosophy.title                   # KEPT
  - about.philosophy.body                    # KEPT

  # §8 Provenance ribbons (KEPT verbatim)
  - about.ribbons.title                      # KEPT
  - about.ribbons.caption                    # KEPT
  - about.ribbons.example.agent              # KEPT
  - about.ribbons.example.human              # KEPT
  - about.ribbons.example.hybrid             # KEPT
  - about.ribbons.example.system             # KEPT
  - about.ribbons.example.citizen            # KEPT

  # §9 What this is NOT
  - about.not.heading                        # NEW
  - about.not.autonomous                     # NEW
  - about.not.replacement                    # NEW
  - about.not.hidden_reasoning               # NEW
  - about.not.political_judgment             # NEW

  # §10 Read deeper
  - about.deeper.heading                     # NEW
  - about.deeper.in_repo_label               # NEW
  - about.deeper.external_label              # NEW
  - about.deeper.plan                        # NEW — "Execution plan (PLAN.md)"
  - about.deeper.idea                        # NEW — "Strategic vision (IDEA-GovOps-v2.0-LawAsCode.md)"
  - about.deeper.lawcode_mapping             # NEW — "SPRIND five-element mapping (LAW-AS-CODE.md)"
  - about.deeper.adrs                        # NEW — "Architecture decisions (ADRs/)"
  - about.deeper.lawcode_artefacts           # NEW — "Live legal-code artefacts (lawcode/)"
  - about.deeper.schema                      # NEW — "Schema (configvalue-v1.0.json)"
  - about.deeper.aligned                     # NEW — "Aligned initiatives (aligned-initiatives.md)"
  - about.deeper.sprind                      # NEW — "SPRIND Law as Code"
  - about.deeper.agentic                     # NEW — "The Agentic State paper"

  # §11 Origin and lineage
  - about.origin.heading                     # NEW
  - about.origin.body                        # NEW — multi-paragraph; references both Agentic State (5-author) + SPRIND
```

ICU plurals are not used on this page; all strings are static labels and
short prose.

## a11y

```yaml
contrast: AA                                 # preserved — uses existing tokens only
focus_visible: required                      # all links/buttons keep the focus ring
keyboard:
  - Tab through links in source order
  - External links open in new tab on Enter (default browser behaviour)
aria_live: not_applicable                    # static page
reduced_motion: respect                      # any transitions on reference cards / diagrams respect prefers-reduced-motion
landmarks:
  - Each numbered section is a <section aria-labelledby="about-§N-heading">
  - The disclaimer card is an <aside aria-labelledby="about-disclaimer-heading"> inside §1
diagram_a11y:
  - PipelineDiagram and AuthorityChainDiagram both have role="img" + aria-label describing the chain in words
  - The visual arrows are aria-hidden="true"
external_links:
  - All carry ↗ icon (lucide ExternalLink at size 12, aria-hidden="true")
  - target="_blank" rel="noopener noreferrer"
quote_semantics:
  - <blockquote> for both reference quotes
  - Source attribution in <footer> immediately following each quote
```

provenance: human
  # The page itself is a human-authored framing document, not engine output

## Out of scope

- Adding new locales (PLAN forbids during structural work)
- Adding new color tokens or design primitives
- Translating the verbatim reference quotes (they ship in original English)
- Any backend changes (the page is purely client-side)
- A "contact us" form, newsletter signup, or any solicitation
- Linking out to all 10+ peer projects from `/about` directly — those live in [`docs/aligned-initiatives.md`](aligned-initiatives.md), reachable via §10
- A Markdown-rendered embed of `LAW-AS-CODE.md` inside the page — link only, do not embed
- Animation / motion design beyond what already exists; no new transitions
- Adding a screenshot, logo, or external image to the SPRIND or Agentic State cards — text-only, no logos (which would imply endorsement)
- Replacing the existing wordmark / hero treatment from govops-001
