import { useState } from "react";
import { useIntl } from "react-intl";
import type { ValueType } from "@/lib/types";

/**
 * Type-aware value renderer for ConfigValue payloads.
 * - prompt: collapsed by default with expand toggle, serif font for prose feel
 * - list/enum/formula/object: monospace JSON
 * - bool: pill, number/string: monospace inline
 */
export function ValueRenderer({ value, type }: { value: unknown; type: ValueType }) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);

  if (type === "prompt") {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const isLong = text.length > 220;
    return (
      <div className="space-y-2">
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground ${
            !expanded && isLong ? "line-clamp-3" : ""
          }`}
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {text}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-xs font-medium text-foreground-muted hover:text-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {expanded
              ? intl.formatMessage({ id: "value.collapse" })
              : intl.formatMessage({ id: "value.expand" })}
          </button>
        )}
      </div>
    );
  }

  if (type === "bool") {
    const truthy = value === true || value === "true";
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: truthy
            ? "color-mix(in oklch, var(--verdict-enacted) 14%, transparent)"
            : "color-mix(in oklch, var(--foreground-muted) 14%, transparent)",
          color: truthy ? "var(--verdict-enacted)" : "var(--foreground-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {String(truthy)}
      </span>
    );
  }

  if (type === "number" || type === "string") {
    return (
      <code
        className="rounded-sm bg-surface-sunken px-2 py-1 text-sm text-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {String(value)}
      </code>
    );
  }

  // list, enum, formula, fallback
  return (
    <pre
      className="overflow-x-auto rounded-sm bg-surface-sunken p-3 text-sm text-foreground"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
