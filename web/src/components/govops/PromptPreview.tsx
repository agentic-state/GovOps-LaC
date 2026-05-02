import { useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown";

/**
 * Rendered markdown preview pane. Consumes the live editor value and feeds
 * it through the sanitized renderer. Wrapped in a region with a serif body
 * (statute register) so prompts read like the documents they author.
 */
export function PromptPreview({ value, ariaLabel }: { value: string; ariaLabel: string }) {
  const html = useMemo(() => renderMarkdown(value), [value]);
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className="prose-prompt h-full overflow-auto rounded-md border border-border p-4"
      style={{
        backgroundColor: "var(--surface-sunken)",
        fontFamily: "var(--font-serif)",
        color: "var(--foreground)",
      }}
      dangerouslySetInnerHTML={{
        __html: html || '<p style="opacity:.6"><em>Nothing to preview yet.</em></p>',
      }}
    />
  );
}
