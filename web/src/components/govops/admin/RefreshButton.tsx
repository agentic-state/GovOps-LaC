import { useIntl } from "react-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const intl = useIntl();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={refreshing}
      aria-label={intl.formatMessage({
        id: refreshing ? "admin.refreshing" : "admin.refresh",
      })}
    >
      <RefreshCw
        className={`size-3.5 ${refreshing ? "motion-safe:animate-spin motion-reduce:animate-pulse" : ""}`}
        aria-hidden
      />
      {intl.formatMessage({ id: refreshing ? "admin.refreshing" : "admin.refresh" })}
    </Button>
  );
}
