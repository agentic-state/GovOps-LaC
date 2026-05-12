import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import {
  approveAuthoringDraft,
  commitAuthoringDrafts,
  discardAuthoringDraft,
  listAuthoringDrafts,
  rejectAuthoringDraft,
} from "@/lib/api";
import type { AuthoringDraft, DraftStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/govops/RouteError";

export const Route = createFileRoute("/admin/drafts")({
  head: () => ({
    meta: [
      { title: "Authoring drafts — GovOps" },
      {
        name: "description",
        content:
          "Approval queue for v3.1 authoring substrate drafts: jurisdictions and program manifests.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  component: DraftsQueue,
});

const STATUS_FILTERS: DraftStatus[] = ["pending", "approved", "rejected", "committed"];

/**
 * v3.1.x L8 drafts approval queue.
 *
 * Lists every authoring draft, filterable by status. For PENDING
 * drafts the approver can approve, reject, or discard inline. Once
 * everything they want is APPROVED, "Commit drafts" writes them to
 * lawcode/ and reload_registry() makes the new content live.
 *
 * The diff-vs-current view is deferred to v3.1.x followup -- this lane
 * ships the bare minimum to drive the wizard end-to-end. The committed
 * drafts list serves as the audit trail.
 */
function DraftsQueue() {
  const intl = useIntl();
  const [drafts, setDrafts] = useState<AuthoringDraft[]>([]);
  const [filter, setFilter] = useState<DraftStatus | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [committer, setCommitter] = useState("");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuthoringDrafts(
        filter === "all" ? {} : { status: filter },
      );
      setDrafts(res.drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function withAction(id: string, fn: () => Promise<void>) {
    setError(null);
    setInfo(null);
    setActionInProgress(id);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleApprove(d: AuthoringDraft) {
    const approver = window.prompt(
      intl.formatMessage({ id: "drafts.approve.prompt" }),
    );
    if (!approver || !approver.trim()) return;
    await withAction(d.id, async () => {
      await approveAuthoringDraft(d.id, approver.trim());
    });
  }

  async function handleReject(d: AuthoringDraft) {
    const rejector = window.prompt(
      intl.formatMessage({ id: "drafts.reject.prompt.rejector" }),
    );
    if (!rejector || !rejector.trim()) return;
    const reason = window.prompt(
      intl.formatMessage({ id: "drafts.reject.prompt.reason" }),
    );
    if (!reason || !reason.trim()) return;
    await withAction(d.id, async () => {
      await rejectAuthoringDraft(d.id, rejector.trim(), reason.trim());
    });
  }

  async function handleDiscard(d: AuthoringDraft) {
    if (
      !window.confirm(
        intl.formatMessage({ id: "drafts.discard.confirm" }, { id: d.id }),
      )
    ) {
      return;
    }
    await withAction(d.id, async () => {
      await discardAuthoringDraft(d.id);
    });
  }

  async function handleCommit() {
    if (!committer.trim()) return;
    setError(null);
    setInfo(null);
    setCommitting(true);
    try {
      const res = await commitAuthoringDrafts(committer.trim());
      if (res.committed.length === 0) {
        setInfo(intl.formatMessage({ id: "drafts.commit.empty" }));
      } else {
        setInfo(
          intl.formatMessage(
            { id: "drafts.commit.success" },
            { n: res.committed.length, reloaded: res.reloaded ? "yes" : "no" },
          ),
        );
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1
            className="text-3xl tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "drafts.title" })}
          </h1>
          <p className="max-w-3xl text-sm text-foreground-muted">
            {intl.formatMessage({ id: "drafts.lede" })}
          </p>
        </div>
        <Link
          to="/admin/onboard"
          className="text-sm text-foreground hover:underline"
        >
          {intl.formatMessage({ id: "drafts.onboard.cta" })}
        </Link>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised p-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "drafts.filter.status" })}
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as DraftStatus | "all")}
            data-testid="drafts-filter"
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">{intl.formatMessage({ id: "drafts.filter.all" })}</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {intl.formatMessage({ id: `drafts.status.${s}` })}
              </option>
            ))}
          </select>
        </label>
        <span className="ms-auto text-xs text-foreground-muted">
          {intl.formatMessage({ id: "drafts.count" }, { n: drafts.length })}
        </span>
      </section>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--verdict-rejected)" }}>
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="text-sm text-foreground-muted">
          {info}
        </p>
      )}

      <section aria-label={intl.formatMessage({ id: "drafts.title" })} className="space-y-3">
        {loading && <p className="text-sm text-foreground-muted">{intl.formatMessage({ id: "drafts.loading" })}</p>}
        {!loading && drafts.length === 0 && (
          <p className="rounded-md border border-border bg-surface p-4 text-sm text-foreground-muted">
            {intl.formatMessage({ id: "drafts.empty" })}
          </p>
        )}
        {!loading &&
          drafts.map((d) => (
            <DraftRow
              key={d.id}
              draft={d}
              busy={actionInProgress === d.id}
              onApprove={() => handleApprove(d)}
              onReject={() => handleReject(d)}
              onDiscard={() => handleDiscard(d)}
            />
          ))}
      </section>

      <section className="space-y-3 rounded-md border border-border bg-surface p-4">
        <header className="space-y-1">
          <h2
            className="text-lg text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "drafts.commit.heading" })}
          </h2>
          <p className="text-sm text-foreground-muted">
            {intl.formatMessage({ id: "drafts.commit.lede" })}
          </p>
        </header>
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (committer.trim() && !committing) void handleCommit();
          }}
        >
          <input
            type="text"
            value={committer}
            onChange={(e) => setCommitter(e.target.value)}
            placeholder={intl.formatMessage({ id: "drafts.commit.placeholder" })}
            data-testid="drafts-committer"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            variant="authority"
            disabled={!committer.trim() || committing}
            data-testid="drafts-commit"
          >
            {intl.formatMessage({
              id: committing ? "drafts.commit.loading" : "drafts.commit.button",
            })}
          </Button>
        </form>
      </section>
    </div>
  );
}

