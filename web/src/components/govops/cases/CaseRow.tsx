import { Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ChevronRight } from "lucide-react";
import type { CaseListItem } from "@/lib/types";
import { ProvenanceRibbon } from "../ProvenanceRibbon";
import { StatusPill } from "./StatusPill";

export function CaseRow({ item }: { item: CaseListItem }) {
  const intl = useIntl();
  const provenance = item.status === "decided" ? "human" : item.has_recommendation ? "agent" : "system";
  return (
    <li>
      <Link
        to="/cases/$caseId"
        params={{ caseId: item.id }}
        className="flex items-center gap-3 rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-sunken"
      >
        <ProvenanceRibbon variant={provenance} />
        <div className="flex-1 space-y-1">
          <p className="text-base text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
            {item.applicant_name}
          </p>
          <p
            className="text-xs text-foreground-muted"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {item.id}
          </p>
        </div>
        <StatusPill status={item.status} />
        <span
          className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {item.has_recommendation
            ? intl.formatMessage({ id: "cases.list.column.evaluated" })
            : "—"}
        </span>
        <ChevronRight className="size-4 text-foreground-muted rtl:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}
