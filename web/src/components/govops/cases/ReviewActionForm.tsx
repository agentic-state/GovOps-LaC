import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/button";
import type { DecisionOutcome, Recommendation, ReviewActionType } from "@/lib/types";

const ACTIONS: ReviewActionType[] = ["approve", "modify", "reject", "request_info", "escalate"];
const OUTCOMES: DecisionOutcome[] = ["eligible", "ineligible", "insufficient_evidence", "escalate"];

export function ReviewActionForm({
  recommendation,
  onSubmit,
}: {
  recommendation: Recommendation;
  onSubmit: (body: {
    action: ReviewActionType;
    rationale: string;
    final_outcome: DecisionOutcome | null;
  }) => Promise<void>;
}) {
  const intl = useIntl();
  const [action, setAction] = useState<ReviewActionType>("approve");
  const [rationale, setRationale] = useState("");
  const [finalOutcome, setFinalOutcome] = useState<DecisionOutcome>(recommendation.outcome);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const valid = rationale.trim().length >= 20;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({
        action,
        rationale: rationale.trim(),
        final_outcome: action === "modify" ? finalOutcome : null,
      });
      setRationale("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handle} className="space-y-3 rounded-md border border-border bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block text-xs uppercase tracking-wider text-foreground-muted">
            {intl.formatMessage({ id: "cases.review.action.label" })}
          </span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as ReviewActionType)}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {intl.formatMessage({ id: `cases.review.action.${a}` })}
              </option>
            ))}
          </select>
        </label>
        {action === "modify" && (
          <label className="space-y-1 text-sm">
            <span className="block text-xs uppercase tracking-wider text-foreground-muted">
              {intl.formatMessage({ id: "cases.review.final_outcome.label" })}
            </span>
            <select
              value={finalOutcome}
              onChange={(e) => setFinalOutcome(e.target.value as DecisionOutcome)}
              className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {intl.formatMessage({ id: `outcome.${o}` })}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="block text-xs uppercase tracking-wider text-foreground-muted">
          {intl.formatMessage({ id: "cases.review.rationale.label" })}
        </span>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={4}
          placeholder={intl.formatMessage({ id: "cases.review.rationale.placeholder" })}
          required
          minLength={20}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="block text-xs text-foreground-muted">
          {rationale.trim().length} / 20+
        </span>
      </label>
      <div className="flex items-center justify-between gap-2">
        {errorMsg ? (
          <p className="text-xs" style={{ color: "var(--verdict-rejected)" }}>
            {errorMsg}
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" variant="authority" disabled={!valid || submitting}>
          {intl.formatMessage({
            id: submitting ? "cases.review.submitting" : "cases.review.submit",
          })}
        </Button>
      </div>
    </form>
  );
}
