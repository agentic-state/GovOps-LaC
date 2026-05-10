import { Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";

import type { ApprovalStatus } from "@/lib/types";

/**
 * Banner shown on the approval-detail page when the proposal is no longer
 * in a `draft` or `pending` state. Without this, a stale-loader cache plus
 * an unguarded action panel let reviewers re-approve an already-resolved
 * record (the 2026-05-07 bug-2 report). Whenever the action panel would
 * fail server-side anyway, we render this notice instead of the actions.
 */
export function ResolvedNotice({ status }: { status: ApprovalStatus }) {
  const intl = useIntl();
  const titleId =
    status === "approved"
      ? "approvals.resolved.approved.title"
      : status === "rejected"
        ? "approvals.resolved.rejected.title"
        : "approvals.resolved.generic.title";
  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby="resolved-heading"
      className="space-y-3 rounded-md border border-border bg-surface p-5"
    >
      <h2
        id="resolved-heading"
        className="text-lg tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
      >
        {intl.formatMessage({ id: titleId })}
      </h2>
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage(
          { id: "approvals.resolved.body" },
          { status: intl.formatMessage({ id: `status.${status}` }) },
        )}
      </p>
      <Link
        to="/config/approvals"
        className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
      >
        {intl.formatMessage({ id: "approvals.back_to_queue" })}
      </Link>
    </section>
  );
}
