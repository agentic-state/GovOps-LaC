import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useIntl, FormattedMessage } from "react-intl";
import { Users, ScrollText, Building2 } from "lucide-react";
import { Wordmark } from "@/components/govops/Wordmark";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { MOCK_CONFIG_VALUES } from "@/lib/mock-config-values";
import { ValueTypeBadge } from "@/components/govops/ValueTypeBadge";
import { JurisdictionChip } from "@/components/govops/JurisdictionChip";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GovOps — Law as code, with provenance you can read" },
      {
        name: "description",
        content:
          "Agentic, multilingual law-as-code: drafted by agents, ratified by humans, auditable by citizens.",
      },
      { property: "og:title", content: "GovOps — Law as code" },
    ],
  }),
  component: Index,
});

type PersonaConfig = {
  id: string;
  anchor: string;
  variant: "citizen" | "agent" | "human";
  accent: "neutral" | "agentic" | "authority";
  Icon: typeof Users;
  primaryHref: string;
  secondaryHref: string;
};

const PERSONAS = {
  citizens: {
    id: "citizens",
    anchor: "citizens",
    variant: "citizen",
    accent: "neutral",
    Icon: Users,
    primaryHref: "/config",
    secondaryHref: "/cases",
  },
  servants: {
    id: "servants",
    anchor: "servants",
    variant: "agent",
    accent: "agentic",
    Icon: ScrollText,
    primaryHref: "/config/approvals",
    secondaryHref: "/encode",
  },
  leaders: {
    id: "leaders",
    anchor: "leaders",
    variant: "human",
    accent: "authority",
    Icon: Building2,
    primaryHref: "/authority",
    secondaryHref: "/about",
  },
} satisfies Record<string, PersonaConfig>;

