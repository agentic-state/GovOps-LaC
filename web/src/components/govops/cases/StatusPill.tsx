import { useIntl } from "react-intl";
import type { Verdict } from "../VerdictBadge";
import type { CaseStatus } from "@/lib/types";

const STATUS_TO_VERDICT: Record<CaseStatus, Verdict> = {
  intake: "draft",
  evaluating: "pending",
  recommendation_ready: "pending",
  under_review: "pending",
  decided: "enacted",
  escalated: "rejected",
};

export function StatusPill({ status }: { status: CaseStatus }) {
  const intl = useIntl();
  const verdict = STATUS_TO_VERDICT[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1"
      style={{
        backgroundColor: `color-mix(in oklab, var(--verdict-${verdict}) 18%, transparent)`,
        color: `var(--verdict-${verdict})`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(--verdict-${verdict}) 40%, transparent)`,
        fontFamily: "var(--font-mono)",
      }}
      title={intl.formatMessage({ id: `status.${status}` })}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: `var(--verdict-${verdict})` }}
      />
      {intl.formatMessage({ id: `status.${status}` })}
    </span>
  );
}
