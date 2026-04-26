import { FormattedDate, useIntl } from "react-intl";
import type { ConfigValue } from "@/lib/types";

type Field = "effective_from" | "citation" | "author" | "status";

function valueOf(cv: ConfigValue, field: Field): string {
  switch (field) {
    case "effective_from":
      return cv.effective_from;
    case "citation":
      return cv.citation ?? "—";
    case "author":
      return cv.author;
    case "status":
      return cv.status;
  }
}

/**
 * 4-column metadata diff strip. Unchanged fields show once in muted tone;
 * changed fields show `from ⇒ to` with the diff color tokens.
 */
export function DiffMetadataStrip({ from, to }: { from: ConfigValue; to: ConfigValue }) {
  const intl = useIntl();
  const fields: Field[] = ["effective_from", "citation", "author", "status"];

  return (
    <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-4 print:grid-cols-4">
      {fields.map((field) => {
        const fromVal = valueOf(from, field);
        const toVal = valueOf(to, field);
        const unchanged = fromVal === toVal;

        return (
          <div key={field} className="space-y-1">
            <dt
              className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id: `diff.metadata.${field}` })}
            </dt>
            <dd className="text-sm">
              {unchanged ? (
                <span
                  className="text-foreground-muted"
                  style={{ fontFamily: "var(--font-mono)" }}
                  title={intl.formatMessage({ id: "diff.metadata.unchanged" })}
                >
                  {field === "effective_from" ? (
                    <FormattedDate value={fromVal} year="numeric" month="short" day="numeric" />
                  ) : field === "status" ? (
                    intl.formatMessage({ id: `status.${from.status}` })
                  ) : (
                    fromVal
                  )}
                </span>
              ) : (
                <div className="space-y-1" style={{ fontFamily: "var(--font-mono)" }}>
                  <span
                    aria-label={intl.formatMessage({ id: "diff.aria.removed" })}
                    className="block rounded px-1.5 py-0.5 line-through"
                    style={{
                      backgroundColor: "var(--diff-removed-bg)",
                      color: "var(--diff-removed-fg)",
                    }}
                  >
                    {field === "effective_from" ? (
                      <FormattedDate value={fromVal} year="numeric" month="short" day="numeric" />
                    ) : field === "status" ? (
                      intl.formatMessage({ id: `status.${from.status}` })
                    ) : (
                      fromVal
                    )}
                  </span>
                  <span
                    aria-label={intl.formatMessage({ id: "diff.aria.added" })}
                    className="block rounded px-1.5 py-0.5 underline"
                    style={{
                      backgroundColor: "var(--diff-added-bg)",
                      color: "var(--diff-added-fg)",
                    }}
                  >
                    {field === "effective_from" ? (
                      <FormattedDate value={toVal} year="numeric" month="short" day="numeric" />
                    ) : field === "status" ? (
                      intl.formatMessage({ id: `status.${to.status}` })
                    ) : (
                      toVal
                    )}
                  </span>
                </div>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
