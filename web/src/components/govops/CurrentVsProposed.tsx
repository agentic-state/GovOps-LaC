import { useIntl } from "react-intl";
import type { ConfigValue } from "@/lib/types";
import { DiffPane } from "./DiffPane";

/**
 * Side-by-side panes used on the approval review page.
 * `current` is the resolved record currently in effect; null when this
 * draft would be the first version. `proposed` is the draft/pending record
 * under review.
 * Stacks below 768px (md) and side-by-side above.
 */
export function CurrentVsProposed({
  current,
  proposed,
}: {
  current: ConfigValue | null;
  proposed: ConfigValue;
}) {
  const intl = useIntl();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <article aria-labelledby="pane-current-heading" className="space-y-2">
        <h2
          id="pane-current-heading"
          className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: "approvals.pane.current" })}
        </h2>
        {current ? (
          <DiffPane cv={current} side="from" labelId="pane-current-label" />
        ) : (
          <div
            className="rounded-md border border-dashed border-border bg-surface-sunken p-6 text-center text-sm text-foreground-muted"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "approvals.pane.no_prior" })}
          </div>
        )}
      </article>

      <article aria-labelledby="pane-proposed-heading" className="space-y-2">
        <h2
          id="pane-proposed-heading"
          className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: "approvals.pane.proposed" })}
        </h2>
        <DiffPane cv={proposed} side="to" labelId="pane-proposed-label" />
      </article>
    </div>
  );
}
