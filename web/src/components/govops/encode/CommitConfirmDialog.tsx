import { useState } from "react";
import { useIntl } from "react-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export function CommitConfirmDialog({
  approvedCount,
  onConfirm,
}: {
  approvedCount: number;
  onConfirm: () => Promise<void>;
}) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [committing, setCommitting] = useState(false);

  const confirm = async () => {
    setCommitting(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="authority" disabled={approvedCount === 0}>
          <CheckCircle className="size-4" aria-hidden />
          {intl.formatMessage({ id: "encode.review.commit" })} ({approvedCount})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
            {intl.formatMessage({ id: "encode.review.commit.confirm.title" })}
          </DialogTitle>
          <DialogDescription>
            {intl.formatMessage(
              { id: "encode.review.commit.confirm.body" },
              { count: approvedCount },
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={committing}>
            {intl.formatMessage({ id: "encode.proposal.modify.cancel" })}
          </Button>
          <Button variant="authority" onClick={confirm} disabled={committing}>
            {intl.formatMessage({ id: "encode.review.commit" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
