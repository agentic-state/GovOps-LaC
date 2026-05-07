import { useIntl } from "react-intl";

/**
 * Marker shown on prompt-type drafts in the approvals list. Per PLAN.md
 * Gate 4, prompt approvals will eventually require two approvers; this is a
 * UI-only placeholder until the Phase 4 backend mechanism lands.
 */
export function DualApprovalBadge() {
  const intl = useIntl();
  return (
    <span
      title={intl.formatMessage({ id: "prompt.dual_approval.tooltip" })}
      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em]"
      style={{
        fontFamily: "var(--font-mono)",
        backgroundColor: "color-mix(in oklch, var(--civic-gold-400) 18%, transparent)",
        color: "var(--civic-gold-700)",
        borderColor: "var(--civic-gold-400)",
      }}
    >
      <span aria-hidden>✓✓</span>
      {intl.formatMessage({ id: "prompt.dual_approval.badge" })}
    </span>
  );
}