function PersonaSection({
  persona,
  prefix,
  showEngageBlock = false,
}: {
  persona: PersonaConfig;
  prefix: string;
  showEngageBlock?: boolean;
}) {
  const intl = useIntl();
  const { Icon, accent, anchor, variant, primaryHref, secondaryHref } = persona;
  const accentVar =
    accent === "agentic"
      ? "var(--agentic)"
      : accent === "authority"
      ? "var(--authority)"
      : "var(--foreground-muted)";

  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-heading`}
      className="scroll-mt-24 flex items-stretch"
    >
      <ProvenanceRibbon variant={variant} />
      <div className="w-full space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Icon className="size-5 shrink-0" style={{ color: accentVar }} aria-hidden />
            <p
              className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id: `${prefix}.eyebrow` })}
            </p>
          </div>
          <h2
            id={`${anchor}-heading`}
            className="text-3xl leading-tight tracking-tight text-foreground sm:text-4xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: `${prefix}.heading` })}
          </h2>
          <p className="max-w-3xl text-lg text-foreground-muted">
            {intl.formatMessage({ id: `${prefix}.lead` })}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <article
              key={n}
              className="rounded-md border border-border bg-surface p-5"
              style={{ borderTopWidth: "3px", borderTopColor: accentVar }}
            >
              <h3
                className="text-base font-medium text-foreground"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {intl.formatMessage({ id: `${prefix}.card${n}.title` })}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {intl.formatMessage({ id: `${prefix}.card${n}.body` })}
              </p>
            </article>
          ))}
        </div>

        {showEngageBlock ? (
          <div className="rounded-md border border-border bg-surface-sunken p-6">
            <h3
              className="text-lg font-medium text-foreground"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {intl.formatMessage({ id: `${prefix}.engage.heading` })}
            </h3>
            <ol className="mt-4 grid gap-4 md:grid-cols-3" role="list">
              {([1, 2, 3] as const).map((n) => (
                <li
                  key={n}
                  className="rounded-md border border-border bg-surface p-4"
                >
                  <p
                    className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {`0${n}`}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {intl.formatMessage({
                      id: `${prefix}.engage.option${n}.title`,
                    })}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                    {intl.formatMessage({
                      id: `${prefix}.engage.option${n}.body`,
                    })}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to={primaryHref}
            className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {intl.formatMessage({ id: `${prefix}.cta.primary` })}
          </Link>
          <Link
            to={secondaryHref}
            className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
          >
            {intl.formatMessage({ id: `${prefix}.cta.secondary` })}
          </Link>
        </div>
      </div>
    </section>
  );
}

function PersonasNav() {
  const intl = useIntl();
  const items = [
    { href: "#citizens", id: "home.personas.nav.citizens", Icon: Users, accent: "var(--foreground-muted)" },
    { href: "#servants", id: "home.personas.nav.servants", Icon: ScrollText, accent: "var(--agentic)" },
    { href: "#leaders", id: "home.personas.nav.leaders", Icon: Building2, accent: "var(--authority)" },
  ];
  return (
    <nav
      aria-labelledby="personas-nav-heading"
      className="rounded-md border border-border bg-surface p-5"
    >
      <p
        id="personas-nav-heading"
        className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "home.personas.nav.heading" })}
      </p>
      <ul className="mt-3 flex flex-wrap gap-3" role="list">
        {items.map(({ href, id, Icon, accent }) => (
          <li key={href}>
            <a
              href={href}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-sunken px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/40"
            >
              <Icon className="size-4" style={{ color: accent }} aria-hidden />
              {intl.formatMessage({ id })}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Index() {
  const intl = useIntl();
  const preview = MOCK_CONFIG_VALUES.slice(0, 4);

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section aria-labelledby="home-heading" className="flex items-stretch">
        <ProvenanceRibbon variant="hybrid" />
        <div className="space-y-6">
          <p
            className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "home.eyebrow" })}
          </p>
          <h1
            id="home-heading"
            className="text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            <Wordmark className="text-[1em]" />
            <span className="block mt-3">
              {intl.formatMessage({ id: "home.headline.before" })}
              <span style={{ color: "var(--agentic)" }}>
                {intl.formatMessage({ id: "home.headline.accent" })}
              </span>
              {intl.formatMessage({ id: "home.headline.after" })}
            </span>
          </h1>
          <p className="max-w-2xl text-lg text-foreground-muted">
            {intl.formatMessage({ id: "home.lede" })}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/config"
              className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {intl.formatMessage({ id: "home.cta.config" })}
            </Link>
            <Link
              to="/about"
              className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
            >
              {intl.formatMessage({ id: "home.cta.about" })}
            </Link>
          </div>
        </div>
      </section>

      {/* Three pillars (universal) */}
      <section aria-labelledby="pillars-heading" className="space-y-6">
        <h2
          id="pillars-heading"
          className="text-2xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "home.pillars.title" })}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["agent", "human", "citizen"] as const).map((variant) => (
            <article
              key={variant}
              className="flex items-stretch rounded-md border border-border bg-surface p-5"
            >
              <ProvenanceRibbon variant={variant} />
              <div className="space-y-2">
                <h3
                  className="text-base font-medium text-foreground"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {intl.formatMessage({ id: `home.pillars.${variant}.title` })}
                </h3>
                <p className="text-sm text-foreground-muted">
                  {intl.formatMessage({ id: `home.pillars.${variant}.body` })}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Persona navigation pills */}
      <PersonasNav />

      {/* Persona sections */}
      <PersonaSection persona={PERSONAS.citizens} prefix="home.personas.citizens" />
      <PersonaSection persona={PERSONAS.servants} prefix="home.personas.servants" />
      <PersonaSection
        persona={PERSONAS.leaders}
        prefix="home.personas.leaders"
        showEngageBlock
      />

      {/* Live registry preview */}
      <section aria-labelledby="preview-heading" className="flex items-stretch">
        <ProvenanceRibbon variant="system" />
        <div className="w-full space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p
                className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                config · v1
              </p>
              <h2
                id="preview-heading"
                className="text-2xl tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
              >
                {intl.formatMessage({ id: "home.preview.title" })}
              </h2>
              <p className="max-w-2xl text-sm text-foreground-muted">
                {intl.formatMessage({ id: "home.preview.caption" })}
              </p>
            </div>
            <Link
              to="/config"
              className="text-sm font-medium text-foreground hover:underline"
              style={{ color: "var(--agentic)" }}
            >
              {intl.formatMessage({ id: "home.preview.cta" })}
            </Link>
          </div>

          <ul role="list" className="space-y-2">
            {preview.map((cv) => {
              const valuePreview =
                typeof cv.value === "object" ? JSON.stringify(cv.value) : String(cv.value);
              return (
                <li
                  key={cv.id}
                  className="flex items-stretch rounded-md border border-border bg-surface px-4 py-3"
                >
                  <ProvenanceRibbon variant={cv.author?.startsWith("agent:") ? "agent" : "human"} />
                  <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <code
                      className="truncate text-sm text-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {cv.key}
                    </code>
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <span
                        className="truncate max-w-[14rem]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {valuePreview}
                      </span>
                      <ValueTypeBadge type={cv.value_type} />
                      <JurisdictionChip id={cv.jurisdiction_id} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <p
        className="text-center text-xs uppercase tracking-[0.2em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <FormattedMessage id="home.footnote" />
      </p>
    </div>
  );
}
