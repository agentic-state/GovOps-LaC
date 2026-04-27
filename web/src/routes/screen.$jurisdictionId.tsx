import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ScreenShell } from "@/components/govops/ScreenShell";
import { ScreenForm } from "@/components/govops/ScreenForm";
import { ScreenResult } from "@/components/govops/ScreenResult";
import { fetchJurisdiction, submitScreen } from "@/lib/api";
import {
  SCREEN_JURISDICTIONS,
  type ScreenJurisdictionId,
  type JurisdictionResponse,
  type ScreenRequest,
  type ScreenResponse,
} from "@/lib/types";

function isValidJurisdiction(id: string): id is ScreenJurisdictionId {
  return (SCREEN_JURISDICTIONS as readonly string[]).includes(id);
}

/**
 * Network-failure fallback. Used only when the loader cannot reach
 * `/api/jurisdiction/{code}` (offline, 5xx). Kept in sync with the
 * authoritative server response shape so the citizen-facing surface
 * never renders empty strings or a broken header.
 */
const PROGRAM_LABELS: Record<ScreenJurisdictionId, JurisdictionResponse> = {
  ca: {
    id: "ca",
    jurisdiction_label: "Government of Canada",
    program_name: "Old Age Security (OAS)",
    default_language: "en",
  },
  br: {
    id: "br",
    jurisdiction_label: "República Federativa do Brasil",
    program_name: "Benefício de Prestação Continuada (BPC)",
    default_language: "pt-BR",
  },
  es: {
    id: "es",
    jurisdiction_label: "Reino de España",
    program_name: "Pensión No Contributiva",
    default_language: "es-MX",
  },
  fr: {
    id: "fr",
    jurisdiction_label: "République française",
    program_name: "Allocation de Solidarité aux Personnes Âgées (ASPA)",
    default_language: "fr",
  },
  de: {
    id: "de",
    jurisdiction_label: "Bundesrepublik Deutschland",
    program_name: "Grundsicherung im Alter",
    default_language: "de",
  },
  ua: {
    id: "ua",
    jurisdiction_label: "Україна",
    program_name: "Державна соціальна допомога",
    default_language: "uk",
  },
};

type LoaderData = { live: boolean; data: JurisdictionResponse };

export const Route = createFileRoute("/screen/$jurisdictionId")({
  head: ({ params }) => ({
    meta: [{ title: `Self-screen — ${params.jurisdictionId.toUpperCase()} — GovOps` }],
  }),
  loader: async ({ params }): Promise<LoaderData> => {
    const code = params.jurisdictionId;
    if (!isValidJurisdiction(code)) throw notFound();
    try {
      const data = await fetchJurisdiction(code);
      return { live: true, data };
    } catch {
      // Preview-mode parity: never crash the page when the backend is
      // unreachable. The component renders a small "preview mode" badge.
      return { live: false, data: PROGRAM_LABELS[code] };
    }
  },
  pendingComponent: () => <ScreenFormSkeleton />,
  component: ScreenFormPage,
  notFoundComponent: () => <UnknownJurisdiction />,
  errorComponent: ({ error, reset }) => (
    <ScreenLoaderError error={error} onRetry={reset} />
  ),
});

function ScreenFormPage() {
  const { jurisdictionId } = Route.useParams() as { jurisdictionId: ScreenJurisdictionId };
  const { live, data } = Route.useLoaderData() as LoaderData;
  const intl = useIntl();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreenResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReq, setLastReq] = useState<ScreenRequest | null>(null);

  const run = async (req: ScreenRequest) => {
    setLoading(true);
    setError(null);
    setLastReq(req);
    try {
      const res = await submitScreen(req);
      setResult(res);
      setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell showBack>
      {!live && (
        <div className="mb-4 inline-flex items-center rounded border border-agentic/30 bg-agentic/10 px-2 py-1 text-xs uppercase tracking-wide text-agentic">
          {intl.formatMessage({ id: "screen.preview_mode" })}
        </div>
      )}
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-foreground">{data.program_name}</h1>
        <p className="mt-2 text-foreground-muted">{data.jurisdiction_label}</p>
      </header>

      <section
        aria-labelledby="screen-mini-disclaimer"
        className="rounded border border-border bg-surface-sunken p-3 mb-6 text-sm text-foreground-muted"
      >
        <strong id="screen-mini-disclaimer" className="font-medium text-foreground">
          {intl.formatMessage({ id: "screen.disclaimer.title" })}.
        </strong>{" "}
        {intl.formatMessage({ id: "screen.disclaimer.footer" })}
      </section>

      <ScreenForm
        jurisdictionId={jurisdictionId}
        loading={loading}
        onSubmit={run}
        onChange={() => result && setStale(true)}
      />

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <ScreenResult
          data={result}
          stale={stale}
          jurisdictionId={jurisdictionId}
          onRerun={() => lastReq && run(lastReq)}
        />
      )}
    </ScreenShell>
  );
}

function UnknownJurisdiction() {
  const intl = useIntl();
  return (
    <ScreenShell>
      <h1 className="font-serif text-2xl">404</h1>
      <p className="mt-2 text-foreground-muted">
        {intl.formatMessage({ id: "screen.unknown_jurisdiction" })}
      </p>
      <Link
        to="/screen"
        className="mt-4 inline-block underline underline-offset-2 text-foreground"
      >
        {intl.formatMessage({ id: "screen.back" })}
      </Link>
    </ScreenShell>
  );
}

/**
 * Route-level error boundary for unexpected loader failures (i.e. anything
 * the loader's own try/catch did not absorb into the preview-mode fallback).
 * Keeps the citizen surface honest: shows what failed and a retry control,
 * never silently renders empty fields.
 */
function ScreenLoaderError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const intl = useIntl();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <ScreenShell showBack>
      <div
        role="alert"
        className="rounded border border-destructive/60 bg-destructive/5 p-4"
      >
        <h1 className="font-serif text-2xl text-destructive">
          {intl.formatMessage({ id: "screen.loader_error.title" })}
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          {intl.formatMessage({ id: "screen.loader_error.body" })}
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-surface-sunken px-2 py-1 text-xs text-foreground-muted">
          {message}
        </pre>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center rounded bg-foreground px-3 text-sm font-medium text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {intl.formatMessage({ id: "screen.loader_error.retry" })}
          </button>
          <Link
            to="/screen"
            className="inline-flex h-9 items-center text-sm underline underline-offset-2 text-foreground"
          >
            {intl.formatMessage({ id: "screen.back" })}
          </Link>
        </div>
      </div>
    </ScreenShell>
  );
}

/**
 * Pending skeleton while the loader resolves the jurisdiction metadata.
 * Matches the live header's vertical rhythm so the form doesn't jump
 * when real content lands. Respects `prefers-reduced-motion` (no shimmer).
 */
function ScreenFormSkeleton() {
  return (
    <ScreenShell showBack>
      <header className="mb-6" aria-hidden>
        <div className="h-9 w-2/3 rounded bg-surface-sunken motion-safe:animate-pulse" />
        <div className="mt-3 h-4 w-1/2 rounded bg-surface-sunken motion-safe:animate-pulse" />
      </header>
      <div
        className="rounded border border-border bg-surface-sunken p-3 mb-6 h-12 motion-safe:animate-pulse"
        aria-hidden
      />
      <div className="space-y-4" aria-hidden>
        <div className="h-10 rounded bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-10 rounded bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-24 rounded bg-surface-sunken motion-safe:animate-pulse" />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Loading…
      </p>
    </ScreenShell>
  );
}
