import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { Plus } from "lucide-react";
import { listEncodingBatches } from "@/lib/api";
import type { EncodingBatchSummary } from "@/lib/types";
import { BatchRow } from "@/components/govops/encode/BatchRow";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";

export const Route = createFileRoute("/encode")({
  head: () => ({
    meta: [
      { title: "Encode — GovOps" },
      {
        name: "description",
        content: "Statute → proposals → review → commit. The Law-as-Code pipeline.",
      },
    ],
  }),
  loader: async () => {
    const batches = await listEncodingBatches();
    return { batches };
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading rows={4} />,
  component: EncodeRouteComponent,
});

function EncodeRouteComponent() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <EncodeListPage />;
}

function EncodeListPage() {
  const intl = useIntl();
  const { batches } = Route.useLoaderData() as { batches: EncodingBatchSummary[] };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1
            className="text-3xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "encode.list.heading" })}
          </h1>
          <p className="text-sm text-foreground-muted">
            {intl.formatMessage({ id: "encode.list.lede" })}
          </p>
        </div>
        <Button asChild variant="agent">
          <Link to="/encode/new">
            <Plus className="size-4" aria-hidden />
            {intl.formatMessage({ id: "encode.list.new" })}
          </Link>
        </Button>
      </header>

      {batches.length === 0 ? (
        <div
          className="rounded-md border border-dashed p-8 text-center"
          style={{
            borderColor: "color-mix(in oklab, var(--agentic) 40%, transparent)",
            backgroundColor: "var(--agentic-soft)",
          }}
        >
          <p
            className="text-lg text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {intl.formatMessage({ id: "encode.list.empty.title" })}
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            {intl.formatMessage({ id: "encode.list.empty.body" })}
          </p>
          <Button asChild variant="agent" className="mt-4">
            <Link to="/encode/new">
              <Plus className="size-4" aria-hidden />
              {intl.formatMessage({ id: "encode.list.new" })}
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {batches.map((b) => (
            <BatchRow key={b.id} batch={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
