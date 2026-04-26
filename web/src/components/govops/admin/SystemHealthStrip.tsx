import { useIntl } from "react-intl";
import type { HealthResponse } from "@/lib/types";

export function SystemHealthStrip({ health }: { health: HealthResponse | null }) {
  const intl = useIntl();
  if (!health) return null;
  return (
    <footer
      aria-labelledby="health-heading"
      className="rounded-md border border-border bg-surface px-4 py-3"
    >
      <h2 id="health-heading" className="sr-only">
        {intl.formatMessage({ id: "admin.health.heading" })}
      </h2>
      <dl
        className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-foreground-muted"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <div>
          <dt className="sr-only">status</dt>
          <dd>
            {intl.formatMessage({ id: "admin.health.status" }, { status: health.status })}
          </dd>
        </div>
        <div>
          <dt className="sr-only">version</dt>
          <dd>
            {intl.formatMessage({ id: "admin.health.version" }, { version: health.version })}
          </dd>
        </div>
        <div>
          <dt className="sr-only">jurisdiction</dt>
          <dd>
            {intl.formatMessage(
              { id: "admin.health.jurisdiction" },
              { code: health.jurisdiction },
            )}
          </dd>
        </div>
        <div>
          <dt className="sr-only">program</dt>
          <dd>
            {intl.formatMessage({ id: "admin.health.program" }, { program: health.program })}
          </dd>
        </div>
      </dl>
    </footer>
  );
}
