import { useIntl } from "react-intl";
import { Check, Minus } from "lucide-react";
import type { EvidenceItem } from "@/lib/types";

export function EvidenceTable({ items }: { items: EvidenceItem[] }) {
  const intl = useIntl();
  if (items.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        {intl.formatMessage({ id: "cases.evidence.empty" })}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-sunken text-left text-xs uppercase tracking-wider text-foreground-muted">
          <tr>
            <th className="px-3 py-2 font-medium">
              {intl.formatMessage({ id: "cases.evidence.column.type" })}
            </th>
            <th className="px-3 py-2 font-medium">
              {intl.formatMessage({ id: "cases.evidence.column.description" })}
            </th>
            <th className="px-3 py-2 font-medium">
              {intl.formatMessage({ id: "cases.evidence.column.provided" })}
            </th>
            <th className="px-3 py-2 font-medium">
              {intl.formatMessage({ id: "cases.evidence.column.verified" })}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((e) => (
            <tr key={e.id} className="bg-surface">
              <td className="px-3 py-2">
                <span
                  className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {e.evidence_type}
                </span>
              </td>
              <td className="px-3 py-2 text-foreground">
                {e.description}
                <span
                  className="ms-2 text-xs text-foreground-muted"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {e.id}
                </span>
              </td>
              <td className="px-3 py-2">
                {e.provided ? (
                  <Check className="size-4" style={{ color: "var(--verdict-enacted)" }} aria-label="yes" />
                ) : (
                  <Minus className="size-4 text-foreground-muted" aria-label="no" />
                )}
              </td>
              <td className="px-3 py-2">
                {e.verified ? (
                  <Check className="size-4" style={{ color: "var(--verdict-enacted)" }} aria-label="yes" />
                ) : (
                  <Minus className="size-4 text-foreground-muted" aria-label="no" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
