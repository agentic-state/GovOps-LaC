import { useState } from "react";
import { useIntl } from "react-intl";
import type { ProposalStatus, RuleProposal } from "@/lib/types";
import { ProvenanceRibbon } from "../ProvenanceRibbon";
import { CitationLink } from "../CitationLink";
import { Button } from "@/components/ui/button";
import { ProposalStatusPill } from "./ProposalStatusPill";
import { ProposalEditor } from "./ProposalEditor";

export function ProposalCard({
  proposal,
  isAgent,
  selected,
  onSelect,
  onAct,
  onModify,
}: {
  proposal: RuleProposal;
  isAgent: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onAct: (status: ProposalStatus, notes?: string) => Promise<void>;
  onModify: (overrides: {
    description: string;
    formal_expression: string;
    citation: string;
    parameters: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const intl = useIntl();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (status: ProposalStatus) => {
    setBusy(true);
    try {
      await onAct(status, notes.trim() || undefined);
      setNotes("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex items-stretch rounded-md border border-border bg-surface">
      <ProvenanceRibbon variant={isAgent ? "agent" : "hybrid"} />
      <div className="flex-1 space-y-3 p-5">
        <header className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(proposal.id)}
            aria-label={intl.formatMessage({ id: "encode.proposal.select" })}
            className="mt-1.5"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <span
              className="text-xs uppercase tracking-wider text-foreground-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id: `rule_type.${proposal.rule_type}` })}
            </span>
            <h3
              className="text-base text-foreground"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
            >
              {proposal.description}
            </h3>
          </div>
          <ProposalStatusPill status={proposal.status} />
        </header>

        <CitationLink citation={proposal.citation} />

        <pre
          className="overflow-x-auto rounded bg-surface-sunken p-3 text-xs text-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {proposal.formal_expression}
        </pre>

        {Object.keys(proposal.parameters).length > 0 && (
          <dl
            className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {Object.entries(proposal.parameters).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-foreground-muted">{k}</dt>
                <dd className="text-foreground">{JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        )}

        {proposal.notes && (
          <p
            className="rounded-md border border-border bg-surface-sunken p-2 text-xs text-foreground-muted"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {proposal.reviewer ?? "—"}: {proposal.notes}
          </p>
        )}

        {editing ? (
          <ProposalEditor
            proposal={proposal}
            onSave={async (o) => {
              await onModify(o);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <label className="block space-y-1 text-sm">
              <span className="block text-xs uppercase tracking-wider text-foreground-muted">
                {intl.formatMessage({ id: "encode.proposal.notes.label" })}
              </span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={intl.formatMessage({ id: "encode.proposal.notes.placeholder" })}
                className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <footer className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="authority"
                size="sm"
                onClick={() => act("approved")}
                disabled={busy}
              >
                {intl.formatMessage({ id: "encode.proposal.approve" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                disabled={busy}
              >
                {intl.formatMessage({ id: "encode.proposal.modify" })}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => act("rejected")}
                disabled={busy}
              >
                {intl.formatMessage({ id: "encode.proposal.reject" })}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => act("pending")}
                disabled={busy || !notes.trim()}
                title={intl.formatMessage({ id: "encode.proposal.annotate" })}
              >
                {intl.formatMessage({ id: "encode.proposal.annotate" })}
              </Button>
            </footer>
          </>
        )}
      </div>
    </article>
  );
}
