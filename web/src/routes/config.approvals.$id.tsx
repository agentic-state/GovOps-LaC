import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormattedDate, useIntl } from "react-intl";

import { ApprovalActions } from "@/components/govops/ApprovalActions";
import { CurrentVsProposed } from "@/components/govops/CurrentVsProposed";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { ValueDiff } from "@/components/govops/ValueDiff";
import { JurisdictionChip } from "@/components/govops/JurisdictionChip";
import { ValueTypeBadge } from "@/components/govops/ValueTypeBadge";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";
import { getApproval, resolveCurrentConfigValue } from "@/lib/api";
import type { ConfigValue } from "@/lib/types";

export const Route = createFileRoute("/config/approvals/$id")({
  head: () => ({
    meta: [{ title: "Review draft — GovOps" }],
  }),
  loader: async ({
    params,
  }): Promise<{ proposed: ConfigValue | null; current: ConfigValue | null }> => {
    const proposed = await getApproval(params.id);
    if (!proposed) return { proposed: null, current: null };
    let current: ConfigValue | null = null;
    try {
      current = await resolveCurrentConfigValue(
        proposed.key,
        proposed.jurisdiction_id,
        new Date().toISOString(),
      );
    } catch {
      current = null;
    }
    return { proposed, current };
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading variant="panel" />,
  component: ApprovalDetailPage,
});

function ApprovalDetailPage() {
  const intl = useIntl();
  const { proposed, current } = Route.useLoaderData();
  const nav = useNavigate();

  function onResolved() {
    // Approve → jump to canonical timeline; request/reject → back to queue.
    if (!proposed) return;
    nav({ to: "/config/approvals" });
  }

  if (!proposed) {
    return (
      <div className="space-y-4 rounded-md border border-border bg-surface p-6">
        <p className="text-base font-medium text-foreground">
          {intl.formatMessage({ id: "approvals.notfound.title" })}
        </p>
        <Link
          to="/config/approvals"
          className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          {intl.formatMessage({ id: "approvals.back_to_queue" })}
        </Link>
      </div>
    );
  }

  const provenance = proposed.author.startsWith("agent:") ? "agent" : "human";

  return (
    <div className="space-y-6">
      <Link
        to="/config/approvals"
        className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
      >
        ← {intl.formatMessage({ id: "approvals.back_to_queue" })}
      </Link>

      <header className="flex items-stretch rounded-md border border-border bg-surface">
        <ProvenanceRibbon variant={provenance} />
        <div className="flex-1 space-y-3 px-5 py-4">
          <p
            className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "approvals.review.heading" }, { key: proposed.key })}
          </p>
          <h1
            className="break-all text-2xl tracking-tight text-foreground sm:text-3xl"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}
          >
            {proposed.key}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
            <JurisdictionChip id={proposed.jurisdiction_id} />
            <ValueTypeBadge type={proposed.value_type} />
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: "color-mix(in oklch, var(--verdict-pending) 14%, transparent)",
                color: "var(--verdict-pending)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {intl.formatMessage({ id: `status.${proposed.status}` })}
            </span>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {intl.formatMessage(
                { id: "approvals.drafted_by" },
                {
                  author: proposed.author,
                  date: intl.formatDate(proposed.created_at, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }),
                },
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <CurrentVsProposed current={current} proposed={proposed} />

          <section
            aria-labelledby="diff-heading"
            className="space-y-3 rounded-md border border-border bg-surface p-5"
          >
            <h2
              id="diff-heading"
              className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id: "approvals.diff.heading" })}
            </h2>
            {current ? (
              <ValueDiff from={current} to={proposed} />
            ) : (
              <p
                className="text-sm italic text-foreground-muted"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({ id: "approvals.pane.no_prior" })}
              </p>
            )}
          </section>

          <section
            aria-labelledby="meta-heading"
            className="space-y-3 rounded-md border border-border bg-surface p-5"
          >
            <h2
              id="meta-heading"
              className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id: "approvals.meta.heading" })}
            </h2>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                  {intl.formatMessage({ id: "diff.metadata.effective_from" })}
                </dt>
                <dd className="text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                  <FormattedDate
                    value={proposed.effective_from}
                    year="numeric"
                    month="short"
                    day="numeric"
                  />
                </dd>
              </div>
              {proposed.citation && (
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                    {intl.formatMessage({ id: "config.detail.citation" })}
                  </dt>
                  <dd className="text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                    {proposed.citation}
                  </dd>
                </div>
              )}
              {proposed.rationale && (
                <div className="sm:col-span-2">
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                    {intl.formatMessage({ id: "config.detail.rationale" })}
                  </dt>
                  <dd className="text-foreground">{proposed.rationale}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        <div>
          <ApprovalActions cv={proposed} onResolved={onResolved} />
        </div>
      </div>
    </div>
  );
}
