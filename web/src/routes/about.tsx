import { createFileRoute } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ProvenanceRibbon, type ProvenanceVariant } from "@/components/govops/ProvenanceRibbon";
import { BrandingCheck } from "@/components/govops/BrandingCheck";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — GovOps" },
      {
        name: "description",
        content:
          "About GovOps and the Statute meets System philosophy: an agentic, multilingual platform for law-as-code with readable provenance.",
      },
      { property: "og:title", content: "About — GovOps" },
      {
        property: "og:description",
        content: "Statute meets System: agentic law-as-code with readable provenance.",
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

function About() {
  const intl = useIntl();

  return (
    <div className="space-y-14">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="human" />
        <div className="space-y-4">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            spec · govops
          </p>
          <h1
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "about.title" })}
          </h1>
          <p className="max-w-2xl text-lg text-foreground-muted">
            {intl.formatMessage({ id: "about.lede" })}
          </p>
        </div>
      </header>

      <section className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div className="flex items-stretch">
          <ProvenanceRibbon variant="hybrid" />
          <div>
            <h2
              className="text-2xl text-foreground"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            >
              {intl.formatMessage({ id: "about.philosophy.title" })}
            </h2>
            <p
              className="mt-2 text-xs uppercase tracking-[0.18em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              statute · system
            </p>
          </div>
        </div>
        <p className="text-base leading-relaxed text-foreground">
          {intl.formatMessage({ id: "about.philosophy.body" })}
        </p>
      </section>

      <section>
        <h2
          className="text-2xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "about.principles.title" })}
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { id: "about.principles.provenance", variant: "agent" as const },
            { id: "about.principles.bilingual", variant: "citizen" as const },
            { id: "about.principles.auditability", variant: "human" as const },
          ].map((p) => (
            <li
              key={p.id}
              className="flex items-stretch rounded-lg border border-border bg-surface p-5"
            >
              <ProvenanceRibbon variant={p.variant} />
              <p className="text-sm leading-relaxed text-foreground">
                {intl.formatMessage({ id: p.id })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2
          className="text-2xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "about.ribbons.title" })}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          {intl.formatMessage({ id: "about.ribbons.caption" })}
        </p>
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {RIBBON_EXAMPLES.map((ex) => (
            <li key={ex.variant} className="flex items-stretch">
              <ProvenanceRibbon variant={ex.variant} />
              <div className="flex flex-1 flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span
                  className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {ex.variant}
                </span>
                <span className="text-sm text-foreground sm:text-end">
                  {intl.formatMessage({ id: ex.key })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <BrandingCheck />
    </div>
  );
}
