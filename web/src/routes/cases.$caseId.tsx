import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ChevronLeft } from "lucide-react";
import { evaluateCase, getCase, reviewCase } from "@/lib/api";
import type {
  CaseDetail,
  DecisionOutcome,
  ReviewActionType,
} from "@/lib/types";
import { ApplicantPane } from "@/components/govops/cases/ApplicantPane";
import { RecommendationPane } from "@/components/govops/cases/RecommendationPane";
import { ReviewPane } from "@/components/govops/cases/ReviewPane";
import { AuditDrawer } from "@/components/govops/cases/AuditDrawer";
import { StatusPill } from "@/components/govops/cases/StatusPill";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [
      { title: `Case ${params.caseId} — GovOps` },
    ],
  }),
  loader: async ({ params }) => {
    const detail = await getCase(params.caseId);
    if (!detail) throw new Error(`Case ${params.caseId} not found`);
    return { detail };
  },
  errorComponent: ({ error, reset }) => <RouteError error={error as Error} reset={reset} />,
  pendingComponent: () => <RouteLoading variant="panel" />,
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const intl = useIntl();
  const { caseId } = Route.useParams();
  const initial = (Route.useLoaderData() as { detail: CaseDetail }).detail;
  const [detail, setDetail] = useState<CaseDetail>(initial);
  const [announcement, setAnnouncement] = useState<string>("");

  const handleEvaluate = async () => {
    const { recommendation } = await evaluateCase(caseId);
    setDetail((prev) => ({ ...prev, recommendation }));
    setAnnouncement(intl.formatMessage({ id: "cases.review.success" }) || "Evaluation complete");
  };

  const handleReview = async (body: {
    action: ReviewActionType;
    rationale: string;
    final_outcome: DecisionOutcome | null;
  }) => {
    const { review } = await reviewCase(caseId, body);
    setDetail((prev) => ({
      ...prev,
      reviews: [...prev.reviews, review],
      case: {
        ...prev.case,
        status: body.action === "approve" || body.action === "modify" ? "decided" : prev.case.status,
      },
    }));
    setAnnouncement(intl.formatMessage({ id: "cases.review.success" }));
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          {intl.formatMessage({ id: "cases.list.heading" })}
        </Link>
        <AuditDrawer caseId={caseId} />
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <h1
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
        >
          {intl.formatMessage({ id: "cases.detail.heading" }, { id: caseId })}
        </h1>
        <StatusPill status={detail.case.status} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ApplicantPane bundle={detail.case} />
        <RecommendationPane
          recommendation={detail.recommendation}
          onEvaluate={handleEvaluate}
        />
      </div>

      <ReviewPane
        status={detail.case.status}
        recommendation={detail.recommendation}
        reviews={detail.reviews}
        onSubmit={handleReview}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
