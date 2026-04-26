import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useIntl } from "react-intl";

/**
 * Breadcrumb trail. Caller passes the trail explicitly so we can render
 * meaningful labels for parametric segments (e.g., a ConfigValue key, an
 * approval id) rather than the raw URL.
 *
 * The home crumb is always included implicitly. Pass i18n message ids for
 * stable labels; pass plain strings for runtime values (keys, ids).
 */

export type BreadcrumbItem = {
  label: string; // either an i18n id (preferred for stable labels) OR plain text
  i18n?: boolean; // if true, label is treated as an intl message id
  to?: string; // omit for the current page (last item)
  params?: Record<string, string>; // for parametric routes
  truncate?: boolean; // for long values like ConfigValue keys
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const intl = useIntl();
  const homeLabel = intl.formatMessage({ id: "breadcrumb.home" });

  function render(label: string, i18n?: boolean) {
    if (i18n) return intl.formatMessage({ id: label });
    return label;
  }

  return (
    <nav
      aria-label={intl.formatMessage({ id: "breadcrumb.label" })}
      // Sticky just below the masthead. The masthead is `sticky top-0` with
      // py-4 + 24px text content, so it sits at ~64px tall; we anchor the
      // breadcrumb at top-[3.75rem] (60px) so it tucks against the masthead's
      // bottom border and stays visible while scrolling deep pages.
      className="sticky top-[3.75rem] z-30 -mx-6 mb-6 border-b border-border bg-surface/85 px-6 py-2.5 backdrop-blur"
      data-testid="breadcrumb"
    >
      <ol
        role="list"
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 text-sm text-foreground-muted"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <li className="flex items-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-surface-sunken hover:text-foreground"
            aria-label={homeLabel}
          >
            <Home className="size-3.5" aria-hidden />
            <span className="sr-only">{homeLabel}</span>
          </Link>
        </li>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const text = render(item.label, item.i18n);
          const truncated = item.truncate && text.length > 32 ? `…${text.slice(-30)}` : text;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-foreground-subtle" aria-hidden />
              {isLast || !item.to ? (
                <span
                  aria-current="page"
                  className="px-1 py-0.5 text-foreground"
                  title={item.truncate ? text : undefined}
                >
                  {truncated}
                </span>
              ) : (
                <Link
                  to={item.to}
                  params={item.params as never}
                  className="rounded-sm px-1 py-0.5 hover:bg-surface-sunken hover:text-foreground"
                  title={item.truncate ? text : undefined}
                >
                  {truncated}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
