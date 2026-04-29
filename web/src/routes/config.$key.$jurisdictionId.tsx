import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";

import { listVersions } from "@/lib/api";
import { MOCK_CONFIG_VALUES } from "@/lib/mock-config-values";
import type { ConfigValue, ListVersionsResponse } from "@/lib/types";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { ValueTypeBadge } from "@/components/govops/ValueTypeBadge";
import { JurisdictionChip } from "@/components/govops/JurisdictionChip";
import { CopyButton } from "@/components/govops/CopyButton";
import { Timeline } from "@/components/govops/Timeline";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";

export const Route = createFileRoute("/config/$key/$jurisdictionId")({
  head: () => ({
    meta: [{ title: "ConfigValue timeline — GovOps" }],
  }),
  loader: async ({ params }): Promise<ListVersionsResponse> => {
    const decodedKey = decodeURIComponent(params.key);
    const decodedJur = decodeURIComponent(params.jurisdictionId);
    try {
      return await listVersions(decodedKey, decodedJur === "global" ? null : decodedJur);
    } catch {
      return mockVersions(decodedKey, decodedJur);
    }
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading rows={3} rowHeight={140} />,
  component: ConfigDetailPage,
});

function mockVersions(key: string, jurisdictionId: string): ListVersionsResponse {
  const versions = MOCK_CONFIG_VALUES.filter((v) => {
    const matchesJur =
      jurisdictionId === "global"
        ? v.jurisdiction_id === null
        : v.jurisdiction_id === jurisdictionId;
    return v.key === key && matchesJur;
  });
  return { key, versions, count: versions.length };
}

function ConfigDetailPage() {
  const intl = useIntl();
  const { key, jurisdictionId } = Route.useParams();
  const navigate = useNavigate();
  const decodedKey = decodeURIComponent(key);
  const decodedJur = decodeURIComponent(jurisdictionId);
  const data: ListVersionsResponse = Route.useLoaderData();

  // Newest-first ordering, computed once per data update.
  const versions = useMemo<ConfigValue[]>(() => {
    return [...data.versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  }, [data]);

  const current = versions[0];
  const provenance = current?.author.startsWith("agent:") ? "agent" : "human";

  // Compare-selection state (max 2). Reset whenever the underlying key changes.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => setSelectedIds([]), [decodedKey, decodedJur]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // FIFO once 2 are selected
      return [...prev, id];
    });
  }, []);

  return (
    <section aria-labelledby="config-detail-heading" className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link to="/config" className="text-foreground-muted underline-offset-4 hover:underline">
          ← {intl.formatMessage({ id: "nav.config" })}
        </Link>
      </nav>

      <header className="flex items-stretch">
        <ProvenanceRibbon variant={provenance} />
        <div className="w-full space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p
                className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {intl.formatMessage({ id: "timeline.heading" })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  id="config-detail-heading"
                  className="text-xl tracking-tight text-foreground sm:text-2xl"
                  style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}
                >
                  {decodedKey}
                </h1>
                <CopyButton value={decodedKey} />
              </div>
              <div className="flex items-center gap-2">
                <JurisdictionChip id={decodedJur === "global" ? null : decodedJur} />
                {current && <ValueTypeBadge type={current.value_type} />}
                {current && (
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor:
                        provenance === "agent" ? "var(--agentic)" : "var(--authority)",
                    }}
                    title={intl.formatMessage({
                      id: `provenance.${provenance}`,
                    })}
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/config/draft",
                  search: {
                    key: decodedKey,
                    jurisdiction_id: decodedJur,
                    value_type: current?.value_type,
                    supersedes_id: current?.id,
                  },
                })
              }
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                borderColor: "var(--authority)",
                color: "var(--authority)",
                backgroundColor: "color-mix(in oklch, var(--authority) 8%, transparent)",
              }}
            >
              {intl.formatMessage({ id: "timeline.draft_new" })}
            </button>
          </div>

          {/* Compare CTA — appears once 2 cards are selected */}
          <div aria-live="polite" aria-atomic="true" className="min-h-[28px]">
            {selectedIds.length === 2 && (
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/config/diff",
                    search: { from: selectedIds[0], to: selectedIds[1] },
                  })
                }
                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--agentic)" }}
              >
                {intl.formatMessage({ id: "timeline.compare.cta" })}
              </button>
            )}
          </div>
        </div>
      </header>

      {versions.length === 0 && (
        <div className="space-y-3 rounded-md bg-agentic-soft p-6 text-center">
          <p className="text-base font-medium text-agentic-foreground">
            {intl.formatMessage({ id: "timeline.empty.title" })}
          </p>
          <p className="text-sm text-agentic-foreground/80">
            {intl.formatMessage({ id: "timeline.empty.body" })}
          </p>
          <Link
            to="/config"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
          >
            ← {intl.formatMessage({ id: "nav.config" })}
          </Link>
        </div>
      )}

      {versions.length > 0 && (
        <Timeline versions={versions} selectedIds={selectedIds} onSelectToggle={toggleSelect} />
      )}
    </section>
  );
}
