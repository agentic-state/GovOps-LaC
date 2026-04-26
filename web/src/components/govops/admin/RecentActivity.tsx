import { useIntl } from "react-intl";
import type { ActivityEvent } from "@/lib/aggregations";

function relative(intl: ReturnType<typeof useIntl>, iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return intl.formatRelativeTime(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return intl.formatRelativeTime(hours, "hour");
  const days = Math.round(hours / 24);
  return intl.formatRelativeTime(days, "day");
}

export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  const intl = useIntl();
  return (
    <section
      aria-labelledby="activity-heading"
      className="space-y-3 rounded-md border border-border bg-surface-raised p-5"
    >
      <h2
        id="activity-heading"
        className="text-lg text-foreground"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
      >
        {intl.formatMessage({ id: "admin.activity.heading" })}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-foreground-muted">
          {intl.formatMessage({ id: "admin.activity.empty" })}
        </p>
      ) : (
        <ol className="space-y-2">
          {events.map((e, i) => (
            <li
              key={i}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                <span style={{ fontFamily: "var(--font-mono)" }}>{e.event_type}</span>
                <span>·</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{e.actor}</span>
                <a
                  href={e.source.to}
                  className="ms-auto text-xs underline-offset-2 hover:underline"
                >
                  {relative(intl, e.timestamp)}
                </a>
              </div>
              <p className="mt-1 text-foreground">{e.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
