import { FormattedDate, useIntl } from "react-intl";
import { Link } from "@tanstack/react-router";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import { ValueTypeBadge } from "./ValueTypeBadge";
import { JurisdictionChip } from "./JurisdictionChip";
import { CitationHighlight } from "./CitationHighlight";
import type { ConfigValue } from "@/lib/types";

function previewValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

export interface ConfigValueRowProps {
  cv: ConfigValue;
  /** When set and non-empty, the citation is rendered with `<CitationHighlight>` against this query. */
  highlightQuery?: string;
  /** When false, the per-row JurisdictionChip cell and column are omitted. Defaults to true. */
  showJurisdictionChip?: boolean;
}

export function ConfigValueRow({
  cv,
  highlightQuery,
  showJurisdictionChip = true,
}: ConfigValueRowProps) {
  const provenance = cv.author.startsWith("agent:") ? "agent" : "human";
  const intl = useIntl();
  const hasQuery = Boolean(highlightQuery && highlightQuery.length > 0);
  const matchLabel = hasQuery
    ? intl.formatMessage({ id: "impact.match.aria" }, { query: highlightQuery })
    : undefined;
  const gridCols = showJurisdictionChip
    ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto_auto]"
    : "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto]";
  return (
    <li>
      <Link
        to="/config/$key/$jurisdictionId"
        params={{
          key: cv.key,
          jurisdictionId: cv.jurisdiction_id ?? "global",
        }}
        className="flex items-stretch rounded-md border border-border bg-surface outline-none transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken"
      >
        <ProvenanceRibbon variant={provenance} />
        <div
          className={`grid flex-1 grid-cols-1 items-center gap-3 px-4 py-3 ${gridCols} sm:gap-4`}
        >
          <div className="min-w-0">
            <div
              className="truncate text-sm text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {cv.key}
            </div>
            {cv.citation && (
              <div
                className="mt-1 truncate text-xs text-foreground-subtle hover:underline"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {hasQuery ? (
                  <CitationHighlight
                    text={cv.citation}
                    query={highlightQuery!}
                    matchLabel={matchLabel}
                  />
                ) : (
                  cv.citation
                )}
              </div>
            )}
          </div>
          <div className="min-w-0 truncate text-sm text-foreground-muted">
            {previewValue(cv.value)}
          </div>
          <ValueTypeBadge type={cv.value_type} />
          {showJurisdictionChip && <JurisdictionChip id={cv.jurisdiction_id} />}
          <div className="text-xs text-foreground-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <FormattedDate value={cv.effective_from} year="numeric" month="short" day="numeric" />
          </div>
        </div>
      </Link>
    </li>
  );
}
