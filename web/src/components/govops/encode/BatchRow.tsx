import { Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ChevronRight } from "lucide-react";
import type { EncodingBatchSummary } from "@/lib/types";
import { ProvenanceRibbon, type ProvenanceVariant } from "../ProvenanceRibbon";
import { MethodChip } from "./MethodChip";

function provenanceFor(method: EncodingBatchSummary["method"]): ProvenanceVariant {
  if (method.startsWith("llm:")) return "agent";
  if (method === "manual:llm-fallback") return "hybrid";
  return "human";
}

export function BatchRow({ batch }: { batch: EncodingBatchSummary }) {
  const intl = useIntl();
  return (
    <li>
      <Link
        to="/encode/$batchId"
        params={{ batchId: batch.id }}
        className="flex items-stretch rounded-md border border-border bg-surface transition-colors hover:bg-surface-sunken"
      >
        <ProvenanceRibbon variant={provenanceFor(batch.method)} />
        <div className="flex flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p
              className="truncate text-base text-foreground"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {batch.document_title}
            </p>
            <p
              className="truncate text-xs text-foreground-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {batch.document_citation} · {batch.id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MethodChip method={batch.method} />
            {(["pending", "approved", "modified", "rejected"] as const).map((s) =>
              batch.counts[s] > 0 ? (
                <span
                  key={s}
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: `color-mix(in oklab, var(--verdict-${
                      s === "approved" ? "enacted" : s === "rejected" ? "rejected" : "pending"
                    }) 14%, transparent)`,
                    color: `var(--verdict-${
                      s === "approved" ? "enacted" : s === "rejected" ? "rejected" : "pending"
                    })`,
                    fontFamily: "var(--font-mono)",
                  }}
                  title={intl.formatMessage({ id: `proposal_status.${s}` })}
                >
                  {batch.counts[s]} {intl.formatMessage({ id: `proposal_status.${s}` })}
                </span>
              ) : null,
            )}
            <span
              className="text-xs text-foreground-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {intl.formatDate(batch.created_at, { dateStyle: "medium" })}
            </span>
            <ChevronRight className="size-4 text-foreground-muted rtl:rotate-180" aria-hidden />
          </div>
        </div>
      </Link>
    </li>
  );
}
