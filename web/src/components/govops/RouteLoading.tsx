import { cn } from "@/lib/utils";

/**
 * Unified pending-component shimmer for TanStack Router routes.
 *
 * `variant`:
 *   - "list"   → vertical stack of N rows of fixed height (default).
 *   - "split"  → 2-column grid of cards (used by diff/detail pages).
 *   - "panel"  → header banner + 2-card grid (approvals detail).
 */
export function RouteLoading({
  variant = "list",
  rows = 3,
  rowHeight = 88,
  className,
}: {
  variant?: "list" | "split" | "panel";
  rows?: number;
  rowHeight?: number;
  className?: string;
}) {
  if (variant === "split") {
    return (
      <div
        className={cn("grid gap-4 md:grid-cols-2", className)}
        aria-busy="true"
        role="status"
        aria-label="Loading"
      >
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2 rounded-md border border-border bg-surface p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-sunken" />
            <div className="h-3 w-full animate-pulse rounded bg-surface-sunken" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-surface-sunken" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div
        className={cn("space-y-6", className)}
        aria-busy="true"
        role="status"
        aria-label="Loading"
      >
        <div className="h-24 animate-pulse rounded-md bg-surface-sunken" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-72 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-72 animate-pulse rounded-md bg-surface-sunken" />
        </div>
      </div>
    );
  }

  return (
    <ul role="status" aria-busy="true" aria-label="Loading" className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          style={{ height: rowHeight }}
          className="animate-pulse rounded-md border border-border bg-surface-sunken"
        />
      ))}
    </ul>
  );
}
