import { useIntl } from "react-intl";
import { ArrowRight } from "lucide-react";

/**
 * PipelineDiagram — visual rendering of the FKTE (Fractal Knowledge
 * Transformation Engine) four-step flow on /about §3. Steps stack
 * vertically on mobile and lay out horizontally with arrow connectors
 * on sm+ screens.
 *
 * Rendered as `role="img"` so screen readers receive a single descriptive
 * label rather than reading every individual step + arrow glyph.
 */
const STEPS = [
  "about.fkte.unstructured",
  "about.fkte.structured",
  "about.fkte.executable",
  "about.fkte.operational",
] as const;

export function PipelineDiagram() {
  const intl = useIntl();
  const ariaLabel = intl.formatMessage({ id: "about.fkte.aria_label" });
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2">
        {STEPS.map((id, i) => (
          <div key={id} className="flex items-center gap-2">
            <div
              className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id })}
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="text-foreground-subtle hidden sm:block"
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-foreground-muted">
        {intl.formatMessage({ id: "about.fkte.caption" })}
      </p>
    </div>
  );
}