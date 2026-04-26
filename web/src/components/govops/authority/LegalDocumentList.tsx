import { useIntl, FormattedDate } from "react-intl";
import { ProvenanceRibbon } from "@/components/govops/ProvenanceRibbon";
import type { DocumentType, LegalDocument } from "@/lib/types";

export function LegalDocumentList({
  documents,
  highlightedIds,
  expandedSection,
  onClearExpand,
}: {
  documents: LegalDocument[];
  highlightedIds: Set<string> | null;
  expandedSection: { docId: string; sectionRef: string } | null;
  onClearExpand?: () => void;
}) {
  const intl = useIntl();
  return (
    <section aria-labelledby="documents-heading" className="space-y-4">
      <h2
        id="documents-heading"
        className="text-xs uppercase tracking-[0.18em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "authority.documents.heading" })}
      </h2>
      {documents.length === 0 && (
        <p className="text-sm text-foreground-muted">
          {intl.formatMessage({ id: "authority.documents.empty" })}
        </p>
      )}
      <ul className="space-y-3">
        {documents.map((doc) => {
          const dim = highlightedIds && !highlightedIds.has(doc.id);
          return (
            <li
              key={doc.id}
              className={`flex items-stretch rounded-md border border-border bg-surface-raised
                transition-opacity ${dim ? "opacity-50" : ""}`}
            >
              <ProvenanceRibbon variant="human" />
              <div className="flex-1 space-y-2 p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <DocumentTypeChip type={doc.document_type} />
                  <h3
                    className="text-base text-foreground"
                    style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                  >
                    {doc.title}
                  </h3>
                </div>
                <p
                  className="text-xs text-foreground-muted"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {doc.citation}
                  {doc.effective_date && (
                    <>
                      {" · "}
                      <FormattedDate value={doc.effective_date} year="numeric" month="short" />
                    </>
                  )}
                </p>
                {doc.sections.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {doc.sections.map((s) => {
                      const auto =
                        expandedSection?.docId === doc.id &&
                        expandedSection?.sectionRef === s.section_ref;
                      return (
                        <details
                          key={s.id}
                          open={auto || undefined}
                          className="rounded-sm border border-border/60 bg-surface px-3 py-2"
                          onToggle={(e) => {
                            if (!(e.currentTarget as HTMLDetailsElement).open && auto)
                              onClearExpand?.();
                          }}
                        >
                          <summary
                            className="flex cursor-pointer items-baseline gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={intl.formatMessage(
                              { id: "authority.documents.section.aria" },
                              { ref: s.section_ref, title: doc.title },
                            )}
                          >
                            <span
                              className="text-foreground-subtle"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              {s.section_ref}
                            </span>
                            <span
                              className="text-foreground"
                              style={{ fontFamily: "var(--font-serif)" }}
                            >
                              {s.heading}
                            </span>
                          </summary>
                          <p className="statute-text mt-2">{s.text}</p>
                        </details>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DocumentTypeChip({ type }: { type: DocumentType }) {
  const intl = useIntl();
  return (
    <span
      className="inline-flex items-center rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground-muted"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {intl.formatMessage({ id: `document_type.${type}` })}
    </span>
  );
}