import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useIntl } from "react-intl";
import type { ConfigValue, ValueType } from "@/lib/types";

function stringify(value: unknown, type: ValueType): string {
  if (type === "prompt" || type === "string") return String(value ?? "");
  if (type === "formula") return JSON.stringify(value, null, 2);
  return JSON.stringify(value, null, 2);
}

/**
 * Type-aware value diff. For primitives it renders an inline `before → after`;
 * for textual / structured types it delegates to react-diff-viewer-continued
 * with GovOps palette overrides.
 * Color is paired with line-through / underline so meaning never depends on
 * color alone (a11y: color-blindness, monochrome printing).
 */
export function ValueDiff({ from, to }: { from: ConfigValue; to: ConfigValue }) {
  const intl = useIntl();

  if (from.value_type !== to.value_type) {
    return (
      <div
        role="alert"
        className="rounded-md border p-3 text-sm"
        style={{
          borderColor: "var(--verdict-rejected)",
          color: "var(--verdict-rejected)",
          backgroundColor: "color-mix(in oklch, var(--verdict-rejected) 6%, transparent)",
        }}
      >
        Type mismatch: {from.value_type} → {to.value_type}. Cannot diff values directly.
      </div>
    );
  }

  const fromStr = stringify(from.value, from.value_type);
  const toStr = stringify(to.value, to.value_type);

  if (fromStr === toStr) {
    return (
      <p
        className="text-sm italic text-foreground-muted"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "diff.value.unchanged" })}
      </p>
    );
  }

  if (from.value_type === "number" || from.value_type === "bool") {
    return (
      <div
        className="flex flex-wrap items-center gap-3 text-lg"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span
          aria-label={intl.formatMessage({ id: "diff.aria.removed" })}
          className="rounded px-2 py-0.5 line-through"
          style={{
            backgroundColor: "var(--diff-removed-bg)",
            color: "var(--diff-removed-fg)",
          }}
        >
          {fromStr}
        </span>
        {/* LTR arrow stays LTR — semantically denotes from→to in source order */}
        <span aria-hidden="true">→</span>
        <span
          aria-label={intl.formatMessage({ id: "diff.aria.added" })}
          className="rounded px-2 py-0.5 underline"
          style={{
            backgroundColor: "var(--diff-added-bg)",
            color: "var(--diff-added-fg)",
          }}
        >
          {toStr}
        </span>
      </div>
    );
  }

  if (from.value_type === "list" || from.value_type === "enum") {
    const a = Array.isArray(from.value) ? (from.value as unknown[]) : [];
    const b = Array.isArray(to.value) ? (to.value as unknown[]) : [];
    const aStrs = a.map(String);
    const bStrs = b.map(String);
    const removed = aStrs.filter((x) => !bStrs.includes(x));
    const added = bStrs.filter((x) => !aStrs.includes(x));
    return (
      <ul role="list" className="space-y-1 text-sm" style={{ fontFamily: "var(--font-mono)" }}>
        {removed.map((x) => (
          <li
            key={`r-${x}`}
            aria-label={intl.formatMessage({ id: "diff.aria.removed" })}
            className="rounded px-2 py-0.5 line-through"
            style={{
              backgroundColor: "var(--diff-removed-bg)",
              color: "var(--diff-removed-fg)",
            }}
          >
            − {x}
          </li>
        ))}
        {added.map((x) => (
          <li
            key={`a-${x}`}
            aria-label={intl.formatMessage({ id: "diff.aria.added" })}
            className="rounded px-2 py-0.5 underline"
            style={{
              backgroundColor: "var(--diff-added-bg)",
              color: "var(--diff-added-fg)",
            }}
          >
            + {x}
          </li>
        ))}
        {removed.length === 0 && added.length === 0 && (
          <li className="italic text-foreground-muted">
            {intl.formatMessage({ id: "diff.value.unchanged" })}
          </li>
        )}
      </ul>
    );
  }

  // string / prompt / formula → unified text diff
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <ReactDiffViewer
        oldValue={fromStr}
        newValue={toStr}
        splitView={false}
        hideLineNumbers={from.value_type !== "prompt" && from.value_type !== "formula"}
        compareMethod={DiffMethod.WORDS}
        styles={{
          variables: {
            light: {
              diffViewerBackground: "var(--surface)",
              diffViewerColor: "var(--foreground)",
              addedBackground: "var(--diff-added-bg)",
              addedColor: "var(--diff-added-fg)",
              removedBackground: "var(--diff-removed-bg)",
              removedColor: "var(--diff-removed-fg)",
              wordAddedBackground: "var(--diff-added-bg)",
              wordRemovedBackground: "var(--diff-removed-bg)",
              gutterBackground: "var(--surface-sunken)",
              gutterColor: "var(--foreground-subtle)",
              codeFoldGutterBackground: "var(--surface-sunken)",
              codeFoldBackground: "var(--surface-sunken)",
              emptyLineBackground: "var(--surface)",
            },
          },
          contentText: { fontFamily: "var(--font-mono)", fontSize: "0.875rem" },
        }}
      />
    </div>
  );
}
