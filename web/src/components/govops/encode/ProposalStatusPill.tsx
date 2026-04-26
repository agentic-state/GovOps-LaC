import { useIntl } from "react-intl";
import type { ProposalStatus } from "@/lib/types";

const COLOR: Record<ProposalStatus, string> = {
  pending: "var(--verdict-pending)",
  approved: "var(--verdict-enacted)",
  modified: "var(--agentic)",
  rejected: "var(--verdict-rejected)",
};

export function ProposalStatusPill({ status }: { status: ProposalStatus }) {
  const intl = useIntl();
  const c = COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1"
      style={{
        backgroundColor: `color-mix(in oklab, ${c} 18%, transparent)`,
        color: c,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 40%, transparent)`,
        fontFamily: "var(--font-mono)",
      }}
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ backgroundColor: c }} />
      {intl.formatMessage({ id: `proposal_status.${status}` })}
    </span>
  );
}
