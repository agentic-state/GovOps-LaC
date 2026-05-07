import { useIntl } from "react-intl";

export function JurisdictionChip({ id }: { id: string | null }) {
  const intl = useIntl();
  const label = id ?? intl.formatMessage({ id: "config.filter.jurisdiction.global" });
  return (
    <span
      className="inline-flex items-center rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground-muted"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {label}
    </span>
  );
}
