import { useIntl } from "react-intl";
import { Button } from "@/components/ui/button";

export function BulkActionBar({
  count,
  onApprove,
  onReject,
  onClear,
  busy,
}: {
  count: number;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  const intl = useIntl();
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-raised p-3 shadow-sm"
    >
      <span
        className="text-sm text-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {intl.formatMessage({ id: "encode.review.bulk.heading" }, { count })}
      </span>
      <div className="ms-auto flex flex-wrap gap-2">
        <Button variant="authority" size="sm" onClick={onApprove} disabled={busy}>
          {intl.formatMessage({ id: "encode.review.bulk.approve" })}
        </Button>
        <Button variant="destructive" size="sm" onClick={onReject} disabled={busy}>
          {intl.formatMessage({ id: "encode.review.bulk.reject" })}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
          {intl.formatMessage({ id: "encode.review.bulk.clear" })}
        </Button>
      </div>
    </div>
  );
}
