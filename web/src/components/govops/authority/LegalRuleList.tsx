import { useIntl } from "react-intl";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import { CitationLink } from "@/components/govops/CitationLink";
import type { LegalRule, RuleType } from "@/lib/types";

export function LegalRuleList({
  rules,
  highlightedIds,
  onViewSource,
}: {
  rules: LegalRule[];
  highlightedIds: Set<string> | null;
  onViewSource: (docId: string, sectionRef: string) => void;
}) {
  const intl = useIntl();
  return (
    <section aria-labelledby="rules-heading" className="space-y-4">
      <h2
        id="rules-heading"
        className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "authority.rules.heading" })}
      </h2>
      {rules.length === 0 && (
        <p className="text-sm text-foreground-muted">
          {intl.formatMessage({ id: "authority.rules.empty" })}
        </p>
      )}
      <ul className="space-y-3">
        {rules.map((rule) => {
          const dim = highlightedIds && !highlightedIds.has(rule.id);
          return (
            <li
              key={rule.id}
              className={`flex items-stretch rounded-md border border-border bg-surface-raised
                transition-opacity ${dim ? "opacity-50" : ""}`}
            >
              <ProvenanceRibbon variant="hybrid" />
              <div className="flex-1 space-y-3 p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <RuleTypeChip type={rule.rule_type} />
                  <p className="text-sm text-foreground">{rule.description}</p>
                </div>
                <CitationLink citation={rule.citation} />
                <details className="text-xs">
                  <summary
                    className="cursor-pointer text-foreground-muted underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {intl.formatMessage({ id: "authority.rules.formal_expression" })}
                  </summary>
                  <pre
                    className="mt-2 overflow-x-auto rounded-sm border border-border bg-surface-sunken p-2 text-foreground"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {rule.formal_expression}
                  </pre>
                </details>
                {Object.keys(rule.parameters).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-foreground-muted underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {intl.formatMessage({ id: "authority.rules.parameters" })}
                    </summary>
                    <table className="mt-2 w-full text-left text-xs">
                      <tbody>
                        {Object.entries(rule.parameters).map(([k, v]) => (
                          <tr key={k} className="border-b border-border/60 last:border-0">
                            <th
                              className="py-1 pe-3 align-top font-normal text-foreground-subtle"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {k}
                            </th>
                            <td
                              className="py-1 align-top text-foreground"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
                <button
                  type="button"
                  onClick={() => onViewSource(rule.source_document_id, rule.source_section_ref)}
                  className="text-xs text-authority underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {intl.formatMessage({ id: "authority.rules.view_source" })}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RuleTypeChip({ type }: { type: RuleType }) {
  const intl = useIntl();
  return (
    <span
      className="inline-flex items-center rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground-muted"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {intl.formatMessage({ id: `rule_type.${type}` })}
    </span>
  );
}