import { useIntl } from "react-intl";
import { ProvenanceRibbon, type ProvenanceVariant } from "../ProvenanceRibbon";

export function StatTile({
  labelKey,
  value,
  to,
  provenance,
  recentActivity,
  loading,
  errorMsg,
}: {
  labelKey: string;
  value: number;
  to: string;
  provenance: ProvenanceVariant;
  recentActivity: boolean;
  loading?: boolean;
  errorMsg?: string | null;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: labelKey });
  const trendTip = intl.formatMessage({
    id: recentActivity ? "admin.trend.recent" : "admin.trend.quiet",
  });
  return (
    <a
      href={to}
      aria-label={`${value} ${label}`}
      className="group flex items-stretch rounded-lg border border-border bg-surface-raised outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ProvenanceRibbon variant={provenance} />
      <div className="relative flex flex-1 flex-col gap-2 p-5">
        <span
          title={trendTip}
          aria-hidden="true"
          className={`absolute end-3 top-3 inline-block h-2 w-2 rounded-full ${
            recentActivity ? "bg-authority" : "bg-foreground-muted"
          }`}
        />
        {loading ? (
          <span className="h-9 w-16 animate-pulse rounded bg-surface-sunken" />
        ) : errorMsg ? (
          <span
            className="text-3xl text-foreground-muted"
            style={{ fontFamily: "var(--font-mono)" }}
            title={errorMsg}
          >
            —
          </span>
        ) : (
          <span
            className="text-3xl text-foreground"
            style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
          >
            {intl.formatNumber(value)}
          </span>
        )}
        <span className="text-sm text-foreground-muted">{label}</span>
      </div>
    </a>
  );
}
