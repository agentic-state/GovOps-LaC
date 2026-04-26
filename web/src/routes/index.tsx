import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useIntl, FormattedMessage } from "react-intl";
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

      {/* Three pillars */}
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
