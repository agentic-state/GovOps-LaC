import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { compareProgram } from "@/lib/api";
import type {
  CompareJurisdiction,
  CompareProgramResponse,
  CompareRow,
} from "@/lib/types";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { t, localeFromMatches } from "@/lib/head-i18n";

export const Route = createFileRoute("/compare/$programId")({
  component: ComparePage,
  head: ({ matches }) => {
    const l = localeFromMatches(matches);
    return {
      meta: [
        { title: t("compare.heading", l) },
        { name: "description", content: t("compare.lede", l) },
      ],
    };
  },
});

function ComparePage() {
  const { programId } = Route.useParams();
  const intl = useIntl();
  const [data, setData] = useState<CompareProgramResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    compareProgram(programId)
      .then((r) => {
        if (!cancelled) setData(r);
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
  }, [programId]);

  return (
    <section aria-labelledby="compare-heading" className="space-y-8">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="system" />
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "compare.eyebrow" }, { programId })}
          </p>
          <h1
            id="compare-heading"
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "compare.heading" })}
          </h1>
          <p className="max-w-2xl text-base text-foreground-muted">
            {intl.formatMessage({ id: "compare.lede" })}
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-border bg-surface-sunken p-4"
          data-testid="compare-error"
        >
          <p className="text-sm font-medium text-foreground">
            {intl.formatMessage({ id: "compare.error.title" })}
          </p>
          <p className="text-xs text-foreground-muted">{error}</p>
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-foreground-muted" data-testid="compare-loading">
          {intl.formatMessage({ id: "compare.loading" })}
        </p>
      )}

      {data && <ComparisonContent data={data} />}
    </section>
  );
}

function ComparisonContent({ data }: { data: CompareProgramResponse }) {
  const intl = useIntl();
  const available = data.jurisdictions.filter((j) => j.available);
  const unavailable = data.jurisdictions.filter((j) => !j.available);

  return (
    <div className="space-y-10">
      <SummaryStrip data={data} />

      {available.length === 0 ? (
        <p
          role="status"
          className="rounded-md border border-border bg-surface-sunken p-6 text-sm text-foreground-muted"
          data-testid="compare-empty"
        >
          {intl.formatMessage(
            { id: "compare.empty" },
            { programId: data.program_id },
          )}
        </p>
      ) : (
        <ComparisonTable data={data} />
      )}

      {unavailable.length > 0 && <ExclusionPanel jurisdictions={unavailable} />}
    </div>
  );
}

function SummaryStrip({ data }: { data: CompareProgramResponse }) {
  const intl = useIntl();
  const availableCount = data.jurisdictions.filter((j) => j.available).length;
  const totalCount = data.jurisdictions.length;
  return (
    <dl
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      aria-label={intl.formatMessage({ id: "compare.summary.region" })}
      data-testid="compare-summary"
    >
      <div className="rounded-md border border-border bg-surface p-4">
        <dt className="text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {intl.formatMessage({ id: "compare.summary.programLabel" })}
        </dt>
        <dd
          className="mt-1 text-base text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {data.program_id}
        </dd>
      </div>
      <div className="rounded-md border border-border bg-surface p-4">
        <dt className="text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {intl.formatMessage({ id: "compare.summary.shapeLabel" })}
        </dt>
        <dd
          className="mt-1 text-base text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {data.shape ?? intl.formatMessage({ id: "compare.summary.shapeNone" })}
        </dd>
      </div>
      <div className="rounded-md border border-border bg-surface p-4">
        <dt className="text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {intl.formatMessage({ id: "compare.summary.coverageLabel" })}
        </dt>
        <dd className="mt-1 text-base text-foreground">
          {intl.formatMessage(
            { id: "compare.summary.coverageValue" },
            { available: availableCount, total: totalCount },
          )}
        </dd>
      </div>
    </dl>
  );
}

