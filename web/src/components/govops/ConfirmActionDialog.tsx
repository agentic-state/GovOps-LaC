import { useIntl, FormattedMessage } from "react-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConfigValue } from "@/lib/types";

export type ApprovalAction = "approve" | "request" | "reject";

/**
 * Confirmation modal for the three approval actions. Focus is trapped by
 * the underlying Radix Dialog; the destructive / authority intent of the
 * confirm CTA is mirrored from the triggering button.
 */
export function ConfirmActionDialog({
  open,
  action,
  cv,
  comment,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  action: ApprovalAction | null;
  cv: ConfigValue;
  comment: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const intl = useIntl();
  if (!action) return null;

  const titleKey =
    action === "approve"
      ? "approvals.confirm.approve.title"
      : action === "reject"
        ? "approvals.confirm.reject.title"
        : "approvals.confirm.request.title";

  const bodyKey =
    action === "approve"
      ? "approvals.confirm.approve.body"
      : action === "reject"
        ? "approvals.confirm.reject.body"
        : "approvals.confirm.request.body";

  const ctaKey =
    action === "approve"
      ? "approvals.confirm.cta.approve"
      : action === "reject"
        ? "approvals.confirm.cta.reject"
        : "approvals.confirm.cta.request";

  const ctaVariant: "authority" | "destructive" | "secondary" =
    action === "approve" ? "authority" : action === "reject" ? "destructive" : "secondary";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{intl.formatMessage({ id: titleKey })}</DialogTitle>
          <DialogDescription>
            <FormattedMessage
              id={bodyKey}
              values={{
                key: cv.key,
                date: new Date(cv.effective_from),
              }}
            />
          </DialogDescription>
        </DialogHeader>
        {comment.trim().length > 0 && (
          <div
            className="rounded-md border border-border bg-surface-sunken p-3 text-sm text-foreground"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-foreground-subtle">
              {intl.formatMessage({ id: "approvals.comment.label" })}
            </p>
            <p className="whitespace-pre-wrap">{comment}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {intl.formatMessage({ id: "approvals.confirm.cta.cancel" })}
          </Button>
          <Button variant={ctaVariant} onClick={onConfirm} disabled={busy}>
            {busy
              ? intl.formatMessage({ id: "approvals.confirm.cta.working" })
              : intl.formatMessage({ id: ctaKey })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
