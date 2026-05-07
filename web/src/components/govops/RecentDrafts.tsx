import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useIntl, FormattedRelativeTime } from "react-intl";
import { X } from "lucide-react";

import {
  DRAFTS_EVENT,
  emitDraftsChanged,
  listRecentDrafts,
  removeRecentDraft,
  clearAllRecentDrafts,
  type RecentDraft,
} from "@/lib/draftStorage";

/**
 * Reads the locally-persisted save-as-draft snapshots and renders them as
 * quick-switch links. Re-renders on storage updates (cross-tab) and on the
 * custom `DRAFTS_EVENT` (same-tab, fired when this form saves a new draft).
 */
export function RecentDrafts({ activeSearch }: { activeSearch?: string }) {
  const intl = useIntl();
  const [drafts, setDrafts] = useState<RecentDraft[]>([]);

  useEffect(() => {
    const refresh = () => setDrafts(listRecentDrafts());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(DRAFTS_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(DRAFTS_EVENT, refresh);
    };
  }, []);

  if (drafts.length === 0) return null;

  return (
    <aside
      aria-label={intl.formatMessage({ id: "draft.recent.title" })}
      className="rounded-md border border-border bg-surface-raised p-4"
    >
      <h2
        className="mb-2 text-xs uppercase tracking-[0.18em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span className="flex items-center justify-between gap-2">
          <span>{intl.formatMessage({ id: "draft.recent.title" })}</span>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(intl.formatMessage({ id: "draft.recent.clear_confirm" }))) return;
              clearAllRecentDrafts();
              emitDraftsChanged();
            }}
            className="text-[10px] normal-case tracking-normal text-foreground-muted underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {intl.formatMessage({ id: "draft.recent.clear" })}
          </button>
        </span>
      </h2>
      <ul role="list" className="space-y-1.5">
        {drafts.map((d) => {
          const isActive = activeSearch === d.search;
          const ageSec = (d.savedAt - Date.now()) / 1000;
          return (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-sm px-2 py-1 hover:bg-surface-sunken"
              style={
                isActive
                  ? { backgroundColor: "color-mix(in oklch, var(--authority) 8%, transparent)" }
                  : undefined
              }
            >
              <Link
                to="/config/draft"
                search={Object.fromEntries(new URLSearchParams(d.search))}
                className="flex min-w-0 flex-1 items-baseline gap-2 text-sm text-foreground hover:underline focus-visible:outline-none focus-visible:underline"
              >
                <span
                  className="truncate"
                  style={{ fontFamily: "var(--font-mono)" }}
                  title={d.label}
                >
                  {d.label}
                </span>
                <span className="shrink-0 text-[11px] text-foreground-subtle">
                  <FormattedRelativeTime
                    value={Math.round(ageSec)}
                    numeric="auto"
                    updateIntervalInSeconds={30}
                  />
                </span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  removeRecentDraft(d.id);
                  emitDraftsChanged();
                }}
                aria-label={intl.formatMessage({ id: "draft.recent.remove" }, { label: d.label })}
                className="rounded-sm p-1 text-foreground-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
