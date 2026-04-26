import type { CSSProperties, ReactNode } from "react";
import { useIntl } from "react-intl";

/**
 * Shared field-level UI primitives for the draft form.
 *
 * Centralizes the "rejected" verdict styling so individual field
 * components don't repeat `style={{ color: "var(--verdict-rejected)" }}`
 * across a dozen sites — and keeps the design-token surface tight if we
 * later swap the token name.
 */

export const ERROR_COLOR_STYLE: CSSProperties = {
  color: "var(--verdict-rejected)",
};

export const ERROR_BORDER_STYLE: CSSProperties = {
  borderColor: "var(--verdict-rejected)",
};

/** Visual asterisk for required fields (decorative — aria-hidden). */
export function RequiredMark({ when = true }: { when?: boolean }) {
  if (!when) return null;
  return (
    <span aria-hidden style={ERROR_COLOR_STYLE}>
      {" "}
      *
    </span>
  );
}

/** Error message paragraph wired up to its parent input via id. */
export function ErrorMessage({
  id,
  messageId,
  values,
}: {
  id: string;
  messageId: string;
  values?: Record<string, string | number>;
}) {
  const intl = useIntl();
  return (
    <p id={id} role="alert" className="text-xs" style={ERROR_COLOR_STYLE}>
      {intl.formatMessage({ id: messageId }, values)}
    </p>
  );
}

export function HelpText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-foreground-muted">
      {children}
    </p>
  );
}
