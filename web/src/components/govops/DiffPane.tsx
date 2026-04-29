import { FormattedDate, useIntl } from "react-intl";
import type { ConfigValue } from "@/lib/types";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import { ValueRenderer } from "./ValueRenderer";

/**
 * Single side of the diff view: full readable form of one ConfigValue.
 * The visual overlay (ribbon) stays semantic; the textual diff is rendered
 * separately by ValueDiff / DiffMetadataStrip on the parent route.
 */
export function DiffPane({
  cv,
  side,
  labelId,
}: {
  cv: ConfigValue;
  side: "from" | "to";
  labelId: string;
}) {
  const intl = useIntl();
  const provenance = cv.author.startsWith("agent:") ? "agent" : "human";

  return (
    <section
      aria-labelledby={labelId}
      className="flex items-stretch rounded-md border border-border bg-surface"
    >
      <ProvenanceRibbon variant={provenance} />
      <div className="flex-1 space-y-3 px-4 py-4">
        <header className="space-y-1">
          <p
            id={labelId}
            className="text-[10px] uppercase tracking-[0.18em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: `diff.label.${side}` })}
          </p>
          <p
            className="text-2xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            <FormattedDate value={cv.effective_from} year="numeric" month="short" day="numeric" />
          </p>
        </header>

        <ValueRenderer value={cv.value} type={cv.value_type} />

        <dl className="grid grid-cols-1 gap-y-2 text-sm">
          {cv.citation && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                {intl.formatMessage({ id: "config.detail.citation" })}
              </dt>
              <dd className="text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {cv.citation}
              </dd>
            </div>
          )}
          {cv.rationale && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
                {intl.formatMessage({ id: "config.detail.rationale" })}
              </dt>
              <dd className="text-foreground">{cv.rationale}</dd>
            </div>
          )}
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              {intl.formatMessage({ id: "config.detail.author" })}
            </dt>
            <dd className="text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {cv.author}
              {cv.approved_by &&
                ` · ${intl.formatMessage({ id: "config.detail.approved_by" })}: ${cv.approved_by}`}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
