import { FormattedDate, useIntl } from "react-intl";
import type { ConfigValue } from "@/lib/types";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import { ValueRenderer } from "./ValueRenderer";
import { CitationLink } from "./CitationLink";

function statusTone(status: ConfigValue["status"]): {
  bg: string;
  fg: string;
} {
  switch (status) {
    case "approved":
      return { bg: "var(--verdict-enacted)", fg: "var(--verdict-enacted)" };
    case "pending":
      return { bg: "var(--verdict-pending)", fg: "var(--verdict-pending)" };
    case "rejected":
      return { bg: "var(--verdict-rejected)", fg: "var(--verdict-rejected)" };
    case "draft":
    default:
      return { bg: "var(--foreground-muted)", fg: "var(--foreground-muted)" };
  }
}

export function TimelineCard({
  cv,
  isCurrent,
  selected,
  onSelectToggle,
}: {
  cv: ConfigValue;
  isCurrent: boolean;
  selected: boolean;
  onSelectToggle: (id: string) => void;
}) {
  const intl = useIntl();
  const provenance = cv.author.startsWith("agent:") ? "agent" : "human";
  const now = new Date();
  const from = new Date(cv.effective_from);
  const to = cv.effective_to ? new Date(cv.effective_to) : null;
  const isFuture = from.getTime() > now.getTime();
  const inEffect =
    cv.status === "approved" && !isFuture && (to === null || to.getTime() > now.getTime());
  const isApproved = cv.status === "approved";
  const tone = statusTone(cv.status);

  return (
    <article
      aria-label={intl.formatMessage(
        { id: "timeline.card.aria" },
        { key: cv.key, date: cv.effective_from },
      )}
      className={`flex items-stretch rounded-md border border-border bg-surface transition-opacity ${
        isApproved ? "" : "opacity-50"
      }`}
    >
      <ProvenanceRibbon variant={provenance} />
      <div className="flex-1 space-y-3 px-4 py-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div
              className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {isCurrent
                ? intl.formatMessage({ id: "config.detail.current" })
                : intl.formatMessage({ id: "config.detail.superseded" })}
            </div>
            <div className="text-sm text-foreground-muted">
              <FormattedDate value={cv.effective_from} year="numeric" month="short" day="numeric" />
              <span className="mx-1.5">→</span>
              {to ? (
                <FormattedDate value={to} year="numeric" month="short" day="numeric" />
              ) : (
                <span
                  className="font-medium"
                  style={{ color: inEffect ? "var(--authority)" : "var(--foreground-muted)" }}
                >
                  {intl.formatMessage({ id: "timeline.in_effect" })}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isFuture && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--verdict-pending) 14%, transparent)",
                  color: "var(--verdict-pending)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {intl.formatMessage({ id: "timeline.scheduled" })}
              </span>
            )}
            {!isApproved && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `color-mix(in oklch, ${tone.bg} 14%, transparent)`,
                  color: tone.fg,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {intl.formatMessage({ id: `status.${cv.status}` })}
              </span>
            )}
            <label className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelectToggle(cv.id)}
                className="size-3.5 cursor-pointer accent-[color:var(--agentic)]"
              />
              {intl.formatMessage({ id: "timeline.compare" })}
            </label>
          </div>
        </header>

        <ValueRenderer value={cv.value} type={cv.value_type} />

        {cv.citation && <CitationLink citation={cv.citation} />}

        {cv.rationale && <p className="line-clamp-4 text-sm text-foreground">{cv.rationale}</p>}

        <footer
          className="border-t border-border pt-2 text-[11px] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {cv.author}
          {cv.approved_by &&
            ` · ${intl.formatMessage({ id: "config.detail.approved_by" })}: ${cv.approved_by}`}
        </footer>
      </div>
    </article>
  );
}