function ComparisonTable({ data }: { data: CompareProgramResponse }) {
  const intl = useIntl();
  const available = data.jurisdictions.filter((j) => j.available);
  const codes = available.map((j) => j.code);
  const labels = Object.fromEntries(
    data.jurisdictions.map((j) => [j.code, j.label]),
  );

  return (
    <section
      aria-labelledby="compare-table-heading"
      className="space-y-4"
      data-testid="compare-table-section"
    >
      <h2
        id="compare-table-heading"
        className="text-2xl tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
      >
        {intl.formatMessage({ id: "compare.table.heading" })}
      </h2>
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage({ id: "compare.table.lede" })}
      </p>
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm" data-testid="compare-table">
          <caption className="sr-only">
            {intl.formatMessage({ id: "compare.table.caption" })}
          </caption>
          <thead className="border-b border-border bg-surface-sunken">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-xs uppercase tracking-[0.15em] text-foreground-subtle"
              >
                {intl.formatMessage({ id: "compare.table.column.rule" })}
              </th>
              {codes.map((code) => (
                <th
                  key={code}
                  scope="col"
                  className="px-4 py-3 text-xs uppercase tracking-[0.15em] text-foreground-subtle"
                >
                  {labels[code] ?? code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.comparison.rows.map((row) => (
              <RuleRow key={row.rule_id} row={row} codes={codes} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RuleRow({ row, codes }: { row: CompareRow; codes: string[] }) {
  const intl = useIntl();
  const paramKeys = Object.keys(row.parameters);
  return (
    <>
      <tr className="border-b border-border align-top">
        <th
          scope="row"
          className="px-4 py-3 text-foreground"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
        >
          <div>{row.rule_id}</div>
          <div className="mt-1 text-xs text-foreground-subtle">
            {intl.formatMessage({ id: `compare.ruleType.${row.rule_type}` }, undefined, {
              ignoreTag: true,
            }) || row.rule_type}
          </div>
        </th>
        {codes.map((code) => {
          const description = row.description_per_jurisdiction[code];
          const citation = row.citation_per_jurisdiction[code];
          return (
            <td key={code} className="px-4 py-3 align-top">
              {description ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground">{description}</p>
                  {citation && (
                    <p
                      className="text-xs text-foreground-subtle"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {citation}
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-xs text-foreground-subtle">—</span>
              )}
            </td>
          );
        })}
      </tr>
      {paramKeys.map((paramKey) => (
        <tr
          key={`${row.rule_id}.${paramKey}`}
          className="border-b border-border bg-surface-sunken/50 align-top"
        >
          <th
            scope="row"
            className="px-4 py-2 pl-8 text-xs text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span aria-hidden="true">↳ </span>
            {paramKey}
          </th>
          {codes.map((code) => {
            const value = row.parameters[paramKey]?.[code];
            return (
              <td
                key={code}
                className="px-4 py-2 text-sm text-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {formatValue(value)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ExclusionPanel({
  jurisdictions,
}: {
  jurisdictions: CompareJurisdiction[];
}) {
  const intl = useIntl();
  return (
    <section
      aria-labelledby="compare-exclusions-heading"
      className="space-y-4"
      data-testid="compare-exclusions"
    >
      <h2
        id="compare-exclusions-heading"
        className="text-2xl tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
      >
        {intl.formatMessage({ id: "compare.exclusions.heading" })}
      </h2>
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage({ id: "compare.exclusions.lede" })}
      </p>
      <ul className="space-y-3">
        {jurisdictions.map((j) => {
          if (j.available) return null;
          return (
            <li
              key={j.code}
              className="rounded-md border border-border bg-surface p-4"
              data-testid={`compare-exclusion-${j.code}`}
            >
              <p
                className="text-xs uppercase tracking-[0.15em] text-foreground-subtle"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {j.code}
              </p>
              <p className="mt-1 text-base text-foreground">{j.label}</p>
              <p className="mt-2 text-sm text-foreground-muted">
                {j.unavailable_reason}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
