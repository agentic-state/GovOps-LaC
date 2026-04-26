import { useIntl } from "react-intl";
import type { HumanReviewAction } from "@/lib/types";
import { ActionPill } from "./ActionPill";
import { OutcomePill } from "./OutcomePill";

export function ReviewLog({ reviews }: { reviews: HumanReviewAction[] }) {
  const intl = useIntl();
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage({ id: "cases.review.empty" })}
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-md border border-border bg-surface p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ActionPill action={r.action} />
            {r.final_outcome && <OutcomePill outcome={r.final_outcome} />}
            <span
              className="text-xs text-foreground-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {r.reviewer}
            </span>
            <span className="ms-auto text-xs text-foreground-muted">
              {intl.formatDate(r.timestamp, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
          <p className="mt-2 text-foreground">{r.rationale}</p>
        </li>
      ))}
    </ol>
  );
}
