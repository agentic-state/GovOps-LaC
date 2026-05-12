import { useMemo, useState } from "react";
import { useIntl, FormattedDate } from "react-intl";
import { Badge } from "@/components/ui/badge";
import type { CaseEvent, CaseEventType, Recommendation } from "@/lib/types";
import { OutcomePill } from "./OutcomePill";

export interface EventTimelineProps {
  events: CaseEvent[];
  recommendations: Recommendation[];
  caseId: string;
}

function summarizeKey(eventType: string): string {
  return `events.summary.${eventType}`;
}

function payloadValues(e: CaseEvent): Record<string, string> {
  const p = e.payload ?? {};
  switch (e.event_type) {
    case "move_country":
      return {
        from: String(p.from_country ?? "—"),
        to: String(p.to_country ?? "—"),
      };
    case "change_legal_status":
      return { to_status: String(p.to_status ?? "—") };
    case "add_evidence":
      return { evidence_type: String(p.evidence_type ?? "—") };
    default:
      return {};
  }
}

/**
 * Vertical timeline of CaseEvents (govops-019). Reads as a single sequence;
 * rows render in chronological order with payload summaries and a chip linking
 * the recommendation each event triggered (if any).
 */
const EVENT_TYPES: CaseEventType[] = [
  "re_evaluate",
  "move_country",
  "change_legal_status",
  "add_evidence",
];
const FILTER_THRESHOLD = 5;

export function EventTimeline({ events, recommendations }: EventTimelineProps) {
  const intl = useIntl();
  const [active, setActive] = useState<Set<CaseEventType>>(new Set(EVENT_TYPES));
  const showFilters = events.length > FILTER_THRESHOLD;

  const visible = useMemo(
    () => (showFilters ? events.filter((e) => active.has(e.event_type)) : events),
    [events, active, showFilters],
  );

  const sorted = [...visible].sort((a, b) => {
    const cmp = a.effective_date.localeCompare(b.effective_date);
    return cmp !== 0 ? cmp : a.recorded_at.localeCompare(b.recorded_at);
  });

  const recById = new Map(recommendations.map((r) => [r.id, r]));

  const toggle = (t: CaseEventType) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      // never end up with 0 — re-enable everything if user cleared the last chip
      if (next.size === 0) return new Set(EVENT_TYPES);
      return next;
    });
  };

  const filterBar = showFilters ? (
    <div
      className="mb-3 flex flex-wrap items-center gap-2"
      role="group"
      aria-label={intl.formatMessage({ id: "events.timeline.filter_label" })}
    >
      {EVENT_TYPES.map((t) => {
        const on = active.has(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            aria-pressed={on}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              on
                ? "border-authority/50 bg-authority/10 text-authority"
                : "border-border bg-surface text-foreground-muted hover:bg-surface-raised"
            }`}
          >
            {intl.formatMessage({ id: `events.type.${t}` })}
          </button>
        );
      })}
    </div>
  ) : null;

  if (sorted.length === 0) {
    return (
      <>
        {filterBar}
        <p className="text-sm text-foreground-muted">
          {intl.formatMessage({ id: "events.timeline.empty" })}
        </p>
      </>
    );
  }

  return (
    <>
      {filterBar}
      <ol role="list" className="relative space-y-4 ps-6">
        <span aria-hidden className="absolute inset-y-2 start-2 w-px bg-border" />
        {sorted.map((e) => {
          const triggered = e.triggered_recommendation_id
            ? recById.get(e.triggered_recommendation_id)
            : null;
          return (
            <li key={e.id} id={`event-${e.id}`} className="relative scroll-mt-24">
              <span
                aria-hidden
                className="absolute -start-[18px] top-3 size-2.5 rounded-full bg-authority"
              />
              <article className="rounded-md border border-border bg-surface p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <FormattedDate
                      value={e.effective_date}
                      year="numeric"
                      month="short"
                      day="numeric"
                    />
                  </span>
                  <Badge variant="secondary">
                    {intl.formatMessage({ id: `events.type.${e.event_type}` })}
                  </Badge>
                  <span className="text-sm text-foreground">
                    {intl.formatMessage({ id: summarizeKey(e.event_type) }, payloadValues(e))}
                  </span>
                  {triggered && (
                    <a
                      href={`#recommendation-${triggered.id}`}
                      className="ms-auto inline-flex"
                      aria-label={intl.formatMessage(
                        { id: "events.timeline.jump_to_recommendation" },
                        {
                          date: intl.formatDate(e.effective_date, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }),
                          outcome: intl.formatMessage({
                            id: `outcome.${triggered.outcome}`,
                            defaultMessage: triggered.outcome,
                          }),
                        },
                      )}
                    >
                      <OutcomePill outcome={triggered.outcome} />
                    </a>
                  )}
                </div>
                {e.note && <p className="mt-2 text-sm text-foreground-muted">{e.note}</p>}
                <p
                  className="mt-1 text-[11px] text-foreground-subtle"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {e.actor}
                </p>
              </article>
            </li>
          );
        })}
      </ol>
    </>
  );
}
