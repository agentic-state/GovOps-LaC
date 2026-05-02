import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useIntl } from "react-intl";
import { runCheck } from "@/lib/api";
import type {
  CheckRequest,
  CheckResponse,
  CheckProgramResult,
} from "@/lib/types";
import { BenefitTimeline } from "@/components/govops/BenefitTimeline";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { t, localeFromMatches } from "@/lib/head-i18n";

export const Route = createFileRoute("/check")({
  component: CheckPage,
  head: ({ matches }) => {
    const l = localeFromMatches(matches);
    return {
      meta: [
        { title: t("check.heading", l) },
        { name: "description", content: t("check.lede", l) },
      ],
    };
  },
});

const ACTIVE_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua", "jp"] as const;

type Form = {
  jurisdiction_id: (typeof ACTIVE_JURISDICTIONS)[number];
  date_of_birth: string;
  legal_status: "citizen" | "permanent_resident" | "other";
  residency_country: string;
  residency_start: string;
  evidence_dob: boolean;
  evidence_residency: boolean;
  evidence_job_loss: boolean;
};

function defaultResidencyCountry(jur: Form["jurisdiction_id"]): string {
  const map: Record<string, string> = {
    ca: "Canada",
    br: "Brazil",
    es: "Spain",
    fr: "France",
    de: "Germany",
    ua: "Ukraine",
    jp: "Japan",
  };
  return map[jur] ?? "";
}

function CheckPage() {
  const intl = useIntl();
  const today = new Date();
  const defaultDob = new Date(today.getFullYear() - 67, 4, 15)
    .toISOString()
    .slice(0, 10);
  const defaultResidencyStart = new Date(today.getFullYear() - 49, 4, 15)
    .toISOString()
    .slice(0, 10);

  const [form, setForm] = useState<Form>({
    jurisdiction_id: "ca",
    date_of_birth: defaultDob,
    legal_status: "citizen",
    residency_country: "Canada",
    residency_start: defaultResidencyStart,
    evidence_dob: true,
    evidence_residency: true,
    evidence_job_loss: false,
  });
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "jurisdiction_id") {
        next.residency_country = defaultResidencyCountry(value as Form["jurisdiction_id"]);
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: CheckRequest = {
        jurisdiction_id: form.jurisdiction_id,
        date_of_birth: form.date_of_birth,
        legal_status: form.legal_status,
        residency_periods: form.residency_country
          ? [
              {
                country: form.residency_country,
                start_date: form.residency_start,
              },
            ]
          : [],
        evidence_present: {
          dob: form.evidence_dob,
          residency: form.evidence_residency,
          job_loss: form.evidence_job_loss,
        },
      };
      const r = await runCheck(payload);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="check-heading" className="space-y-8">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="citizen" />
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "check.eyebrow" })}
          </p>
          <h1
            id="check-heading"
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "check.heading" })}
          </h1>
          <p className="max-w-2xl text-base text-foreground-muted">
            {intl.formatMessage({ id: "check.lede" })}
          </p>
        </div>
      </header>

      <CheckForm form={form} update={update} loading={loading} onSubmit={onSubmit} />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-border bg-surface-sunken p-4"
          data-testid="check-error"
        >
          <p className="text-sm font-medium text-foreground">
            {intl.formatMessage({ id: "check.error.title" })}
          </p>
          <p className="text-xs text-foreground-muted">{error}</p>
        </div>
      )}

      {result && <CheckResults result={result} />}
    </section>
  );
}

