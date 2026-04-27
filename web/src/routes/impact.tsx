import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { impactByCitation } from "@/lib/api";
import type { ImpactResponse } from "@/lib/types";
import { ImpactSection } from "@/components/govops/ImpactSection";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";

type ImpactSearch = { citation?: string; limit?: number; page?: number };

const ALLOWED_LIMITS = [10, 25, 50, 100] as const;
const DEFAULT_LIMIT = 25;

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Citation impact — GovOps" },
      {
        name: "description",
        content: "Find every ConfigValue that references a given citation, across all jurisdictions.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): ImpactSearch => ({
    citation: typeof s.citation === "string" && s.citation ? s.citation : undefined,
    limit:
      typeof s.limit === "number" && (ALLOWED_LIMITS as readonly number[]).includes(s.limit)
        ? s.limit
        : typeof s.limit === "string" && (ALLOWED_LIMITS as readonly number[]).includes(Number(s.limit))
          ? Number(s.limit)
          : undefined,
    page:
      typeof s.page === "number" && Number.isInteger(s.page) && s.page > 0
        ? s.page
        : typeof s.page === "string" && Number.isInteger(Number(s.page)) && Number(s.page) > 0
          ? Number(s.page)
          : undefined,
  }),
  component: ImpactPage,
});

function ImpactPage() {
  const search = Route.useSearch();
  const citation = search.citation ?? "";
  const limit = search.limit ?? DEFAULT_LIMIT;
  const page = search.page ?? 1;
  const navigate = useNavigate({ from: "/impact" });
  const intl = useIntl();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [input, setInput] = useState(citation);
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sync URL → input on direct nav / back-forward
  useEffect(() => {
    setInput(citation);
  }, [citation]);

  // run query when ?citation=, ?limit=, ?page= change
  useEffect(() => {
    let cancelled = false;
    if (!citation.trim()) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    impactByCitation(citation, { limit, page })
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
  }, [citation, limit, page]);

  // global "/" focuses the search input (when not in another text field)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pushQuery(v: string) {
    navigate({
      // any new query resets pagination back to page 1
      search: (prev: ImpactSearch) => ({
        citation: v.trim() ? v : undefined,
        limit: prev.limit,
        page: undefined,
      }),
      replace: true,
    });
  }

  function onChange(v: string) {
    setInput(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => pushQuery(v), 250);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounce.current) clearTimeout(debounce.current);
    pushQuery(input);
  }

  function retry() {
    if (citation.trim()) {
      // re-issue by toggling state; simplest is just to refetch directly.
      setError(null);
      setLoading(true);
      impactByCitation(citation, { limit, page })
        .then(setData)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }
  }

  function setLimit(next: number) {
    navigate({
      search: (prev: ImpactSearch) => ({ ...prev, limit: next, page: undefined }),
      replace: true,
    });
  }

  function gotoPage(next: number) {
    navigate({
      search: (prev: ImpactSearch) => ({ ...prev, page: next > 1 ? next : undefined }),
      replace: false,
    });
  }

  return (
    <section aria-labelledby="impact-heading" className="space-y-8">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="hybrid" />
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            impact · v1
          </p>
          <h1
            id="impact-heading"
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "impact.heading" })}
          </h1>
          <p className="max-w-2xl text-base text-foreground-muted">
            {intl.formatMessage({ id: "impact.lede" })}
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          type="search"
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder={intl.formatMessage({ id: "impact.search.placeholder" })}
          aria-label={intl.formatMessage({ id: "impact.search.placeholder" })}
          aria-controls="impact-results"
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus-visible:shadow-[var(--ring-focus)]"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="impact-search"
        />
      </form>

      <div
        id="impact-results"
        role="region"
        aria-label={intl.formatMessage({ id: "impact.results.region" })}
        aria-live="polite"
        aria-atomic="true"
        tabIndex={-1}
        className="min-h-[2rem]"
      >
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-sunken p-4"
            data-testid="impact-error"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {intl.formatMessage({ id: "impact.error.title" })}
              </p>
              <p className="text-xs text-foreground-muted">{error}</p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-sunken focus-visible:shadow-[var(--ring-focus)]"
              data-testid="impact-retry"
            >
              {intl.formatMessage({ id: "impact.error.retry" })}
            </button>
          </div>
        )}

        {loading && <ImpactSkeleton />}

        {!loading && !error && data && data.total > 0 && (
          <>
            <p className="mb-4 text-sm text-foreground-muted">
              <FormattedMessage
                id="impact.summary"
                values={{ n: data.total, m: data.jurisdiction_count, query: data.query }}
              />
            </p>
            <ImpactPaginationBar
              limit={data.limit ?? limit}
              page={data.page ?? page}
              pageCount={data.page_count ?? 1}
              onLimitChange={setLimit}
              onPageChange={gotoPage}
            />
            {data.results.map((r) => (
              <ImpactSection
                key={r.jurisdiction_id ?? "global"}
                result={r}
                query={data.query}
              />
            ))}
            <ImpactPaginationBar
              limit={data.limit ?? limit}
              page={data.page ?? page}
              pageCount={data.page_count ?? 1}
              onLimitChange={setLimit}
              onPageChange={gotoPage}
            />
          </>
        )}

        {!loading && !error && data && data.total === 0 && (
          <div className="rounded-md bg-agentic-soft p-6 text-center" data-testid="impact-empty">
            <p className="text-base font-medium text-agentic-foreground">
              {intl.formatMessage({ id: "impact.empty.title" })}
            </p>
            <p className="mt-1 text-sm text-agentic-foreground/80">
              {intl.formatMessage({ id: "impact.empty.body" })}
            </p>
            <Link
              to="/authority"
              className="mt-3 inline-block text-sm underline underline-offset-4"
              style={{ color: "var(--authority)" }}
            >
              {intl.formatMessage({ id: "impact.empty.cta" })}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ImpactPaginationBar({
  limit,
  page,
  pageCount,
  onLimitChange,
  onPageChange,
}: {
  limit: number;
  page: number;
  pageCount: number;
  onLimitChange: (n: number) => void;
  onPageChange: (n: number) => void;
}) {
  const intl = useIntl();
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;
  return (
    <nav
      aria-label={intl.formatMessage({ id: "impact.pagination.aria" })}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground-muted"
    >
      <label className="flex items-center gap-2">
        <span>{intl.formatMessage({ id: "impact.pagination.limit" })}</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="rounded border border-border bg-surface px-2 py-1 text-foreground focus-visible:shadow-[var(--ring-focus)]"
          aria-label={intl.formatMessage({ id: "impact.pagination.limit" })}
          data-testid="impact-limit"
        >
          {ALLOWED_LIMITS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={prevDisabled}
          className="rounded border border-border bg-surface px-2 py-1 text-foreground hover:bg-surface-sunken disabled:opacity-40 focus-visible:shadow-[var(--ring-focus)]"
          data-testid="impact-prev"
        >
          {intl.formatMessage({ id: "impact.pagination.prev" })}
        </button>
        <span aria-live="off" data-testid="impact-page-status">
          <FormattedMessage
            id="impact.pagination.status"
            values={{ page, pageCount }}
          />
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={nextDisabled}
          className="rounded border border-border bg-surface px-2 py-1 text-foreground hover:bg-surface-sunken disabled:opacity-40 focus-visible:shadow-[var(--ring-focus)]"
          data-testid="impact-next"
        >
          {intl.formatMessage({ id: "impact.pagination.next" })}
        </button>
      </div>
    </nav>
  );
}

function ImpactSkeleton() {
  return (
    <div aria-hidden className="space-y-4 motion-reduce:[&_*]:animate-none">
      <div className="h-5 w-48 animate-pulse rounded bg-surface-sunken" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-md border border-border bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
