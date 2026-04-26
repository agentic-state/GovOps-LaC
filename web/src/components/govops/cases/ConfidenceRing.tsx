import { useIntl } from "react-intl";

export function ConfidenceRing({ value }: { value: number }) {
  const intl = useIntl();
  const pct = Math.max(0, Math.min(1, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div
      role="img"
      aria-label={intl.formatMessage(
        { id: "cases.confidence.aria" },
        { pct: Math.round(pct * 100) },
      )}
      className="relative h-24 w-24"
    >
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--agentic)"
          strokeWidth="12"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm text-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatNumber(pct, { style: "percent", maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}
