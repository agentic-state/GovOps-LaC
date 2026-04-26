import { createFileRoute } from "@tanstack/react-router";
import { useIntl } from "react-intl";

import { fetchOrMock } from "@/lib/api";
import { MOCK_POLICIES, type Policy } from "@/lib/mock-policies";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { VerdictBadge } from "@/components/govops/VerdictBadge";
import { useLocale } from "@/lib/i18n";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";

export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Policies — GovOps" },
      {
        name: "description",
        content:
          "Live registry of GovOps policies and proposals, each with readable provenance and a current verdict.",
      },
      { property: "og:title", content: "Policies — GovOps" },
      {
        property: "og:description",
        content: "GovOps policy registry with provenance and verdicts.",
      },
    ],
  }),
  loader: () => fetchOrMock<Policy[]>("/v1/policies", MOCK_POLICIES),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading rows={3} rowHeight={68} />,
  component: PoliciesPage,
});

function PoliciesPage() {
  const intl = useIntl();
  const { locale } = useLocale();
  const policies: Policy[] = Route.useLoaderData();

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="space-y-10">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="system" />
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            registry · v1
          </p>
          <h1
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "policies.title" })}
          </h1>
          <p className="max-w-2xl text-base text-foreground-muted">
            {intl.formatMessage({ id: "policies.lede" })}
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-border bg-surface">
        <div
          className="grid grid-cols-[3px_1fr_auto_auto] items-center gap-4 border-b border-border bg-surface-sunken px-4 py-3 text-xs uppercase tracking-[0.14em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span aria-hidden />
          <span>{intl.formatMessage({ id: "policies.column.title" })}</span>
          <span>{intl.formatMessage({ id: "policies.column.verdict" })}</span>
          <span className="hidden sm:inline">
            {intl.formatMessage({ id: "policies.column.updated" })}
          </span>
        </div>

        {policies.length === 0 && (
          <p className="px-4 py-6 text-sm text-foreground-muted">
            {intl.formatMessage({ id: "policies.empty" })}
          </p>
        )}

        {policies.length > 0 && (
          <ul className="divide-y divide-border">
            {policies.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[3px_1fr_auto] items-center gap-4 px-0 py-3 sm:grid-cols-[3px_1fr_auto_auto] sm:px-0"
              >
                <ProvenanceRibbon variant={p.provenance} />
                <div className="min-w-0 ps-0 pe-4">
                  <p
                    className="truncate text-[11px] uppercase tracking-[0.14em] text-foreground-subtle"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {p.ref}
                  </p>
                  <p
                    className="truncate text-base text-foreground"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {p.title[locale] ?? p.title.en}
                  </p>
                </div>
                <div className="pe-4">
                  <VerdictBadge verdict={p.verdict} />
                </div>
                <div
                  className="hidden pe-4 text-xs text-foreground-muted sm:block"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {dateFmt.format(new Date(p.updatedAt))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
