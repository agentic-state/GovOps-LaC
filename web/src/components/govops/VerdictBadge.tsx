import { useIntl } from "react-intl";

export type Verdict = "enacted" | "pending" | "rejected" | "draft";

const variantStyles: Record<Verdict, { bg: string; fg: string; ring: string }> = {
  enacted: {
    bg: "color-mix(in oklab, var(--verdict-enacted) 18%, transparent)",
    fg: "var(--verdict-enacted)",
    ring: "color-mix(in oklab, var(--verdict-enacted) 40%, transparent)",
  },
  pending: {
    bg: "color-mix(in oklab, var(--verdict-pending) 22%, transparent)",
    fg: "var(--verdict-pending)",
    ring: "color-mix(in oklab, var(--verdict-pending) 45%, transparent)",
  },
  rejected: {
    bg: "color-mix(in oklab, var(--verdict-rejected) 18%, transparent)",
    fg: "var(--verdict-rejected)",
    ring: "color-mix(in oklab, var(--verdict-rejected) 40%, transparent)",
  },
  draft: {
    bg: "color-mix(in oklab, var(--verdict-draft) 18%, transparent)",
    fg: "var(--foreground-muted)",
    ring: "color-mix(in oklab, var(--verdict-draft) 40%, transparent)",
  },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const intl = useIntl();
  const s = variantStyles[verdict];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1"
      style={{
        backgroundColor: s.bg,
        color: s.fg,
        boxShadow: `inset 0 0 0 1px ${s.ring}`,
        fontFamily: "var(--font-mono)",
      }}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: s.fg }}
      />
      {intl.formatMessage({ id: `verdict.${verdict}` })}
    </span>
  );
}
