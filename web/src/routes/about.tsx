import { createFileRoute } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ExternalLink } from "lucide-react";
import {
  ProvenanceRibbon,
  type ProvenanceVariant,
} from "@/components/govops/ProvenanceRibbon";
import { BrandingCheck } from "@/components/govops/BrandingCheck";
import { ReferenceCard } from "@/components/govops/ReferenceCard";
import { PipelineDiagram } from "@/components/govops/PipelineDiagram";
import { AuthorityChainDiagram } from "@/components/govops/AuthorityChainDiagram";

/**
 * Repo base for in-repo doc links. Markdown files are not served by the SPA,
 * so they point at the GitHub render. Override at build time via
 * `VITE_REPO_BASE_URL` if the canonical repo URL changes.
 */
const REPO_BASE =
  (import.meta.env.VITE_REPO_BASE_URL as string | undefined) ??
  "https://github.com/your-org/61-GovOps/blob/main";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — GovOps" },
      {
        name: "description",
        content:
          "GovOps is an independent open-source Law-as-Code reference implementation: legislation translated into deterministic, auditable, jurisdiction-aware software with full provenance from decision to source authority.",
      },
      { property: "og:title", content: "About — GovOps" },
      {
        property: "og:description",
        content:
          "Independent open-source Law-as-Code reference implementation. Six jurisdictions, six languages, deterministic engine, full audit trail.",
      },
    ],
  }),
  component: About,
});

const RIBBON_EXAMPLES: { variant: Exclude<ProvenanceVariant, "none">; key: string }[] = [
  { variant: "agent", key: "about.ribbons.example.agent" },
  { variant: "human", key: "about.ribbons.example.human" },
  { variant: "hybrid", key: "about.ribbons.example.hybrid" },
  { variant: "system", key: "about.ribbons.example.system" },
  { variant: "citizen", key: "about.ribbons.example.citizen" },
];

const PRINCIPLES: { id: string; variant: Exclude<ProvenanceVariant, "none"> }[] = [
  { id: "about.principles.decision_support", variant: "human" },
  { id: "about.principles.evidence_first", variant: "hybrid" },
  { id: "about.principles.traceability", variant: "agent" },
  { id: "about.principles.reproducibility", variant: "system" },
  { id: "about.principles.human_in_loop", variant: "human" },
  { id: "about.principles.open_forkable", variant: "citizen" },
];

const NOT_ITEMS = [
  "about.not.autonomous",
  "about.not.replacement",
  "about.not.hidden_reasoning",
  "about.not.political_judgment",
] as const;

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontWeight: 600,
};
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };

