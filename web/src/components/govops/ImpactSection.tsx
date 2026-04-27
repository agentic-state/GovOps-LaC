import { FormattedMessage } from "react-intl";
import type { ImpactResult } from "@/lib/types";
import { JurisdictionChip } from "./JurisdictionChip";
import { ConfigValueRow } from "./ConfigValueRow";

export function ImpactSection({ result, query }: { result: ImpactResult; query: string }) {
  const id = `impact-section-${result.jurisdiction_id ?? "global"}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <header className="mb-3 flex items-center gap-3 border-b border-border pb-2">
        <h2 id={id} className="text-lg text-foreground" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
          {result.jurisdiction_id === null ? (
            <FormattedMessage id="impact.section.global" />
          ) : (
            result.jurisdiction_label
          )}
        </h2>
        <JurisdictionChip id={result.jurisdiction_id} />
        <span
          className="ms-auto text-xs text-foreground-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <FormattedMessage id="impact.section.count" values={{ count: result.values.length }} />
        </span>
      </header>
      <ol role="list" className="space-y-2">
        {result.values.map((cv) => (
          <ConfigValueRow
            key={cv.id}
            cv={cv}
            highlightQuery={query}
            showJurisdictionChip={false}
          />
        ))}
      </ol>
    </section>
  );
}
