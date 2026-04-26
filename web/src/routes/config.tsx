import { createFileRoute, Outlet, useChildMatches, useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { listConfigValues } from "@/lib/api";
import { filterMockConfigValues } from "@/lib/mock-config-values";
import type { ConfigValue, ListConfigValuesResponse } from "@/lib/types";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { ConfigValueFilters, type FiltersState } from "@/components/govops/ConfigValueFilters";
import { ConfigValueRow } from "@/components/govops/ConfigValueRow";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortKey = "key_asc" | "key_desc" | "effective_desc" | "effective_asc";
const SORT_KEYS: SortKey[] = ["key_asc", "key_desc", "effective_desc", "effective_asc"];

type ConfigSearch = {
  key_prefix?: string;
  domain?: string;
  jurisdiction_id?: string;
  language?: string;
  sort?: SortKey;
};

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Configuration — GovOps" },
      {
        name: "description",
        content:
          "Search and filter every ConfigValue across jurisdictions, domains, and languages.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): ConfigSearch => ({
    key_prefix: typeof search.key_prefix === "string" ? search.key_prefix : undefined,
    domain: typeof search.domain === "string" ? search.domain : undefined,
    jurisdiction_id:
      typeof search.jurisdiction_id === "string" ? search.jurisdiction_id : undefined,
    language: typeof search.language === "string" ? search.language : undefined,
    sort:
      typeof search.sort === "string" && (SORT_KEYS as string[]).includes(search.sort)
        ? (search.sort as SortKey)
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    key_prefix: search.key_prefix,
    domain: search.domain,
    jurisdiction_id: search.jurisdiction_id,
    language: search.language,
  }),
  loader: async ({ deps }): Promise<ListConfigValuesResponse> => {
    const params = {
      key_prefix: deps.key_prefix || undefined,
      domain: deps.domain && deps.domain !== "all" ? deps.domain : undefined,
      jurisdiction_id:
        deps.jurisdiction_id && deps.jurisdiction_id !== "all" ? deps.jurisdiction_id : undefined,
      language: deps.language && deps.language !== "all" ? deps.language : undefined,
    };
    try {
      return await listConfigValues(params);
    } catch {
      return filterMockConfigValues(params);
    }
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading rows={3} rowHeight={68} />,
  component: ConfigRouteComponent,
});

function ConfigRouteComponent() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <ConfigPage />;
}

function ConfigPage() {
  const intl = useIntl();
  const navigate = useNavigate({ from: "/config" });
  const search = useSearch({ from: "/config" });
  const data: ListConfigValuesResponse = Route.useLoaderData();

  // Memoized so useCallback deps below are stable across renders.
  const filters: FiltersState = useMemo(
    () => ({
      key_prefix: search.key_prefix ?? "",
      domain: search.domain ?? "all",
      jurisdiction_id: search.jurisdiction_id ?? "all",
      language: search.language ?? "all",
    }),
    [search.key_prefix, search.domain, search.jurisdiction_id, search.language],
  );
  const sort: SortKey = search.sort ?? "key_asc";

  const updateFilters = useCallback(
    (next: Partial<FiltersState>) => {
      const merged = { ...filters, ...next };
      navigate({
        search: () => ({
          key_prefix: merged.key_prefix || undefined,
          domain: merged.domain !== "all" ? merged.domain : undefined,
          jurisdiction_id: merged.jurisdiction_id !== "all" ? merged.jurisdiction_id : undefined,
          language: merged.language !== "all" ? merged.language : undefined,
          sort: sort !== "key_asc" ? sort : undefined,
        }),
        replace: true,
      });
    },
    [filters, navigate, sort],
  );

  const setSort = useCallback(
    (next: SortKey) => {
      navigate({
        search: (prev: ConfigSearch) => ({
          ...prev,
          sort: next !== "key_asc" ? next : undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const sortedValues = useMemo<ConfigValue[]>(() => {
    const arr = [...data.values];
    arr.sort((a, b) => {
      switch (sort) {
        case "key_desc":
          return b.key.localeCompare(a.key);
        case "effective_desc":
          return b.effective_from.localeCompare(a.effective_from);
        case "effective_asc":
          return a.effective_from.localeCompare(b.effective_from);
        case "key_asc":
        default:
          return a.key.localeCompare(b.key);
      }
    });
    return arr;
  }, [data, sort]);

  return (
    <section aria-labelledby="config-heading" className="space-y-8">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="system" />
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            config · v1
          </p>
          <h1
            id="config-heading"
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "config.title" })}
          </h1>
          <p className="max-w-2xl text-base text-foreground-muted">
            {intl.formatMessage({ id: "config.lede" })}
          </p>
        </div>
      </header>

      <ConfigValueFilters value={filters} onChange={updateFilters} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div aria-live="polite" aria-atomic="true" className="text-sm text-foreground-muted">
          <FormattedMessage id="config.results.count" values={{ count: data.count }} />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="config-sort"
            className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "config.sort.label" })}
          </label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger id="config-sort" className="h-9 w-[200px] bg-surface text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((s) => (
                <SelectItem key={s} value={s}>
                  {intl.formatMessage({ id: `config.sort.${s}` })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {data.values.length === 0 && (
        <div className="rounded-md bg-agentic-soft p-6 text-center">
          <p className="text-base font-medium text-agentic-foreground">
            {intl.formatMessage({ id: "config.empty.title" })}
          </p>
          <p className="mt-1 text-sm text-agentic-foreground/80">
            {intl.formatMessage({ id: "config.empty.body" })}
          </p>
        </div>
      )}

      {data.values.length > 0 && (
        <div className="space-y-2">
          <div
            role="presentation"
            className="grid grid-cols-[3px_minmax(0,2fr)_minmax(0,1.5fr)_auto_auto_auto] items-center gap-4 border-b border-border px-4 pb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span aria-hidden />
            <span>{intl.formatMessage({ id: "config.column.key" })}</span>
            <span>{intl.formatMessage({ id: "config.column.value" })}</span>
            <span>{intl.formatMessage({ id: "config.column.type" })}</span>
            <span>{intl.formatMessage({ id: "config.column.jurisdiction" })}</span>
            <span>{intl.formatMessage({ id: "config.column.effective_from" })}</span>
          </div>
          <ol role="list" className="space-y-2">
            {sortedValues.map((cv) => (
              <ConfigValueRow key={cv.id} cv={cv} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
