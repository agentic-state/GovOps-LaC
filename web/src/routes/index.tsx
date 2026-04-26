import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useIntl, FormattedMessage } from "react-intl";
import {
  ArrowRight,
  Users,
  ScrollText,
  Building2,
  Database,
  Network,
  ShieldCheck,
  Cog,
  GitBranch,
  FileCheck,
} from "lucide-react";
import { Wordmark } from "@/components/govops/Wordmark";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { DataFlowDiagram } from "@/components/govops/DataFlowDiagram";
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
          "Open-source platform for jurisdiction-as-code: drafted by agents, ratified by humans, auditable by citizens.",
      },
      { property: "og:title", content: "GovOps — Law as code" },
    ],
  }),
  component: Index,
});

const MODULES = [
  { id: "substrate", Icon: Database, accent: "neutral" },
  { id: "encoder", Icon: ScrollText, accent: "agentic" },
  { id: "engine", Icon: Cog, accent: "neutral" },
  { id: "approvals", Icon: FileCheck, accent: "authority" },
  { id: "audit", Icon: ShieldCheck, accent: "authority" },
  { id: "schema", Icon: GitBranch, accent: "neutral" },
  { id: "federation", Icon: Network, accent: "agentic" },
] as const;

const ACTORS = [
  { id: "agents", Icon: ScrollText, variant: "agent", accent: "agentic" },
  { id: "servants", Icon: FileCheck, variant: "human", accent: "authority" },
  { id: "citizens", Icon: Users, variant: "citizen", accent: "neutral" },
  { id: "leaders", Icon: Building2, variant: "human", accent: "authority" },
] as const;

function accentVar(accent: "agentic" | "authority" | "neutral") {
  if (accent === "agentic") return "var(--agentic)";
  if (accent === "authority") return "var(--authority)";
  return "var(--foreground-muted)";
}

function Index() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
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
            {t("home.eyebrow")}
          </p>
          <h1
            id="home-heading"
            className="text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            <Wordmark className="text-[1em]" />
            <span className="block mt-3">
              {t("home.headline.before")}
              <span style={{ color: "var(--agentic)" }}>{t("home.headline.accent")}</span>
              {t("home.headline.after")}
            </span>
          </h1>
          <p className="max-w-2xl text-lg text-foreground-muted">{t("home.lede")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/walkthrough"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("home.cta.walkthrough")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/about"
              className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
            >
              {t("home.cta.about")}
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
          {t("home.pillars.title")}
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
                  {t(`home.pillars.${variant}.title`)}
                </h3>
                <p className="text-sm text-foreground-muted">{t(`home.pillars.${variant}.body`)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Data flow diagram */}
      <section aria-labelledby="dataflow-heading" className="space-y-6">
        <h2 id="dataflow-heading" className="sr-only">
          {t("dataflow.eyebrow")}
        </h2>
        <DataFlowDiagram />
      </section>

      {/* Modules */}
      <section aria-labelledby="modules-heading" className="space-y-6">
        <div className="space-y-2">
          <p
            className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {t("home.modules.eyebrow")}
          </p>
          <h2
            id="modules-heading"
            className="text-2xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {t("home.modules.title")}
          </h2>
          <p className="max-w-3xl text-base text-foreground-muted">{t("home.modules.lead")}</p>
        </div>
        <ul role="list" className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ id, Icon, accent }) => (
            <li
              key={id}
              className="rounded-md border border-border bg-surface p-4"
              style={{ borderTopWidth: "3px", borderTopColor: accentVar(accent) }}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4" style={{ color: accentVar(accent) }} aria-hidden />
                <h3
                  className="text-sm font-medium text-foreground"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t(`home.modules.${id}.title`)}
                </h3>
              </div>
              <p className="mt-2 text-sm text-foreground-muted">
                {t(`home.modules.${id}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Actors and roles */}
      <section aria-labelledby="actors-heading" className="space-y-6">
        <div className="space-y-2">
          <p
            className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {t("home.actors.eyebrow")}
          </p>
          <h2
            id="actors-heading"
            className="text-2xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {t("home.actors.title")}
          </h2>
          <p className="max-w-3xl text-base text-foreground-muted">{t("home.actors.lead")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {ACTORS.map(({ id, Icon, variant, accent }) => (
            <article
              key={id}
              className="flex items-stretch rounded-md border border-border bg-surface p-5"
            >
              <ProvenanceRibbon variant={variant} />
              <div className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4" style={{ color: accentVar(accent) }} aria-hidden />
                  <h3
                    className="text-base font-medium text-foreground"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {t(`home.actors.${id}.title`)}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground-muted">
                  {t(`home.actors.${id}.body`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* See it in action */}
      <section
        aria-labelledby="walkthrough-cta-heading"
        className="rounded-md border border-border bg-surface-sunken p-6"
      >
        <p
          className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {t("home.walkthroughCta.eyebrow")}
        </p>
        <h2
          id="walkthrough-cta-heading"
          className="mt-2 text-2xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {t("home.walkthroughCta.heading")}
        </h2>
        <p className="mt-2 max-w-3xl text-foreground-muted">{t("home.walkthroughCta.body")}</p>
        <div className="mt-4">
          <Link
            to="/walkthrough"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("home.walkthroughCta.button")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

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
                {t("home.preview.title")}
              </h2>
              <p className="max-w-2xl text-sm text-foreground-muted">{t("home.preview.caption")}</p>
            </div>
            <Link
              to="/config"
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--agentic)" }}
            >
              {t("home.preview.cta")}
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
