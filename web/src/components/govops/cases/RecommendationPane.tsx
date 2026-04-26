import { useState } from "react";
import { useIntl } from "react-intl";
import { Sparkles } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ProvenanceRibbon } from "../ProvenanceRibbon";
import { ConfidenceRing } from "./ConfidenceRing";
import { OutcomePill } from "./OutcomePill";
import { RuleEvaluationItem } from "./RuleEvaluationItem";

export function RecommendationPane({
  recommendation,
  onEvaluate,
}: {
  recommendation: Recommendation | null;
  onEvaluate: () => Promise<void>;
}) {
  const intl = useIntl();
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handle = async () => {
    setRunning(true);
    setErrorMsg(null);
    try {
      await onEvaluate();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section
      aria-labelledby="recommendation-heading"
      className="flex gap-3 rounded-md border border-border bg-surface-raised p-5"
    >
      <ProvenanceRibbon variant="agent" />
      <div className="flex-1 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <h2
            id="recommendation-heading"
            className="text-xl text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "cases.recommendation.heading" })}
          </h2>
          {recommendation && <OutcomePill outcome={recommendation.outcome} />}
        </header>

        {!recommendation ? (
          <div className="rounded-md border border-dashed border-border bg-surface p-6 text-center">
            <p
              className="text-base text-foreground"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {intl.formatMessage({ id: "cases.recommendation.empty.title" })}
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              {intl.formatMessage({ id: "cases.recommendation.empty.body" })}
            </p>
            <Button
              variant="agent"
              className="mt-4"
              onClick={handle}
              disabled={running}
            >
              <Sparkles className="size-4" aria-hidden />
              {intl.formatMessage({
                id: running
                  ? "cases.recommendation.evaluating"
                  : "cases.recommendation.evaluate",
              })}
            </Button>
            {errorMsg && (
              <p className="mt-2 text-xs" style={{ color: "var(--verdict-rejected)" }}>
                {errorMsg}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-5">
              <ConfidenceRing value={recommendation.confidence} />
              <div className="space-y-1 text-sm">
                <p className="text-xs uppercase tracking-wider text-foreground-muted">
                  {intl.formatMessage({ id: "cases.recommendation.confidence" })}
                </p>
                {recommendation.pension_type && (
                  <p className="text-foreground">
                    {intl.formatMessage({
                      id: `cases.recommendation.pension_type.${recommendation.pension_type === "full" ? "full" : "partial"}`,
                    })}
                    {recommendation.partial_ratio && (
                      <span
                        className="ms-2 text-foreground-muted"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {recommendation.partial_ratio}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-foreground-muted">
                {intl.formatMessage({ id: "cases.recommendation.explanation" })}
              </h3>
              <p
                className="text-base leading-relaxed text-foreground"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {recommendation.explanation}
              </p>
            </div>

            {recommendation.rule_evaluations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  {intl.formatMessage({ id: "cases.recommendation.rules_applied" })}
                </h3>
                <ul className="space-y-2">
                  {recommendation.rule_evaluations.map((r) => (
                    <RuleEvaluationItem key={r.rule_id} rule={r} />
                  ))}
                </ul>
              </div>
            )}

            {recommendation.missing_evidence.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  {intl.formatMessage({ id: "cases.recommendation.missing_evidence" })}
                </h3>
                <ul className="list-inside list-disc text-sm text-foreground-muted">
                  {recommendation.missing_evidence.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {recommendation.flags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs uppercase tracking-wider text-foreground-muted">
                  {intl.formatMessage({ id: "cases.recommendation.flags" })}:
                </span>
                {recommendation.flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: "color-mix(in oklab, var(--verdict-pending) 18%, transparent)",
                      color: "var(--verdict-pending)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
