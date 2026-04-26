import { useIntl } from "react-intl";
import type { DecisionOutcome } from "@/lib/types";

const OUTCOME_VAR: Record<DecisionOutcome, string> = {
  eligible: "var(--verdict-enacted)",
  ineligible: "var(--verdict-rejected)",
  insufficient_evidence: "var(--verdict-pending)",
  escalate: "var(--verdict-pending)",
};

export function OutcomePill({ outcome }: { outcome: DecisionOutcome }) {
  const intl = useIntl();
  const c = OUTCOME_VAR[outcome];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1"
      style={{
        backgroundColor: `color-mix(in oklab, ${c} 18%, transparent)`,
        color: c,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 40%, transparent)`,
        fontFamily: "var(--font-mono)",
      }}
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ backgroundColor: c }} />
      {intl.formatMessage({ id: `outcome.${outcome}` })}
    </span>
  );
}
