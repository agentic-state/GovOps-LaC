import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useIntl } from "react-intl";

import { getAuthorityChain, listLegalDocuments, listRules } from "@/lib/api";
import { JurisdictionHeader } from "@/components/govops/authority/JurisdictionHeader";
import { ChainGraph } from "@/components/govops/authority/ChainGraph";
import { LegalDocumentList } from "@/components/govops/authority/LegalDocumentList";
import { LegalRuleList } from "@/components/govops/authority/LegalRuleList";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";
import type {
  AuthorityReference,
  DocumentType,
  Jurisdiction,
  LegalDocument,
  LegalRule,
  RuleType,
} from "@/lib/types";

interface LoaderData {
  chain: { jurisdiction: Jurisdiction; chain: AuthorityReference[] };
  documents: LegalDocument[];
  rules: LegalRule[];
}

export const Route = createFileRoute("/authority")({
  head: () => ({
    meta: [
      { title: "Authority chain — GovOps" },
      {
        name: "description",
        content:
          "Trace any operational rule back through every layer of authority that legitimizes it.",
      },
    ],
  }),
  loader: async (): Promise<LoaderData> => {
    const [chain, documents, rules] = await Promise.all([
      getAuthorityChain(),
      listLegalDocuments(),
      listRules(),
    ]);
    return { chain, documents: documents.documents, rules: rules.rules };
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading variant="panel" />,
  component: AuthorityPage,
});

const DOC_TYPES: DocumentType[] = ["statute", "regulation", "policy_manual", "guidance"];
const RULE_TYPES: RuleType[] = [
  "age_threshold",
  "residency_minimum",
  "residency_partial",
  "legal_status",
  "evidence_required",
  "exclusion",
];

function AuthorityPage() {
  const intl = useIntl();
  const data = Route.useLoaderData() as LoaderData;
  const { chain, documents, rules } = data;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState<"all" | DocumentType>("all");
  const [ruleFilter, setRuleFilter] = useState<"all" | RuleType>("all");
  const [expandedSection, setExpandedSection] = useState<{
    docId: string;
    sectionRef: string;
  } | null>(null);

  const q = search.trim().toLowerCase();
  const filteredDocs = useMemo(
    () =>
      documents.filter((d) => {
        if (docFilter !== "all" && d.document_type !== docFilter) return false;
        if (q && !d.citation.toLowerCase().includes(q) && !d.title.toLowerCase().includes(q))
          return false;
        return true;
      }),
    [documents, docFilter, q],
  );
  const filteredRules = useMemo(
    () =>
      rules.filter((r) => {
        if (ruleFilter !== "all" && r.rule_type !== ruleFilter) return false;
        if (q && !r.citation.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q))
          return false;
        return true;
      }),
    [rules, ruleFilter, q],
  );

  // Highlight subset based on chain selection. With the OAS fixture every doc
  // and rule maps to the act/regulation/policy layers; we use a simple heuristic
  // tying layer → document_type. In real backend this would come from the link table.
  const { highlightedDocIds, highlightedRuleIds } = useMemo<{
    highlightedDocIds: Set<string> | null;
    highlightedRuleIds: Set<string> | null;
  }>(() => {
    if (!selectedNodeId) return { highlightedDocIds: null, highlightedRuleIds: null };
    const node = chain.chain.find((n: AuthorityReference) => n.id === selectedNodeId);
    if (!node) return { highlightedDocIds: null, highlightedRuleIds: null };
    const layerToType: Record<string, DocumentType[]> = {
      act: ["statute"],
      regulation: ["regulation"],
      policy: ["policy_manual", "guidance"],
    };
    const types = layerToType[node.layer] ?? [];
    const docIds = new Set<string>(
      documents
        .filter((d: LegalDocument) => types.includes(d.document_type))
        .map((d: LegalDocument) => d.id),
    );
    const ruleIds = new Set<string>(
      rules.filter((r: LegalRule) => docIds.has(r.source_document_id)).map((r: LegalRule) => r.id),
    );
    return { highlightedDocIds: docIds, highlightedRuleIds: ruleIds };
  }, [selectedNodeId, chain.chain, documents, rules]);

  return (
    <div className="space-y-10">
      <JurisdictionHeader jurisdiction={chain.jurisdiction} />

      <section
        aria-label={intl.formatMessage({ id: "authority.search.placeholder" })}
        className="grid grid-cols-1 gap-3 rounded-md border border-border bg-surface-raised p-4 sm:grid-cols-3"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={intl.formatMessage({ id: "authority.search.placeholder" })}
          aria-label={intl.formatMessage({ id: "authority.search.placeholder" })}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <span className="shrink-0">
            {intl.formatMessage({ id: "authority.filter.document_type" })}:
          </span>
          <select
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value as "all" | DocumentType)}
            className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">—</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {intl.formatMessage({ id: `document_type.${t}` })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <span className="shrink-0">
            {intl.formatMessage({ id: "authority.filter.rule_type" })}:
          </span>
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value as "all" | RuleType)}
            className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">—</option>
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {intl.formatMessage({ id: `rule_type.${t}` })}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ChainGraph
          chain={chain.chain}
          selectedId={selectedNodeId}
          onSelect={setSelectedNodeId}
        />

        <div className="space-y-10">
          <LegalDocumentList
            documents={filteredDocs}
            highlightedIds={highlightedDocIds}
            expandedSection={expandedSection}
            onClearExpand={() => setExpandedSection(null)}
          />
          <LegalRuleList
            rules={filteredRules}
            highlightedIds={highlightedRuleIds}
            onViewSource={(docId, sectionRef) => {
              setExpandedSection({ docId, sectionRef });
              const heading = document.getElementById("documents-heading");
              heading?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {selectedNodeId
          ? intl.formatMessage(
              { id: "authority.chain.selected.aria" },
              {
                docs: highlightedDocIds?.size ?? 0,
                rules: highlightedRuleIds?.size ?? 0,
                title:
                  chain.chain.find((n: AuthorityReference) => n.id === selectedNodeId)?.title ?? "",
              },
            )
          : ""}
      </div>
    </div>
  );
}