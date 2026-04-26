import { useIntl } from "react-intl";
import { Check, X } from "lucide-react";
import type { ResidencyPeriod } from "@/lib/types";

export function ResidencyTimeline({ periods }: { periods: ResidencyPeriod[] }) {
  const intl = useIntl();
  if (periods.length === 0) {
    return <p className="text-sm text-foreground-muted">—</p>;
  }
  return (
    <ul className="space-y-2">
      {periods.map((p, i) => (
        <li
          key={`${p.country}-${p.start_date}-${i}`}
          className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
        >
          <span
            className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {p.country}
          </span>
          <span className="flex-1 text-sm text-foreground">
            {intl.formatDate(p.start_date, { dateStyle: "medium" })} —{" "}
            {p.end_date
              ? intl.formatDate(p.end_date, { dateStyle: "medium" })
              : intl.formatMessage({ id: "cases.residency.ongoing" })}
          </span>
          {p.verified ? (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--verdict-enacted)" }}>
              <Check className="size-3.5" aria-hidden />
              {intl.formatMessage({ id: "cases.residency.verified" })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
              <X className="size-3.5" aria-hidden />
              {intl.formatMessage({ id: "cases.residency.unverified" })}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
