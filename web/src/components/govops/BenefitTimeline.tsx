import { useIntl } from "react-intl";
import type { CheckBenefitPeriod } from "@/lib/types";

/**
 * Bounded-benefit timeline visualization (Phase G).
 *
 * Renders a horizontal bar showing how many weeks of a time-bounded
 * program (currently EI) the citizen has consumed vs. remaining. The
 * shape is reusable for any program that emits a `BenefitPeriod` —
 * unemployment insurance is the v3 instance, but the same component
 * lights up for any future bounded program (parental leave, sickness,
 * retraining grant) without code changes.
 *
 * Accessibility:
 *   - The progress bar uses ARIA progressbar semantics so screen readers
 *     announce "X of Y weeks remaining" without the visual.
 *   - Date strings are exposed as plain text alongside the bar so the
 *     same content is reachable in any rendering mode.
 */
export function BenefitTimeline({ period }: { period: CheckBenefitPeriod }) {
  const intl = useIntl();
  const consumed = Math.max(0, period.weeks_total - period.weeks_remaining);
  const consumedPct =
    period.weeks_total > 0
      ? Math.min(100, Math.round((consumed / period.weeks_total) * 100))
      : 0;

  return (
    <section
      aria-labelledby="benefit-timeline-heading"
      className="space-y-3 rounded-md border border-border bg-surface p-4"
      data-testid="benefit-timeline"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3
          id="benefit-timeline-heading"
          className="text-base text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "check.timeline.heading" })}
        </h3>
        <p
          className="text-xs text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage(
            { id: "check.timeline.weeksSummary" },
            {
              remaining: period.weeks_remaining,
              total: period.weeks_total,
            },
          )}
        </p>
      </header>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={period.weeks_total}
        aria-valuenow={consumed}
        aria-valuetext={intl.formatMessage(
          { id: "check.timeline.ariaProgress" },
          {
            consumed,
            total: period.weeks_total,
            remaining: period.weeks_remaining,
          },
        )}
        className="h-3 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className="h-full bg-foreground/70 transition-[width] duration-300"
          style={{ width: `${consumedPct}%` }}
        />
      </div>

      <dl
        className="grid grid-cols-2 gap-3 text-xs"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <div>
          <dt className="uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.timeline.startLabel" })}
          </dt>
          <dd className="mt-1 text-foreground">{period.start_date}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.15em] text-foreground-subtle">
            {intl.formatMessage({ id: "check.timeline.endLabel" })}
          </dt>
          <dd className="mt-1 text-foreground">{period.end_date}</dd>
        </div>
      </dl>

      {period.citations.length > 0 && (
        <ul
          className="space-y-1 text-xs text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {period.citations.map((c, i) => (
            <li key={`${c}-${i}`}>{c}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
