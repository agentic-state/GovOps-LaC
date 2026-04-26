import { useIntl } from "react-intl";
import type { ConfigValue } from "@/lib/types";

/**
 * Read-only context strip shown when drafting a supersession. Renders the
 * key being replaced and the prior version's effective_from date.
 */
export function SupersedesPanel({ prior }: { prior: ConfigValue }) {
  const intl = useIntl();
  return (
    <aside
      aria-label={intl.formatMessage({ id: "draft.field.supersedes.title" })}
      className="rounded-md border p-4"
      style={{
        borderColor: "var(--authority)",
        backgroundColor: "color-mix(in oklch, var(--authority) 6%, transparent)",
      }}
    >
      <p
        className="text-xs uppercase tracking-[0.18em]"
        style={{ color: "var(--authority-foreground)", fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "draft.field.supersedes.title" })}
      </p>
      <p className="mt-2 text-sm text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        {prior.key}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        {intl.formatMessage(
          { id: "draft.field.supersedes.detail" },
          { date: new Date(prior.effective_from) },
        )}
      </p>
    </aside>
  );
}
