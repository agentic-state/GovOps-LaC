import { useIntl } from "react-intl";
import type { ConfigValue, CreateConfigValueRequest, ValueType } from "@/lib/types";
import { TimelineCard } from "./TimelineCard";

/**
 * Live preview of how the in-progress draft will appear in the timeline once
 * submitted. Synthesizes a ConfigValue with status="pending" and renders the
 * existing TimelineCard so the preview matches production exactly.
 *
 * Inputs are the *form-state* values, not coerced — we coerce defensively so
 * the preview stays useful even before validation passes.
 */
export function DraftPreview({
  draft,
  prior,
}: {
  draft: {
    key: string;
    jurisdiction: string;
    domain: string;
    valueType: ValueType;
    value: unknown;
    effectiveFrom: string;
    citation: string;
    rationale: string;
    language: string;
    author: string;
  };
  prior: ConfigValue | null;
}) {
  const intl = useIntl();

  const synthetic: ConfigValue = {
    id: "preview",
    domain: draft.domain,
    key: draft.key || "(unset.key)",
    jurisdiction_id: draft.jurisdiction === "global" ? null : draft.jurisdiction,
    value: previewValue(draft.value, draft.valueType),
    value_type: draft.valueType,
    effective_from: draft.effectiveFrom || new Date().toISOString(),
    effective_to: null,
    citation: draft.citation.trim() || null,
    author: draft.author,
    approved_by: null,
    rationale: draft.rationale.trim(),
    supersedes: prior?.id ?? null,
    status: "pending",
    language: draft.domain === "ui" ? draft.language : null,
    created_at: new Date().toISOString(),
  };

  return (
    <section aria-label={intl.formatMessage({ id: "draft.preview.title" })} className="space-y-3">
      <header className="space-y-1">
        <p
          className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: "draft.preview.title" })}
        </p>
        <p className="text-xs text-foreground-muted">
          {intl.formatMessage({ id: "draft.preview.caption" })}
        </p>
      </header>

      {prior && (
        <p
          className="text-xs"
          style={{ color: "var(--authority-foreground)", fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage(
            { id: "draft.preview.supersedes" },
            { date: new Date(prior.effective_from) },
          )}
        </p>
      )}

      <ol role="list" className="relative space-y-4 ps-6">
        <span aria-hidden className="absolute inset-y-3 start-2 w-px bg-border" />
        <li className="relative">
          <span
            aria-hidden
            className="absolute -start-[18px] top-5 size-2.5 rounded-full"
            style={{
              backgroundColor: synthetic.author.startsWith("agent:")
                ? "var(--agentic)"
                : "var(--authority)",
            }}
          />
          <TimelineCard cv={synthetic} isCurrent selected={false} onSelectToggle={() => {}} />
        </li>

        {prior && (
          <li className="relative opacity-70">
            <span
              aria-hidden
              className="absolute -start-[18px] top-5 size-2.5 rounded-full"
              style={{
                backgroundColor: prior.author.startsWith("agent:")
                  ? "var(--agentic)"
                  : "var(--authority)",
              }}
            />
            <TimelineCard cv={prior} isCurrent={false} selected={false} onSelectToggle={() => {}} />
          </li>
        )}
      </ol>
    </section>
  );
}

/** Best-effort coercion for preview only — never throws. */
function previewValue(raw: unknown, type: ValueType): unknown {
  if (raw === "" || raw === undefined || raw === null) {
    if (type === "list" || type === "enum") return [];
    if (type === "bool") return false;
    if (type === "number") return 0;
    return "";
  }
  if (type === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (type === "formula" && typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
