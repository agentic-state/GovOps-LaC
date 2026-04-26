import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ChevronLeft, ChevronDown } from "lucide-react";
import {
  bulkReviewProposals,
  commitBatch,
  getEncodingBatch,
  reviewProposal,
} from "@/lib/api";
import type { EncodingBatch, ProposalStatus, RuleProposal } from "@/lib/types";
import { ProposalCard } from "@/components/govops/encode/ProposalCard";
import { BulkActionBar } from "@/components/govops/encode/BulkActionBar";
import { EncodeAuditLog } from "@/components/govops/encode/EncodeAuditLog";
import { CommitConfirmDialog } from "@/components/govops/encode/CommitConfirmDialog";
import { MethodChip } from "@/components/govops/encode/MethodChip";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";

const STATUSES: ProposalStatus[] = ["pending", "approved", "modified", "rejected"];

export const Route = createFileRoute("/encode/$batchId")({
  head: ({ params }) => ({
    meta: [{ title: `Batch ${params.batchId} — GovOps` }],
  }),
  loader: async ({ params }) => {
    const batch = await getEncodingBatch(params.batchId);
    return { batch };
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading variant="panel" />,
  component: BatchReviewPage,
});

function BatchReviewPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const initial = (Route.useLoaderData() as { batch: EncodingBatch }).batch;
  const [batch, setBatch] = useState<EncodingBatch>(initial);
  const [activeStatuses, setActiveStatuses] = useState<Set<ProposalStatus>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const isAgent = batch.method.startsWith("llm:");

  const filtered = useMemo(
    () =>
      activeStatuses.size === 0
        ? batch.proposals
        : batch.proposals.filter((p) => activeStatuses.has(p.status)),
    [batch.proposals, activeStatuses],
  );

  const approvedCount = batch.proposals.filter((p) => p.status === "approved").length;

  const updateProposal = (updated: RuleProposal) => {
    setBatch((prev) => ({
      ...prev,
      proposals: prev.proposals.map((p) => (p.id === updated.id ? updated : p)),
      audit: [
        ...prev.audit,
        {
          timestamp: updated.reviewed_at ?? new Date().toISOString(),
          event_type: `proposal.${updated.status}`,
          actor: updated.reviewer ?? "human:reviewer.preview",
          detail: `${updated.id} → ${updated.status}`,
          data: {},
        },
      ],
    }));
  };

  const handleAct = async (
    proposalId: string,
    status: ProposalStatus,
    notes?: string,
  ) => {
    const updated = await reviewProposal(batch.id, proposalId, { status, notes });
    updateProposal(updated);
    setAnnouncement(`${proposalId} → ${status}`);
  };

  const handleModify = async (
    proposalId: string,
    overrides: {
      description: string;
      formal_expression: string;
      citation: string;
      parameters: Record<string, unknown>;
    },
  ) => {
    const updated = await reviewProposal(batch.id, proposalId, {
      status: "modified",
      overrides,
    });
    updateProposal(updated);
    setAnnouncement(`${proposalId} → modified`);
  };

  const handleBulk = async (status: ProposalStatus) => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const { updated } = await bulkReviewProposals(batch.id, {
        proposal_ids: Array.from(selected),
        status,
      });
      setBatch((prev) => {
        const map = new Map(updated.map((u) => [u.id, u]));
        return {
          ...prev,
          proposals: prev.proposals.map((p) => map.get(p.id) ?? p),
        };
      });
      setSelected(new Set());
      setAnnouncement(`${updated.length} → ${status}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    const { committed_rule_ids } = await commitBatch(batch.id);
    setAnnouncement(
      intl.formatMessage(
        { id: "encode.review.commit.success" },
        { count: committed_rule_ids.length },
      ),
    );
    navigate({ to: "/authority" });
  };

  const toggleStatus = (s: ProposalStatus) =>
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6 pb-24">
      <Link
        to="/encode"
        className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        {intl.formatMessage({ id: "encode.list.heading" })}
      </Link>

      <header className="space-y-2">
        <h1
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage(
            { id: "encode.review.heading" },
            { title: batch.document_title },
          )}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
          <span style={{ fontFamily: "var(--font-mono)" }}>{batch.document_citation}</span>
          <span>·</span>
          <MethodChip method={batch.method} />
          {batch.source_url && (
            <a
              href={batch.source_url}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              source
            </a>
          )}
        </div>
      </header>

      <section
        aria-label={intl.formatMessage({ id: "encode.review.source_text.toggle" })}
        className="rounded-md border border-border bg-surface-raised"
      >
        <button
          type="button"
          onClick={() => setSourceOpen((v) => !v)}
          aria-expanded={sourceOpen}
          className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm text-foreground"
        >
          <span>{intl.formatMessage({ id: "encode.review.source_text.toggle" })}</span>
          <ChevronDown
            className={`size-4 transition-transform ${sourceOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {sourceOpen && (
          <pre
            className="overflow-auto border-t border-border bg-surface p-4 text-xs text-foreground"
            style={{ fontFamily: "var(--font-mono)", maxHeight: "50vh" }}
          >
            {batch.input_text}
          </pre>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "encode.review.filter.status" })}:
        </span>
        {STATUSES.map((s) => {
          const active = activeStatuses.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                active
                  ? "border-transparent bg-foreground text-background"
                  : "border-border bg-surface text-foreground-muted hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatMessage({ id: `proposal_status.${s}` })}
            </button>
          );
        })}
      </div>

      <BulkActionBar
        count={selected.size}
        onApprove={() => handleBulk("approved")}
        onReject={() => handleBulk("rejected")}
        onClear={() => setSelected(new Set())}
        busy={busy}
      />

      <section aria-labelledby="proposals-heading" className="space-y-3">
        <h2 id="proposals-heading" className="sr-only">
          Proposals
        </h2>
        {filtered.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            isAgent={isAgent}
            selected={selected.has(p.id)}
            onSelect={toggleSelect}
            onAct={(status, notes) => handleAct(p.id, status, notes)}
            onModify={(o) => handleModify(p.id, o)}
          />
        ))}
      </section>

      <EncodeAuditLog entries={batch.audit} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-3">
          <span className="text-xs text-foreground-muted">
            {approvedCount} {intl.formatMessage({ id: "proposal_status.approved" })}
          </span>
          <CommitConfirmDialog approvedCount={approvedCount} onConfirm={handleCommit} />
        </div>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
