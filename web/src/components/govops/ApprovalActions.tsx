import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveConfigValue, rejectConfigValue, requestChangesConfigValue } from "@/lib/api";
import { getCurrentUser } from "@/lib/currentUser";
import type { ConfigValue } from "@/lib/types";
import { ConfirmActionDialog, type ApprovalAction } from "./ConfirmActionDialog";
import { useApprovalDraft } from "./approval/useApprovalDraft";
import { isMac, useApprovalShortcuts } from "./approval/useApprovalShortcuts";
import { ApprovalShortcutsHelp } from "./approval/ApprovalShortcutsHelp";

const COMMENT_MIN = 10;

/**
 * Sticky action panel for the approval review page. Three CTAs:
 * - Approve (authority gold): the canonical human ratification act.
 * - Request changes (secondary): bounces the draft back to the author.
 * - Reject (destructive): closes the proposal.
 *
 * The author cannot self-approve. Non-approve actions require a comment
 * (≥10 chars) so the audit trail captures *why*. Persistence + keyboard
 * shortcuts live in dedicated hooks under ./approval/.
 */
export function ApprovalActions({
  cv,
  onResolved,
}: {
  cv: ConfigValue;
  onResolved: (resolution: ApprovalAction) => void;
}) {
  const intl = useIntl();
  const { comment, setComment, expanded, setExpanded, showHelp, setShowHelp, clearComment } =
    useApprovalDraft(cv.id);

  const [pending, setPending] = useState<ApprovalAction | null>(null);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const user = getCurrentUser();
  const isSelfApproval = user === cv.author;
  const commentOk = comment.trim().length >= COMMENT_MIN;
  const mod = isMac() ? "⌘" : "Ctrl";

  // Auto-focus the textarea whenever the panel becomes interactive.
  useEffect(() => {
    if (!expanded || isSelfApproval || busy) return;
    const id = window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* some inputs throw */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [expanded, isSelfApproval, busy, cv.id]);

  useApprovalShortcuts({
    enabled: expanded && !isSelfApproval && !busy,
    commentOk,
    setPending,
    toggleHelp: () => setShowHelp(!showHelp),
  });

  async function run() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending === "approve") {
        await approveConfigValue(cv.id, { approved_by: user, comment });
        toast.success(intl.formatMessage({ id: "approvals.success.approved" }));
      } else if (pending === "request") {
        await requestChangesConfigValue(cv.id, { reviewer: user, comment });
        toast.success(intl.formatMessage({ id: "approvals.success.requested_changes" }));
      } else {
        await rejectConfigValue(cv.id, { reviewer: user, comment });
        toast.success(intl.formatMessage({ id: "approvals.success.rejected" }));
      }
      clearComment();
      onResolved(pending);
    } catch (err) {
      toast.error(
        intl.formatMessage({ id: "approvals.error.generic" }) +
          (err instanceof Error ? `: ${err.message}` : ""),
      );
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="actions-heading"
      className="sticky top-20 space-y-4 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <h2
          id="actions-heading"
          className="text-lg tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "approvals.actions.heading" })}
        </h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="approval-actions-body"
          onClick={() => setExpanded(!expanded)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground-muted hover:bg-surface-sunken"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {intl.formatMessage({
            id: expanded ? "approvals.panel.collapse" : "approvals.panel.expand",
          })}
        </button>
      </div>
      <p
        className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "approvals.actions.user" }, { user })}
      </p>

      {expanded && isSelfApproval && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border p-3 text-sm"
          style={{
            borderColor: "color-mix(in oklch, var(--verdict-pending) 40%, transparent)",
            backgroundColor: "color-mix(in oklch, var(--verdict-pending) 10%, transparent)",
            color: "var(--foreground)",
          }}
        >
          {intl.formatMessage({ id: "approvals.self_approval_blocked" })}
        </div>
      )}

      <div id="approval-actions-body" hidden={!expanded} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="approval-comment"
            className="text-xs uppercase tracking-[0.14em] text-foreground-subtle"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({ id: "approvals.comment.label" })}
          </label>
          <Textarea
            id="approval-comment"
            ref={textareaRef}
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={intl.formatMessage({
              id: "approvals.comment.placeholder",
            })}
            disabled={isSelfApproval || busy}
          />
          <p className="text-[11px] text-foreground-subtle">
            {intl.formatMessage({ id: "approvals.comment.help" }, { min: COMMENT_MIN })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="authority"
            disabled={isSelfApproval || busy}
            onClick={() => setPending("approve")}
            title={`${mod} + Enter`}
          >
            {intl.formatMessage({ id: "approvals.action.approve" })}
            <span
              aria-hidden
              className="ms-2 rounded border border-current/30 px-1 text-[10px] opacity-70"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {mod}↵
            </span>
          </Button>
          <Button
            variant="secondary"
            disabled={isSelfApproval || busy || !commentOk}
            onClick={() => setPending("request")}
            title={`${mod} + Shift + C`}
          >
            {intl.formatMessage({ id: "approvals.action.request_changes" })}
            <span
              aria-hidden
              className="ms-2 rounded border border-current/30 px-1 text-[10px] opacity-70"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {mod}⇧C
            </span>
          </Button>
          <Button
            variant="destructive"
            disabled={isSelfApproval || busy || !commentOk}
            onClick={() => setPending("reject")}
            title={`${mod} + Shift + R`}
          >
            {intl.formatMessage({ id: "approvals.action.reject" })}
            <span
              aria-hidden
              className="ms-2 rounded border border-current/30 px-1 text-[10px] opacity-70"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {mod}⇧R
            </span>
          </Button>
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            aria-expanded={showHelp}
            onClick={() => setShowHelp(!showHelp)}
            className="text-[11px] uppercase tracking-[0.14em] text-foreground-subtle hover:text-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {intl.formatMessage({
              id: showHelp ? "approvals.shortcuts.hide" : "approvals.shortcuts.show",
            })}
          </button>
          {showHelp && <ApprovalShortcutsHelp mod={mod} />}
        </div>
      </div>

      <ConfirmActionDialog
        open={pending !== null}
        action={pending}
        cv={cv}
        comment={comment}
        busy={busy}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
