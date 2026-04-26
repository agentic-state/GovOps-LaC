import { useState } from "react";
import { useIntl } from "react-intl";
import { ChevronDown, BookOpen } from "lucide-react";

/**
 * Runbook — collapsible scenario guide rendered inline on console pages.
 * Each scenario has a title and an ordered list of numbered steps the
 * operator can follow. The runbook collapses by default to keep the
 * working surface uncluttered; expanding it persists on the page.
 *
 * Caller passes a `prefix` (e.g. "runbook.config") and a `scenarios`
 * array — each item is an object literal with the suffix keys needed to
 * resolve the scenario title and step bodies. i18n keys follow:
 *   {prefix}.title
 *   {prefix}.lead
 *   {prefix}.{scenarioId}.title
 *   {prefix}.{scenarioId}.step1 ... stepN
 */

export type RunbookScenario = {
  id: string;
  steps: number;
};

export function Runbook({
  prefix,
  scenarios,
}: {
  prefix: string;
  scenarios: RunbookScenario[];
}) {
  const intl = useIntl();
  const [openId, setOpenId] = useState<string | null>(null);
  const t = (id: string) => intl.formatMessage({ id });

  return (
    <section
      aria-labelledby={`${prefix}-heading`}
      className="rounded-md border border-border bg-surface-sunken p-5"
    >
      <header className="flex items-start gap-3">
        <BookOpen
          className="mt-0.5 size-4 shrink-0"
          style={{ color: "var(--agentic)" }}
          aria-hidden
        />
        <div className="space-y-1">
          <p
            className="text-xs uppercase tracking-[0.22em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {t("runbook.eyebrow")}
          </p>
          <h2
            id={`${prefix}-heading`}
            className="text-base font-medium text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t(`${prefix}.title`)}
          </h2>
          <p className="text-sm text-foreground-muted">{t(`${prefix}.lead`)}</p>
        </div>
      </header>

      <ul role="list" className="mt-4 space-y-2">
        {scenarios.map((sc) => {
          const isOpen = openId === sc.id;
          return (
            <li
              key={sc.id}
              className="rounded-md border border-border bg-surface"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${prefix}-${sc.id}-body`}
                onClick={() => setOpenId(isOpen ? null : sc.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-sunken"
              >
                <span style={{ fontFamily: "var(--font-serif)" }}>
                  {t(`${prefix}.${sc.id}.title`)}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-foreground-muted transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <ol
                  id={`${prefix}-${sc.id}-body`}
                  role="list"
                  className="space-y-2 border-t border-border px-4 py-3 text-sm text-foreground-muted"
                >
                  {Array.from({ length: sc.steps }, (_, i) => i + 1).map((n) => (
                    <li key={n} className="flex gap-3">
                      <span
                        className="shrink-0 text-xs text-foreground-subtle"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {`0${n}`}
                      </span>
                      <span>{t(`${prefix}.${sc.id}.step${n}`)}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
