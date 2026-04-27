import { useIntl } from "react-intl";

/**
 * AuthorityChainDiagram — visual rendering of the eight-step
 * jurisdiction-first authority chain on /about §5: every recommendation
 * must trace from Decision back to Jurisdiction.
 *
 * Rendered as `role="img"` so screen readers receive a single descriptive
 * label rather than reading every individual chain step + arrow.
 */
const STEPS = [
  "about.chain.jurisdiction",
  "about.chain.constitution",
  "about.chain.authority",
  "about.chain.law",
  "about.chain.regulation",
  "about.chain.program",
  "about.chain.service",
  "about.chain.decision",
] as const;

export function AuthorityChainDiagram() {
  const intl = useIntl();
  const ariaLabel = intl.formatMessage({ id: "about.chain.aria_label" });
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="rounded-lg border border-border bg-surface p-6"
    >
      <ol
        className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {STEPS.map((id, i) => (
          <li key={id} className="flex items-center gap-2 text-sm">
            <span className="rounded bg-surface-sunken px-2 py-1">
              {intl.formatMessage({ id })}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-foreground-subtle" aria-hidden="true">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-foreground-muted">
        {intl.formatMessage({ id: "about.chain.caption" })}
      </p>
    </div>
  );
}