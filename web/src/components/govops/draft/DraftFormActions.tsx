import { useIntl } from "react-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DraftFormState } from "./useDraftFormState";

/**
 * Footer action row: Cancel (with unsaved-changes confirm modal),
 * Save-as-Draft (optional), and the primary Submit. The submit button
 * variant adapts to the current author identity (agent vs human).
 */
export function DraftFormActions({
  state,
  submitting,
  isAgent,
  hasSaveDraft,
}: {
  state: DraftFormState;
  submitting: boolean;
  isAgent: boolean;
  hasSaveDraft: boolean;
}) {
  const intl = useIntl();
  const { handleCancel, handleSaveDraft, confirmCancelOpen, setConfirmCancelOpen, performCancel } =
    state;

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
          {intl.formatMessage({ id: "draft.cancel" })}
        </Button>
        {hasSaveDraft && (
          <Button type="button" variant="ghost" onClick={handleSaveDraft} disabled={submitting}>
            {intl.formatMessage({ id: "draft.save_as_draft" })}
          </Button>
        )}
        <Button type="submit" variant={isAgent ? "agent" : "authority"} disabled={submitting}>
          {submitting
            ? intl.formatMessage({ id: "draft.submit.submitting" })
            : intl.formatMessage({ id: "draft.submit" })}
        </Button>
      </div>

      <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{intl.formatMessage({ id: "draft.unsaved.title" })}</DialogTitle>
            <DialogDescription>
              {intl.formatMessage({ id: "draft.unsaved.body" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmCancelOpen(false)}>
              {intl.formatMessage({ id: "draft.unsaved.dismiss" })}
            </Button>
            <Button type="button" variant="destructive" onClick={performCancel}>
              {intl.formatMessage({ id: "draft.unsaved.confirm" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
