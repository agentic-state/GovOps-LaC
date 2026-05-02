import { Link } from "@tanstack/react-router";

/**
 * Default route-level error UI used by TanStack Router's `errorComponent`.
 * Keeps the user inside the app shell (Masthead + footer still render) and
 * gives them a "Try again" affordance powered by the router's `reset` callback.
 */
export function RouteError({ error, reset }: { error: Error; reset?: () => void }) {
  const message = error?.message || "Something unexpected happened while rendering this page.";

  return (
    <div
      role="alert"
      className="space-y-4 rounded-md border p-6"
      style={{
        borderColor: "var(--verdict-rejected)",
        backgroundColor: "color-mix(in oklch, var(--verdict-rejected) 6%, transparent)",
      }}
    >
      <p
        className="text-xs uppercase tracking-[0.2em]"
        style={{
          color: "var(--verdict-rejected)",
          fontFamily: "var(--font-mono)",
        }}
      >
        error · runtime
      </p>
      <h1
        className="text-2xl tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
      >
        We couldn’t render this page.
      </h1>
      <p className="text-sm text-foreground-muted">{message}</p>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {reset && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
          >
            Try again
          </button>
        )}
        <Link
          to="/"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
