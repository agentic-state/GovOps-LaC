import { useState } from "react";
import { useIntl } from "react-intl";
import { ChevronDown } from "lucide-react";
import type { RuleEvaluation, RuleOutcome } from "@/lib/types";
import { CitationLink } from "../CitationLink";

const OUTCOME_VAR: Record<RuleOutcome, string> = {
  satisfied: "var(--verdict-enacted)",
  not_satisfied: "var(--verdict-rejected)",
  insufficient_evidence: "var(--verdict-pending)",
  not_applicable: "var(--foreground-muted)",
};

export function RuleEvaluationItem({ rule }: { rule: RuleEvaluation }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const c = OUTCOME_VAR[rule.outcome];
  return (
    <li className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
          style={{
            backgroundColor: `color-mix(in oklab, ${c} 18%, transparent)`,
            color: c,
            fontFamily: "var(--font-mono)",
          }}
        >
          <span aria-hidden className="inline-block size-1.5 rounded-full" style={{ backgroundColor: c }} />
          {intl.formatMessage({ id: `rule_outcome.${rule.outcome}` })}
        </span>
        <div className="flex-1 space-y-1">
          <p
            className="text-sm text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {rule.rule_description}
          </p>
          <CitationLink citation={rule.citation} />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-sunken"
          aria-label="Toggle detail"
        >
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm text-foreground-muted">
          <p>{rule.detail}</p>
          {rule.evidence_used.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs uppercase tracking-wider">evidence:</span>
              {rule.evidence_used.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-foreground"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
