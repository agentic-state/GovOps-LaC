import { useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import type { ScreenResponse, ScreenRuleOutcome } from "@/lib/types";

const RULE_CHIP_CLASS: Record<ScreenRuleOutcome, string> = {
  satisfied: "bg-verdict-enacted/15 text-verdict-enacted border-verdict-enacted/30",
  not_satisfied: "bg-destructive/15 text-destructive border-destructive/30",
  insufficient_evidence: "bg-agentic/15 text-agentic border-agentic/30",
  not_applicable: "bg-foreground-muted/15 text-foreground-muted border-foreground-muted/30",
};

const HOWTO_URLS: Record<string, string> = {
  ca: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security.html",
  br: "https://www.gov.br/inss/pt-br",
  es: "https://www.seg-social.es/",
  fr: "https://www.service-public.fr/",
  de: "https://www.deutsche-rentenversicherung.de/",
  ua: "https://www.pfu.gov.ua/",
};

export function ScreenResult({
  data,
  stale,
  jurisdictionId,
  onRerun,
}: {
  data: ScreenResponse;
  stale: boolean;
  jurisdictionId: string;
  onRerun: () => void;
}) {
  const intl = useIntl();
  const sectionRef = useRef<HTMLElement>(null);

  // a11y: pressing Esc inside the result returns focus to the first form input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const first = document.querySelector<HTMLElement>("#screen-dob");
        first?.focus();
      }
    };
    const node = sectionRef.current;
    node?.addEventListener("keydown", onKey);
    return () => node?.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section
      ref={sectionRef}
      role="status"
      aria-live="polite"
      tabIndex={-1}
      className={`mt-8 rounded-lg border border-border bg-surface screen-result ${
        stale ? "opacity-60 motion-safe:transition-opacity" : ""
      }`}
    >
      {data._preview && (
        <div className="px-5 py-2 text-xs uppercase tracking-wide bg-agentic/10 text-agentic border-b border-agentic/30 rounded-t-lg">
          {intl.formatMessage({ id: "screen.preview_mode" })}
        </div>
      )}
      <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl">
            {intl.formatMessage({ id: `screen.outcome.${data.outcome}` })}
          </h2>
          <p className="text-xs text-foreground-muted mt-1">
            {data.jurisdiction_label} · {data.evaluation_date}
          </p>
          {data.partial_ratio && (
            <p className="text-foreground-muted text-sm mt-1">
              {intl.formatMessage(
                { id: "screen.partial" },
                { ratio: data.partial_ratio },
              )}
            </p>
          )}
        </div>
        {stale && (
          <button
            type="button"
            onClick={onRerun}
            className="text-xs uppercase tracking-wide px-3 py-1 rounded border border-border bg-surface hover:bg-surface-sunken"
          >
            {intl.formatMessage({ id: "screen.rerun" })}
          </button>
        )}
      </header>
      <ol role="list" className="divide-y divide-border">
        {data.rule_results.map((r) => (
          <li key={r.rule_id} className="flex items-stretch">
            <ProvenanceRibbon variant="hybrid" />
            <div className="flex-1 px-5 py-3">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm">{r.description}</p>
                <span
                  className={`shrink-0 text-xs uppercase tracking-wide px-2 py-0.5 rounded border ${RULE_CHIP_CLASS[r.outcome]}`}
                >
                  {intl.formatMessage({ id: `screen.rule.${r.outcome}` })}
                </span>
              </div>
              <p className="text-xs text-foreground-muted mt-1">{r.detail}</p>
              <p
                className="text-xs text-foreground-muted mt-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {r.citation}
                {r.effective_from && (
                  <span className="ml-2 opacity-70">eff. {r.effective_from}</span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {data.missing_evidence.length > 0 && (
        <section className="px-5 py-4 border-t border-border">
          <h3 className="text-sm font-medium mb-2">
            {intl.formatMessage({ id: "screen.missing.heading" })}
          </h3>
          <ul role="list" className="list-disc list-inside text-sm text-foreground-muted space-y-1">
            {data.missing_evidence.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </section>
      )}
      <section className="px-5 py-4 border-t border-border">
        <h3 className="text-sm font-medium mb-1">
          {intl.formatMessage({ id: "screen.howto.heading" })}
        </h3>
        <p className="text-sm text-foreground-muted">
          {intl.formatMessage(
            { id: "screen.howto.body" },
            {
              program: (
                <a
                  href={HOWTO_URLS[jurisdictionId] ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {data.jurisdiction_label}
                </a>
              ),
            },
          )}
        </p>
      </section>
      <footer className="px-5 py-4 border-t border-border bg-surface-sunken text-sm text-foreground-muted rounded-b-lg">
        {intl.formatMessage({ id: "screen.disclaimer.footer" })}
      </footer>
    </section>
  );
}
