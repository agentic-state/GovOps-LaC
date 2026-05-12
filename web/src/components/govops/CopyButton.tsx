import { useState } from "react";
import { useIntl } from "react-intl";

/**
 * Inline copy-to-clipboard button. Announces success via aria-live.
 * Falls back gracefully if clipboard API is unavailable.
 */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore — the value is still visible on screen
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? intl.formatMessage({ id: "timeline.copy_key" })}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] font-medium text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span aria-live="polite">
        {copied
          ? intl.formatMessage({ id: "timeline.copied" })
          : intl.formatMessage({ id: "timeline.copy_key" })}
      </span>
    </button>
  );
}
