import { useMemo, useState } from "react";
import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { listCases } from "@/lib/api";
import type { CaseListItem, CaseStatus } from "@/lib/types";
import { CaseRow } from "@/components/govops/cases/CaseRow";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";

const STATUSES: CaseStatus[] = [
  "intake",
  "evaluating",
  "recommendation_ready",
  "under_review",
  "decided",
  "escalated",
];

export const Route = createFileRoute("/cases")({
  head: () => ({
    meta: [
      { title: "Cases — GovOps" },
      {
        name: "description",
        content:
          "Operational case log: applicants, evaluations, and human-review actions.",
      },
    ],
  }),
  loader: async () => {
    const { cases } = await listCases();
    return { cases };
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading rows={5} />,
  component: CasesRouteComponent,
});

function CasesRouteComponent() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <CasesListPage />;
}

function CasesListPage() {
  const intl = useIntl();
  const { cases } = Route.useLoaderData() as { cases: CaseListItem[] };
  const [activeStatuses, setActiveStatuses] = useState<Set<CaseStatus>>(new Set());
  const [jurisdiction, setJurisdiction] = useState<string>("all");

  const jurisdictions = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => c.jurisdiction_id && set.add(c.jurisdiction_id));
    return Array.from(set);
  }, [cases]);

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        if (activeStatuses.size > 0 && !activeStatuses.has(c.status)) return false;
        if (jurisdiction !== "all" && c.jurisdiction_id !== jurisdiction) return false;
        return true;
      }),
    [cases, activeStatuses, jurisdiction],
  );

  const toggleStatus = (s: CaseStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "cases.list.heading" })}
        </h1>
      </header>

      <section className="space-y-3 rounded-md border border-border bg-surface-raised p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "cases.list.filter.status" })}:
          </span>
          {STATUSES.map((s) => {
            const active = activeStatuses.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-surface text-foreground-muted hover:text-foreground"
                }`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({ id: `status.${s}` })}
              </button>
            );
          })}
        </div>
        {jurisdictions.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-foreground-muted">
            <span>{intl.formatMessage({ id: "cases.list.filter.jurisdiction" })}:</span>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">—</option>
              {jurisdictions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface p-8 text-center">
          <p
            className="text-lg text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {intl.formatMessage({ id: "cases.list.empty.title" })}
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            {intl.formatMessage({ id: "cases.list.empty.body" })}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <CaseRow key={c.id} item={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
