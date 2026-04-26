import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";

import { getConfigValue } from "@/lib/api";
import { MOCK_CONFIG_VALUES } from "@/lib/mock-config-values";
import type { ConfigValue } from "@/lib/types";
import { DiffPane } from "@/components/govops/DiffPane";
import { DiffMetadataStrip } from "@/components/govops/DiffMetadataStrip";
import { ValueDiff } from "@/components/govops/ValueDiff";
import { JurisdictionChip } from "@/components/govops/JurisdictionChip";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";

type DiffSearch = { from?: string; to?: string };

export const Route = createFileRoute("/config/diff")({
  head: () => ({
    meta: [{ title: "Diff — GovOps" }],
  }),
  validateSearch: (search: Record<string, unknown>): DiffSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: async ({ deps }) => {
    if (!deps.from || !deps.to) return null;
    const [from, to] = await Promise.all([loadOne(deps.from), loadOne(deps.to)]);
    return { from, to };
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading variant="split" />,
  component: DiffPage,
});

function findMock(id: string): ConfigValue | undefined {
  return MOCK_CONFIG_VALUES.find((v) => v.id === id);
}

type LoadResult = { kind: "ok"; cv: ConfigValue } | { kind: "error"; id: string; message: string };

async function loadOne(id: string): Promise<LoadResult> {
  try {
    const cv = await getConfigValue(id);
    return { kind: "ok", cv };
  } catch {
    const mock = findMock(id);
    if (mock) return { kind: "ok", cv: mock };
    return { kind: "error", id, message: "404" };
  }
}

function DiffPage() {
  const intl = useIntl();
  const navigate = useNavigate({ from: "/config/diff" });
  const { from: fromId, to: toId } = Route.useSearch();
  const pair = Route.useLoaderData() as { from: LoadResult; to: LoadResult } | null;

  const swap = useCallback(() => {
    navigate({
      search: () => ({ from: toId, to: fromId }),
      replace: true,
    });
  }, [navigate, fromId, toId]);

  const sameRecord = useMemo(() => {
    if (!pair || pair.from.kind !== "ok" || pair.to.kind !== "ok") return null;
    const a = pair.from.cv;
    const b = pair.to.cv;
    return a.key === b.key && a.jurisdiction_id === b.jurisdiction_id
      ? { key: a.key, jurisdiction_id: a.jurisdiction_id }
      : null;
  }, [pair]);

  // Missing params guard
  if (!fromId || !toId) {
    return (
      <section className="space-y-4">
        <h1
          className="text-2xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "diff.heading.cross_record" })}
        </h1>
        <p className="text-sm text-foreground-muted">
          Provide{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>?from=&lt;id&gt;&amp;to=&lt;id&gt;</code>
          .
        </p>
        <Link
          to="/config"
          className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          ← {intl.formatMessage({ id: "diff.back_to_search" })}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="diff-heading" className="space-y-6 print:space-y-3">
      {/* Back link — hidden in print */}
      <nav aria-label="Breadcrumb" className="text-sm print:hidden">
        {sameRecord ? (
          <Link
            to="/config/$key/$jurisdictionId"
            params={{
              key: encodeURIComponent(sameRecord.key),
              jurisdictionId: encodeURIComponent(sameRecord.jurisdiction_id ?? "global"),
            }}
            className="text-foreground-muted underline-offset-4 hover:underline"
          >
            ← {intl.formatMessage({ id: "diff.back_to_timeline" })}
          </Link>
        ) : (
          <Link to="/config" className="text-foreground-muted underline-offset-4 hover:underline">
            ← {intl.formatMessage({ id: "diff.back_to_search" })}
          </Link>
        )}
      </nav>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle print:hidden"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            diff · v1
          </p>
          <h1
            id="diff-heading"
            className="text-2xl tracking-tight text-foreground sm:text-3xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {sameRecord
              ? intl.formatMessage(
                  { id: "diff.heading.same_key" },
                  {
                    key: sameRecord.key,
                    jurisdiction: sameRecord.jurisdiction_id ?? "global",
                  },
                )
              : intl.formatMessage({ id: "diff.heading.cross_record" })}
          </h1>
          {sameRecord && (
            <div className="flex items-center gap-2 print:hidden">
              <JurisdictionChip id={sameRecord.jurisdiction_id} />
              <code
                className="truncate text-xs text-foreground-muted"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {sameRecord.key}
              </code>
            </div>
          )}
          {!sameRecord && pair?.from.kind === "ok" && pair?.to.kind === "ok" && (
            <ul
              className="space-y-1 text-xs text-foreground-muted print:hidden"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <li>from: {pair.from.cv.key}</li>
              <li>to: {pair.to.cv.key}</li>
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={swap}
          className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken print:hidden"
        >
          ⇄ {intl.formatMessage({ id: "diff.swap" })}
        </button>
      </header>

      {/* Error state — at least one id failed */}
      {pair && (pair.from.kind === "error" || pair.to.kind === "error") && (
        <div
          role="alert"
          className="space-y-3 rounded-md border p-4"
          style={{
            borderColor: "var(--verdict-rejected)",
            backgroundColor: "color-mix(in oklch, var(--verdict-rejected) 6%, transparent)",
          }}
        >
          {(["from", "to"] as const).map((side) => {
            const r = pair[side];
            if (r.kind !== "error") return null;
            return (
              <p
                key={side}
                className="text-sm font-medium"
                style={{ color: "var(--verdict-rejected)" }}
              >
                {intl.formatMessage({ id: "diff.error.not_found" }, { id: r.id })}
              </p>
            );
          })}
          <Link
            to="/config"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
          >
            ← {intl.formatMessage({ id: "diff.error.go_back" })}
          </Link>
        </div>
      )}

      {/* Success */}
      {pair && pair.from.kind === "ok" && pair.to.kind === "ok" && (
        <>
          <DiffMetadataStrip from={pair.from.cv} to={pair.to.cv} />

          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <DiffPane cv={pair.from.cv} side="from" labelId="diff-from-label" />
            <DiffPane cv={pair.to.cv} side="to" labelId="diff-to-label" />
          </div>

          <section
            aria-labelledby="value-diff-heading"
            className="space-y-3 rounded-md border border-border bg-surface p-4"
          >
            <h2
              id="value-diff-heading"
              className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              value
            </h2>
            <ValueDiff from={pair.from.cv} to={pair.to.cv} />
          </section>

          <p aria-live="polite" className="sr-only">
            Diff loaded.
          </p>
        </>
      )}
    </section>
  );
}
