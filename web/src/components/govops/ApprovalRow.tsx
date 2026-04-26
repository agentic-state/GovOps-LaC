import { Link } from "@tanstack/react-router";
import { FormattedRelativeTime, useIntl } from "react-intl";
import type { ConfigValue } from "@/lib/types";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import { ValueRenderer } from "./ValueRenderer";
import { JurisdictionChip } from "./JurisdictionChip";
import { DualApprovalBadge } from "./DualApprovalBadge";

/**
 * Single row in the approvals queue. Mirrors the visual rhythm of
 * `ConfigValueRow` but emphasises the *who*, *when*, and *what status* —
 * the maintainer's primary scanning columns on this screen.
 */
export function ApprovalRow({ cv }: { cv: ConfigValue }) {
  const intl = useIntl();
  const provenance = cv.author.startsWith("agent:") ? "agent" : "human";
  const ageSeconds = Math.floor((new Date(cv.created_at).getTime() - Date.now()) / 1000);

  return (
    <li className="list-none">
      <Link
        to="/config/approvals/$id"
        params={{ id: cv.id }}
        className="group block focus-visible:outline-none"
      >
        <article
          aria-label={`${cv.key} — ${intl.formatMessage({ id: `status.${cv.status}` })}`}
          className="flex items-stretch rounded-md border border-border bg-surface transition-colors hover:bg-surface-sunken group-focus-visible:ring-2 group-focus-visible:ring-ring"
        >
          <ProvenanceRibbon variant={provenance} />
          <div className="grid flex-1 grid-cols-1 items-start gap-3 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto] sm:items-center">
            <div className="min-w-0 space-y-1">
              <p
                className="truncate text-sm text-foreground"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {cv.key}
              </p>
              <p className="text-xs text-foreground-muted">
                {intl.formatMessage({ id: "approvals.row.author" }, { author: cv.author })} ·{" "}
                <FormattedRelativeTime
                  value={ageSeconds}
                  numeric="auto"
                  updateIntervalInSeconds={60}
                />
                {cv.supersedes && (
                  <>
                    {" · "}
                    <span style={{ fontFamily: "var(--font-mono)" }}>↻ supersedes</span>
                  </>
                )}
              </p>
            </div>
            <div className="min-w-0 text-sm text-foreground-muted">
              <ValueRenderer value={cv.value} type={cv.value_type} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <JurisdictionChip id={cv.jurisdiction_id} />
              {cv.value_type === "prompt" && <DualApprovalBadge />}
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--verdict-pending) 14%, transparent)",
                  color: "var(--verdict-pending)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {intl.formatMessage({ id: `status.${cv.status}` })}
              </span>
            </div>
          </div>
        </article>
      </Link>
    </li>
  );
}
