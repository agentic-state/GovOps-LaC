import { useIntl } from "react-intl";
import type {
  CaseStatus,
  DecisionOutcome,
  HumanReviewAction,
  Recommendation,
  ReviewActionType,
} from "@/lib/types";
import { ProvenanceRibbon } from "../ProvenanceRibbon";
import { ReviewLog } from "./ReviewLog";
import { ReviewActionForm } from "./ReviewActionForm";

export function ReviewPane({
  status,
  recommendation,
  reviews,
  onSubmit,
}: {
  status: CaseStatus;
  recommendation: Recommendation | null;
  reviews: HumanReviewAction[];
  onSubmit: (body: {
    action: ReviewActionType;
    rationale: string;
    final_outcome: DecisionOutcome | null;
  }) => Promise<void>;
}) {
  const intl = useIntl();
  const canAct = recommendation && status !== "decided";
  return (
    <section
      aria-labelledby="review-heading"
      className="flex gap-3 rounded-md border border-border bg-surface-raised p-5"
    >
      <ProvenanceRibbon variant="human" />
      <div className="flex-1 space-y-5">
        <h2
          id="review-heading"
          className="text-xl text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "cases.review.heading" })}
        </h2>
        <ReviewLog reviews={reviews} />
        {canAct && <ReviewActionForm recommendation={recommendation} onSubmit={onSubmit} />}
      </div>
    </section>
  );
}
