import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { runCheck } from "@/lib/api";
import type {
  CheckProgramResult,
  CheckRequest,
  CheckResponse,
} from "@/lib/types";
import { BenefitTimeline } from "@/components/govops/BenefitTimeline";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { t, localeFromMatches } from "@/lib/head-i18n";

const ACTIVE_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua", "jp"] as const;
const SUPPORTED_EVENTS = ["job_loss"] as const;

type LifeEventSearch = {
  jurisdiction?: (typeof ACTIVE_JURISDICTIONS)[number];
  event?: (typeof SUPPORTED_EVENTS)[number];
};

export const Route = createFileRoute("/check/life-event")({
  validateSearch: (s: Record<string, unknown>): LifeEventSearch => ({
    jurisdiction:
      typeof s.jurisdiction === "string" &&
      (ACTIVE_JURISDICTIONS as readonly string[]).includes(s.jurisdiction)
        ? (s.jurisdiction as LifeEventSearch["jurisdiction"])
        : undefined,
    event:
      typeof s.event === "string" &&
      (SUPPORTED_EVENTS as readonly string[]).includes(s.event)
        ? (s.event as LifeEventSearch["event"])
        : undefined,
  }),
  component: LifeEventPage,
  head: ({ matches }) => {
    const l = localeFromMatches(matches);
    return {
      meta: [
        { title: t("check.lifeEvent.heading", l) },
        { name: "description", content: t("check.lifeEvent.lede", l) },
      ],
    };
  },
});

function defaultResidencyCountry(jur: string): string {
  const map: Record<string, string> = {
    ca: "Canada",
    br: "Brazil",
    es: "Spain",
    fr: "France",
    de: "Germany",
    ua: "Ukraine",
    jp: "Japan",
  };
  return map[jur] ?? "Canada";
}

/**
 * Phase G citizen life-event reassessment example.
 *
 * v3 ships ONE life event by design (charter §"Citizen surface explicitly
 * capped"). The supported event is `job_loss` → EI reassessment, which
 * is the proof point for the bounded-duration timeline component. Adding
 * more life events (move, retirement, divorce, child) is v4 work.
 *
 * The route reads jurisdiction + event from the URL query, builds a
 * synthetic CheckRequest pre-filled to the "just lost my job" scenario,
 * runs `/api/check`, and renders the EI program result with the
 * BenefitTimeline. Renders nothing for unsupported jurisdictions
 * (specifically JP — no EI manifest by design).
 */
function LifeEventPage() {
  const intl = useIntl();
  const search = Route.useSearch();
  const jurisdiction = search.jurisdiction ?? "ca";
  const event = search.event ?? "job_loss";
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);

    const today = new Date();
    const dob = new Date(today.getFullYear() - 35, 4, 15)
      .toISOString()
      .slice(0, 10);
    const residencyStart = new Date(today.getFullYear() - 35, 4, 15)
      .toISOString()
      .slice(0, 10);

    const payload: CheckRequest = {
      jurisdiction_id: jurisdiction,
      date_of_birth: dob,
      legal_status: "citizen",
      residency_periods: [
        {
          country: defaultResidencyCountry(jurisdiction),
          start_date: residencyStart,
        },
      ],
      evidence_present: {
        dob: true,
        residency: true,
        job_loss: event === "job_loss",
      },
      programs: ["ei"],
    };

    runCheck(payload)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jurisdiction, event]);

  const eiResult = result?.programs.find((p) => p.program_id === "ei") ?? null;

  return (
    <section aria-labelledby="life-event-heading" className="space-y-8">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="citizen" />
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "check.lifeEvent.eyebrow" })}
          </p>
          <h1
            id="life-event-heading"
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "check.lifeEvent.heading" })}
          </h1>
          <p className="max-w-2xl text-base text-foreground-muted">
            {intl.formatMessage({ id: "check.lifeEvent.lede" })}
          </p>
        </div>
      </header>

      <ScenarioSummary jurisdiction={jurisdiction} event={event} />

      {loading && (
        <p className="text-sm text-foreground-muted" data-testid="life-event-loading">
          {intl.formatMessage({ id: "check.loading" })}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-border bg-surface-sunken p-4"
          data-testid="life-event-error"
        >
          <p className="text-sm font-medium text-foreground">
            {intl.formatMessage({ id: "check.error.title" })}
          </p>
          <p className="text-xs text-foreground-muted">{error}</p>
        </div>
      )}

      {eiResult && <EiReassessment program={eiResult} />}

      {result && !eiResult && (
        <p
          className="rounded-md border border-border bg-surface-sunken p-4 text-sm text-foreground-muted"
          role="status"
          data-testid="life-event-no-ei"
        >
          {intl.formatMessage(
            { id: "check.lifeEvent.noEi" },
            { jurisdiction: result.jurisdiction_label },
          )}
        </p>
      )}

      <Link
        to="/check"
        className="inline-block text-sm text-foreground-muted underline"
      >
        {intl.formatMessage({ id: "check.lifeEvent.backToEntry" })}
      </Link>
    </section>
  );
}

function ScenarioSummary({
  jurisdiction,
  event,
}: {
  jurisdiction: string;
  event: string;
}) {
  const intl = useIntl();
  return (
    <dl
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      data-testid="life-event-scenario"
    >
      <div className="rounded-md border border-border bg-surface p-4">
        <dt className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
          {intl.formatMessage({ id: "check.lifeEvent.scenario.jurisdiction" })}
        </dt>
        <dd
          className="mt-1 text-base text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {jurisdiction}
        </dd>
      </div>
      <div className="rounded-md border border-border bg-surface p-4">
        <dt className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
          {intl.formatMessage({ id: "check.lifeEvent.scenario.event" })}
        </dt>
        <dd
          className="mt-1 text-base text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: `check.lifeEvent.event.${event}` })}
        </dd>
      </div>
    </dl>
  );
}

function EiReassessment({ program }: { program: CheckProgramResult }) {
  const intl = useIntl();
  return (
    <article
      aria-labelledby="ei-reassessment-heading"
      className="space-y-4 rounded-md border border-border bg-surface p-5"
      data-testid="life-event-ei-result"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="ei-reassessment-heading"
          className="text-2xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {program.program_name}
        </h2>
        <p
          className="text-xs uppercase tracking-[0.15em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="life-event-outcome"
        >
          {intl.formatMessage(
            { id: `check.outcome.${program.outcome}` },
            undefined,
            { ignoreTag: true },
          ) || program.outcome}
        </p>
      </header>

      {program.benefit_period && <BenefitTimeline period={program.benefit_period} />}

      {program.active_obligations.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.obligations.heading" })}
          </h3>
          <ul className="space-y-2 text-sm text-foreground-muted">
            {program.active_obligations.map((o) => (
              <li key={o.obligation_id}>
                <p>{o.description}</p>
                <p
                  className="text-xs text-foreground-subtle"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {o.citation}
                  {o.cadence ? ` · ${o.cadence}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {program.missing_evidence.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.missing.heading" })}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            {program.missing_evidence.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
