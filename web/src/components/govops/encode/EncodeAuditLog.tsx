import { useState } from "react";
import { useIntl } from "react-intl";
import { ChevronDown } from "lucide-react";
import type { EncodingAuditEntry } from "@/lib/types";

export function EncodeAuditLog({ entries }: { entries: EncodingAuditEntry[] }) {
  const intl = useIntl();
  const [open, setOpen] = useState(true);
  return (
    <section
      aria-labelledby="audit-heading"
      className="space-y-3 rounded-md border border-border bg-surface-raised p-4"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2
          id="audit-heading"
          className="text-base text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "encode.review.audit.heading" })}
        </h2>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ol className="space-y-2">
          {entries.map((e, i) => (
            <li key={i} className="rounded-md border border-border bg-surface p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-foreground-muted">
                <span style={{ fontFamily: "var(--font-mono)" }}>{e.event_type}</span>
                <span>·</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{e.actor}</span>
                <span className="ms-auto">
                  {intl.formatDate(e.timestamp, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <p className="mt-1 text-foreground">{e.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