function DraftRow({
  draft,
  busy,
  onApprove,
  onReject,
  onDiscard,
}: {
  draft: AuthoringDraft;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDiscard: () => void;
}) {
  const intl = useIntl();
  const canAct = draft.status === "pending";
  return (
    <article
      className="space-y-2 rounded-md border border-border bg-surface p-4"
      data-testid={`draft-row-${draft.id}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3
          className="text-base text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {draft.type} · {draft.target_path}
        </h3>
        <span
          className="rounded-sm border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({ id: `drafts.status.${draft.status}` })}
        </span>
      </header>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-foreground-muted sm:grid-cols-2">
        <div>
          <dt className="inline">{intl.formatMessage({ id: "drafts.row.id" })}: </dt>
          <dd className="inline font-mono">{draft.id}</dd>
        </div>
        <div>
          <dt className="inline">{intl.formatMessage({ id: "drafts.row.author" })}: </dt>
          <dd className="inline">{draft.author}</dd>
        </div>
        <div>
          <dt className="inline">{intl.formatMessage({ id: "drafts.row.created" })}: </dt>
          <dd className="inline">{draft.created_at}</dd>
        </div>
        {draft.approved_by && (
          <div>
            <dt className="inline">{intl.formatMessage({ id: "drafts.row.approved_by" })}: </dt>
            <dd className="inline">{draft.approved_by}</dd>
          </div>
        )}
        {draft.rejection_reason && (
          <div className="col-span-full">
            <dt className="inline">{intl.formatMessage({ id: "drafts.row.rejection_reason" })}: </dt>
            <dd className="inline">{draft.rejection_reason}</dd>
          </div>
        )}
      </dl>
      <details>
        <summary className="cursor-pointer text-xs text-foreground-muted hover:text-foreground">
          {intl.formatMessage({ id: "drafts.row.show_content" })}
        </summary>
        <pre
          className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-foreground-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {JSON.stringify(draft.content, null, 2)}
        </pre>
      </details>
      {canAct && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" variant="authority" disabled={busy} onClick={onApprove} data-testid={`approve-${draft.id}`}>
            {intl.formatMessage({ id: "drafts.action.approve" })}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onReject} data-testid={`reject-${draft.id}`}>
            {intl.formatMessage({ id: "drafts.action.reject" })}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onDiscard} data-testid={`discard-${draft.id}`}>
            {intl.formatMessage({ id: "drafts.action.discard" })}
          </Button>
        </div>
      )}
    </article>
  );
}
