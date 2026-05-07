import { useIntl } from "react-intl";
import type { ReviewActionType } from "@/lib/types";

export function ActionPill({ action }: { action: ReviewActionType }) {
  const intl = useIntl();
  return (
    <span
      className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {intl.formatMessage({ id: `cases.review.action.${action}` })}
    </span>
  );
}
