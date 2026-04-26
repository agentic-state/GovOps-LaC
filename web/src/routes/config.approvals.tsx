import { createFileRoute, Link, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { ApprovalRow } from "@/components/govops/ApprovalRow";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listApprovals } from "@/lib/api";
import type { ConfigValue } from "@/lib/types";

type StatusFilter = "all" | "draft" | "pending";
const PAGE_SIZES = [10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number];

type ApprovalsSearch = {
  q?: string;
  status?: StatusFilter;
  page_size?: PageSize;
};

export const Route = createFileRoute("/config/approvals")({
  head: () => ({
    meta: [
      { title: "Pending approvals — GovOps" },
      {
        name: "description",
        content: "Drafts and pending ConfigValue records awaiting human ratification.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): ApprovalsSearch => {
    const status =
      s.status === "draft" || s.status === "pending" || s.status === "all"
        ? (s.status as StatusFilter)
        : undefined;
    const ps = Number(s.page_size);
    const page_size = (PAGE_SIZES as readonly number[]).includes(ps) ? (ps as PageSize) : undefined;
    return {
      q: typeof s.q === "string" && s.q.length ? s.q : undefined,
      status,
      page_size,
    };
  },
  loader: async (): Promise<ConfigValue[]> => {
    const res = await listApprovals();
    // Newest first — maintainers want the freshest item on top.
    return [...res.values].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading rows={3} rowHeight={88} />,
  component: ApprovalsRouteComponent,
});

function ApprovalsRouteComponent() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <ApprovalsPage />;
}

function ApprovalsPage() {
  const intl = useIntl();
  const nav = useNavigate({ from: "/config/approvals" });
  const search = Route.useSearch();
  const values: ConfigValue[] = Route.useLoaderData();
  const q = search.q ?? "";
  const statusFilter: StatusFilter = search.status ?? "all";
  const pageSize: PageSize = search.page_size ?? 10;

  const [visible, setVisible] = useState<number>(pageSize);

  function setSearch(next: Partial<ApprovalsSearch>) {
    nav({
      search: (prev: ApprovalsSearch) => ({
        ...prev,
        ...next,
        // Drop default-equivalent values to keep URLs clean.
        q: next.q !== undefined ? next.q || undefined : prev.q,
        status:
          next.status !== undefined
            ? next.status === "all"
              ? undefined
              : next.status
            : prev.status,
        page_size:
          next.page_size !== undefined
            ? next.page_size === 10
              ? undefined
              : next.page_size
            : prev.page_size,
      }),
      replace: true,
    });
  }

  // Reset the visible window whenever filters or page size change so that
  // changing the filter doesn't leave us paginated past the filtered total.
  useEffect(() => {
    setVisible(pageSize);
  }, [pageSize, q, statusFilter]);

  const filtered = useMemo<ConfigValue[]>(() => {
    const needle = q.trim().toLowerCase();
    return values.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        v.key.toLowerCase().includes(needle) ||
        v.author.toLowerCase().includes(needle) ||
        (v.rationale ?? "").toLowerCase().includes(needle) ||
        (v.jurisdiction_id ?? "").toLowerCase().includes(needle)
      );
    });
  }, [values, q, statusFilter]);

  return (
    <section aria-labelledby="approvals-heading" className="space-y-8">
      <header className="flex items-stretch">
        <ProvenanceRibbon variant="human" />
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-[0.2em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            spec govops-007 · human authority
          </p>
          <h1
            id="approvals-heading"
            className="text-4xl tracking-tight text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "approvals.heading" })}
          </h1>
          <p className="max-w-2xl text-base text-foreground-muted">
            {intl.formatMessage({ id: "approvals.lede" })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div>
          <label htmlFor="approvals-search" className="sr-only">
            {intl.formatMessage({ id: "approvals.search.label" })}
          </label>
          <input
            id="approvals-search"
            type="search"
            value={q}
            onChange={(e) => setSearch({ q: e.target.value })}
            placeholder={intl.formatMessage({ id: "approvals.search.placeholder" })}
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="approvals-status"
            className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "approvals.filter.status.label" })}
          </label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setSearch({ status: v as StatusFilter })}
          >
            <SelectTrigger
              id="approvals-status"
              className="h-9 w-[140px] bg-surface text-sm text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {intl.formatMessage({ id: "approvals.filter.status.all" })}
              </SelectItem>
              <SelectItem value="pending">
                {intl.formatMessage({ id: "status.pending" })}
              </SelectItem>
              <SelectItem value="draft">{intl.formatMessage({ id: "status.draft" })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="approvals-pagesize"
            className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "approvals.pagination.per_page" })}
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setSearch({ page_size: Number(v) as PageSize })}
          >
            <SelectTrigger
              id="approvals-pagesize"
              className="h-9 w-[80px] bg-surface text-sm text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {values.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-3 rounded-lg border border-border bg-agentic-soft px-6 py-12 text-center"
        >
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-surface text-2xl"
            style={{ color: "var(--authority)" }}
          >
            ✓
          </span>
          <p
            className="text-lg font-semibold text-agentic-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {intl.formatMessage({ id: "approvals.empty.title" })}
          </p>
          <p className="max-w-md text-sm text-agentic-foreground/80">
            {intl.formatMessage({ id: "approvals.empty.body" })}
          </p>
          <p
            className="text-[11px] uppercase tracking-[0.18em] text-agentic-foreground/70"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "approvals.empty.tag" })}
          </p>
          <Link
            to="/config"
            className="mt-2 inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
          >
            {intl.formatMessage({ id: "approvals.empty.cta" })}
          </Link>
        </div>
      )}

      {values.length > 0 && filtered.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-dashed border-border bg-surface-sunken p-6 text-center text-sm text-foreground-muted"
        >
          <p className="font-medium text-foreground">
            {intl.formatMessage({ id: "approvals.filter.empty.title" })}
          </p>
          <p className="mt-1">{intl.formatMessage({ id: "approvals.filter.empty.body" })}</p>
          <button
            type="button"
            onClick={() => setSearch({ q: "", status: "all" })}
            className="mt-3 inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-surface-sunken"
          >
            {intl.formatMessage({ id: "approvals.filter.clear" })}
          </button>
        </div>
      )}

      {values.length > 0 && filtered.length > 0 && (
        <div className="space-y-4">
          <p
            aria-live="polite"
            className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <FormattedMessage
              id="approvals.pagination.showing"
              values={{
                shown: Math.min(visible, filtered.length),
                total: filtered.length,
              }}
            />
          </p>
          <ol role="list" className="space-y-2">
            {filtered.slice(0, visible).map((cv) => (
              <ApprovalRow key={cv.id} cv={cv} />
            ))}
          </ol>
          {visible < filtered.length && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisible((v) => v + pageSize)}
                className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FormattedMessage
                  id="approvals.pagination.load_more"
                  values={{ count: Math.min(pageSize, filtered.length - visible) }}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
