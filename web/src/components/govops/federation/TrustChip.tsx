import { useIntl } from "react-intl";
import type { FederationTrustStatus } from "@/lib/federation-types";

const TRUST_TONE: Record<FederationTrustStatus, string> = {
  trusted: "var(--verdict-enacted)",
  unsigned_only: "var(--verdict-pending)",
  untrusted: "var(--verdict-rejected)",
};

export function TrustChip({ status }: { status: FederationTrustStatus }) {
  const intl = useIntl();
  const c = TRUST_TONE[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
      style={{
        backgroundColor: `color-mix(in oklab, ${c} 14%, transparent)`,
        color: c,
        fontFamily: "var(--font-mono)",
      }}
    >
      {intl.formatMessage({ id: `admin.federation.trust.${status}` })}
    </span>
  );
}
