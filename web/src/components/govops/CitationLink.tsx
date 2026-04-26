import { useState } from "react";
import { useIntl } from "react-intl";

/**
 * Citation link that opens a lightweight inline drawer (details/summary) with
 * the full citation text. Spec govops-004 reserves a dedicated drawer surface
 * for later — this disclosure is the in-flow stand-in.
 */
export function CitationLink({ citation }: { citation: string }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-4 hover:underline"
        style={{ fontFamily: "var(--font-mono)", color: "var(--authority)" }}
      >
        <svg
          aria-hidden
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {intl.formatMessage({ id: "config.detail.citation" })}: {citation}
      </button>
      {open && (
        <div
          role="region"
          aria-label={intl.formatMessage({ id: "config.detail.citation" })}
          className="mt-2 rounded-md border border-border bg-surface-sunken p-3 text-sm text-foreground"
        >
          {citation}
        </div>
      )}
    </div>
  );
}