function ExternalAnchor({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-authority hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
    >
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function InRepoAnchor({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-authority hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
    >
      {children}
    </a>
  );
}

function About() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  return (
    <div className="space-y-14">
      {/* §1 Hero + Disclaimer card --------------------------------------- */}
      <header className="space-y-6">
        <div className="flex items-stretch">
          <ProvenanceRibbon variant="human" />
          <div className="space-y-4">
            <p
              className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
              style={MONO}
            >
              about · govops
            </p>
            <h1
              className="text-4xl tracking-tight text-foreground sm:text-5xl"
              style={SERIF}
            >
              {t("about.title")}
            </h1>
            <p className="max-w-2xl text-lg text-foreground-muted">
              {t("about.lede")}
            </p>
          </div>
        </div>
        <aside
          aria-labelledby="about-disclaimer-heading"
          className="flex items-stretch rounded-lg border-2 border-border bg-surface-sunken"
        >
          <ProvenanceRibbon variant="human" />
          <div className="p-5 space-y-2">
            <h2
              id="about-disclaimer-heading"
              className="text-sm uppercase tracking-[0.18em] text-foreground"
              style={MONO}
            >
              {t("about.disclaimer.title")}
            </h2>
            <p className="text-sm text-foreground">
              {t("about.disclaimer.body")}
            </p>
          </div>
        </aside>
      </header>

      {/* §2 What GovOps does --------------------------------------------- */}
      <section aria-labelledby="about-intro-heading" className="space-y-4">
        <h2 id="about-intro-heading" className="text-2xl text-foreground" style={SERIF}>
          {t("about.intro.heading")}
        </h2>
        <p className="max-w-3xl text-base leading-relaxed text-foreground">
          {t("about.intro.body")}
        </p>
      </section>

      {/* §3 FKTE pipeline ------------------------------------------------- */}
      <section aria-labelledby="about-fkte-heading" className="space-y-4">
        <h2 id="about-fkte-heading" className="text-2xl text-foreground" style={SERIF}>
          {t("about.fkte.heading")}
        </h2>
        <PipelineDiagram />
      </section>

      {/* §4 Two frameworks ----------------------------------------------- */}
      <section aria-labelledby="about-frameworks-heading" className="space-y-6">
        <div className="space-y-2">
          <h2
            id="about-frameworks-heading"
            className="text-2xl text-foreground"
            style={SERIF}
          >
            {t("about.frameworks.heading")}
          </h2>
          <p className="max-w-3xl text-sm text-foreground-muted">
            {t("about.frameworks.caption")}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <ReferenceCard
            name={t("about.frameworks.sprind.name")}
            subtitle={t("about.frameworks.sprind.subtitle")}
            quote="Legal norms will not only be published as analogue legal text, but also as official executable and machine-readable legal code."
            attribution={t("about.frameworks.sprind.attribution")}
            externalHref="https://www.sprind.org/en/law-as-code"
            inRepoLink={{
              label: t("about.frameworks.sprind.mapping_link"),
              href: `${REPO_BASE}/docs/design/LAW-AS-CODE.md`,
            }}
          />
          <ReferenceCard
            name={t("about.frameworks.agentic.name")}
            subtitle={t("about.frameworks.agentic.subtitle")}
            quote="Government agents must operate with complete transparency where private sector applications tolerate opacity. Citizens need to understand not just decisions but reasoning."
            attribution={t("about.frameworks.agentic.attribution")}
            claim={t("about.frameworks.agentic.claim")}
            externalHref="https://agenticstate.org/paper.html"
          />
        </div>
      </section>

      {/* §5 Jurisdiction-first chain ------------------------------------- */}
      <section aria-labelledby="about-chain-heading" className="space-y-4">
        <h2 id="about-chain-heading" className="text-2xl text-foreground" style={SERIF}>
          {t("about.chain.heading")}
        </h2>
        <AuthorityChainDiagram />
      </section>

      {/* §6 Operating principles ----------------------------------------- */}
      <section aria-labelledby="about-principles-heading" className="space-y-4">
        <h2
          id="about-principles-heading"
          className="text-2xl text-foreground"
          style={SERIF}
        >
          {t("about.principles.title")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <li
              key={p.id}
              className="flex items-stretch rounded-lg border border-border bg-surface p-5"
            >
              <ProvenanceRibbon variant={p.variant} />
              <p className="text-sm leading-relaxed text-foreground">{t(p.id)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* §7 Statute meets System (KEPT) ---------------------------------- */}
      <section
        aria-labelledby="about-philosophy-heading"
        className="grid gap-10 md:grid-cols-[1fr_1.4fr]"
      >
        <div className="flex items-stretch">
          <ProvenanceRibbon variant="hybrid" />
          <div>
            <h2
              id="about-philosophy-heading"
              className="text-2xl text-foreground"
              style={SERIF}
            >
              {t("about.philosophy.title")}
            </h2>
            <p
              className="mt-2 text-xs uppercase tracking-[0.18em] text-foreground-subtle"
              style={MONO}
            >
              statute · system
            </p>
          </div>
        </div>
        <p className="text-base leading-relaxed text-foreground">
          {t("about.philosophy.body")}
        </p>
      </section>

      {/* §8 Provenance ribbons (KEPT) ------------------------------------ */}
      <section aria-labelledby="about-ribbons-heading">
        <h2
          id="about-ribbons-heading"
          className="text-2xl text-foreground"
          style={SERIF}
        >
          {t("about.ribbons.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          {t("about.ribbons.caption")}
        </p>
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {RIBBON_EXAMPLES.map((ex) => (
            <li key={ex.variant} className="flex items-stretch">
              <ProvenanceRibbon variant={ex.variant} />
              <div className="flex flex-1 flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span
                  className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
                  style={MONO}
                >
                  {ex.variant}
                </span>
                <span className="text-sm text-foreground sm:text-end">
                  {t(ex.key)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* §9 What this is NOT --------------------------------------------- */}
      <section aria-labelledby="about-not-heading" className="space-y-4">
        <h2 id="about-not-heading" className="text-2xl text-foreground" style={SERIF}>
          {t("about.not.heading")}
        </h2>
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {NOT_ITEMS.map((id) => (
            <li
              key={id}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <span
                className="text-xs uppercase tracking-[0.18em] text-foreground-subtle line-through"
                style={MONO}
                aria-hidden="true"
              >
                {t(id)}
              </span>
              <span className="text-sm text-foreground">{t(id)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* §10 Read deeper -------------------------------------------------- */}
      <section aria-labelledby="about-deeper-heading" className="space-y-4">
        <h2 id="about-deeper-heading" className="text-2xl text-foreground" style={SERIF}>
          {t("about.deeper.heading")}
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3
              className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
              style={MONO}
            >
              {t("about.deeper.in_repo_label")}
            </h3>
            <ul className="mt-3 space-y-2">
              {[
                { key: "about.deeper.plan", path: "PLAN.md" },
                { key: "about.deeper.idea", path: "IDEA-GovOps-v2.0-LawAsCode.md" },
                { key: "about.deeper.lawcode_mapping", path: "docs/design/LAW-AS-CODE.md" },
                { key: "about.deeper.adrs", path: "docs/adr/" },
                { key: "about.deeper.lawcode_artefacts", path: "lawcode/" },
                { key: "about.deeper.schema", path: "schema/configvalue-v1.0.json" },
                { key: "about.deeper.aligned", path: "docs/aligned-initiatives.md" },
              ].map((l) => (
                <li key={l.key}>
                  <InRepoAnchor href={`${REPO_BASE}/${l.path}`}>
                    {t(l.key)}
                  </InRepoAnchor>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3
              className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
              style={MONO}
            >
              {t("about.deeper.external_label")}
            </h3>
            <ul className="mt-3 space-y-2">
              <li>
                <ExternalAnchor href="https://www.sprind.org/en/law-as-code">
                  {t("about.deeper.sprind")}
                </ExternalAnchor>
              </li>
              <li>
                <ExternalAnchor href="https://agenticstate.org/paper.html">
                  {t("about.deeper.agentic")}
                </ExternalAnchor>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* §11 Origin and lineage ------------------------------------------ */}
      <section aria-labelledby="about-origin-heading" className="space-y-4">
        <h2 id="about-origin-heading" className="text-2xl text-foreground" style={SERIF}>
          {t("about.origin.heading")}
        </h2>
        <p className="max-w-3xl text-base leading-relaxed text-foreground">
          {t("about.origin.body")}
        </p>
      </section>

      {/* §12 BrandingCheck (KEPT) ---------------------------------------- */}
      <BrandingCheck />
    </div>
  );
}