function CheckForm({
  form,
  update,
  loading,
  onSubmit,
}: {
  form: Form;
  update: <K extends keyof Form>(key: K, value: Form[K]) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const intl = useIntl();
  const fieldClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:shadow-[var(--ring-focus)]";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-md border border-border bg-surface p-6"
      data-testid="check-form"
      aria-labelledby="check-form-heading"
    >
      <h2 id="check-form-heading" className="sr-only">
        {intl.formatMessage({ id: "check.form.heading" })}
      </h2>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.form.jurisdiction" })}
          </span>
          <select
            className={fieldClass}
            value={form.jurisdiction_id}
            onChange={(e) =>
              update("jurisdiction_id", e.target.value as Form["jurisdiction_id"])
            }
            data-testid="check-jurisdiction"
          >
            {ACTIVE_JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {intl.formatMessage({ id: `check.form.jurisdiction.${j}` })}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.form.dob" })}
          </span>
          <input
            type="date"
            className={fieldClass}
            value={form.date_of_birth}
            onChange={(e) => update("date_of_birth", e.target.value)}
            data-testid="check-dob"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.form.legalStatus" })}
          </span>
          <select
            className={fieldClass}
            value={form.legal_status}
            onChange={(e) =>
              update("legal_status", e.target.value as Form["legal_status"])
            }
            data-testid="check-legal-status"
          >
            <option value="citizen">
              {intl.formatMessage({ id: "check.form.legalStatus.citizen" })}
            </option>
            <option value="permanent_resident">
              {intl.formatMessage({ id: "check.form.legalStatus.permanent_resident" })}
            </option>
            <option value="other">
              {intl.formatMessage({ id: "check.form.legalStatus.other" })}
            </option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.form.residencyStart" })}
          </span>
          <input
            type="date"
            className={fieldClass}
            value={form.residency_start}
            onChange={(e) => update("residency_start", e.target.value)}
            data-testid="check-residency-start"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-[0.15em] text-foreground-subtle">
          {intl.formatMessage({ id: "check.form.evidence" })}
        </legend>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.evidence_dob}
            onChange={(e) => update("evidence_dob", e.target.checked)}
            data-testid="check-evidence-dob"
          />
          {intl.formatMessage({ id: "check.form.evidence.dob" })}
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.evidence_residency}
            onChange={(e) => update("evidence_residency", e.target.checked)}
            data-testid="check-evidence-residency"
          />
          {intl.formatMessage({ id: "check.form.evidence.residency" })}
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.evidence_job_loss}
            onChange={(e) => update("evidence_job_loss", e.target.checked)}
            data-testid="check-evidence-job-loss"
          />
          {intl.formatMessage({ id: "check.form.evidence.job_loss" })}
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md border border-border bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 focus-visible:shadow-[var(--ring-focus)] disabled:opacity-50"
        data-testid="check-submit"
      >
        {loading
          ? intl.formatMessage({ id: "check.form.submitting" })
          : intl.formatMessage({ id: "check.form.submit" })}
      </button>
    </form>
  );
}

function CheckResults({ result }: { result: CheckResponse }) {
  const intl = useIntl();
  return (
    <section
      aria-labelledby="check-results-heading"
      className="space-y-6"
      data-testid="check-results"
    >
      <header className="space-y-2">
        <h2
          id="check-results-heading"
          className="text-2xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage(
            { id: "check.results.heading" },
            { jurisdiction: result.jurisdiction_label },
          )}
        </h2>
        <p
          className="text-xs text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage(
            { id: "check.results.evaluatedOn" },
            { date: result.evaluation_date },
          )}
        </p>
      </header>

      <ul className="space-y-4">
        {result.programs.map((program) => (
          <li key={program.program_id}>
            <ProgramResultCard
              program={program}
              jurisdictionId={result.jurisdiction_id}
            />
          </li>
        ))}
      </ul>

      <p
        className="rounded-md border border-border bg-surface-sunken p-3 text-xs text-foreground-muted"
        role="note"
      >
        {result.disclaimer}
      </p>
    </section>
  );
}

function ProgramResultCard({
  program,
  jurisdictionId,
}: {
  program: CheckProgramResult;
  jurisdictionId: string;
}) {
  const intl = useIntl();
  const outcomeKey = `check.outcome.${program.outcome}`;
  const ineligibleEi =
    program.program_id === "ei" && program.outcome === "insufficient_evidence";

  return (
    <article
      className="space-y-3 rounded-md border border-border bg-surface p-5"
      aria-labelledby={`program-${program.program_id}-heading`}
      data-testid={`program-result-${program.program_id}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3
          id={`program-${program.program_id}-heading`}
          className="text-lg text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {program.program_name}
        </h3>
        <p
          className="text-xs uppercase tracking-[0.15em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid={`program-outcome-${program.program_id}`}
        >
          {intl.formatMessage({ id: outcomeKey }, undefined, {
            ignoreTag: true,
          }) || program.outcome}
        </p>
      </header>

      {program.benefit_period && <BenefitTimeline period={program.benefit_period} />}

      {program.active_obligations.length > 0 && (
        <section
          aria-labelledby={`obligations-${program.program_id}-heading`}
          className="space-y-2"
        >
          <h4
            id={`obligations-${program.program_id}-heading`}
            className="text-sm uppercase tracking-[0.15em] text-foreground-subtle"
          >
            {intl.formatMessage({ id: "check.obligations.heading" })}
          </h4>
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
          <h4 className="text-sm uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.missing.heading" })}
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
            {program.missing_evidence.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {ineligibleEi && (
        <Link
          to="/check/life-event"
          search={{
            jurisdiction: jurisdictionId as "ca" | "br" | "es" | "fr" | "de" | "ua" | "jp",
            event: "job_loss",
          }}
          className="inline-block rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground hover:bg-surface focus-visible:shadow-[var(--ring-focus)]"
          data-testid={`life-event-cta-${program.program_id}`}
        >
          {intl.formatMessage({ id: "check.lifeEvent.jobLossCta" })}
        </Link>
      )}
    </article>
  );
}
