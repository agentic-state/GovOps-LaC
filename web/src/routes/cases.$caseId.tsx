import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ChevronLeft } from "lucide-react";
import { evaluateCase, getCase, listCaseEvents, reviewCase } from "@/lib/api";
import type {
  CaseDetail,
  CaseEvent,
  DecisionOutcome,
  PostEventResponse,
  Recommendation,
  ReviewActionType,
} from "@/lib/types";
import { ApplicantPane } from "@/components/govops/cases/ApplicantPane";
import { RecommendationPane } from "@/components/govops/cases/RecommendationPane";
import { ReviewPane } from "@/components/govops/cases/ReviewPane";
import { AuditDrawer } from "@/components/govops/cases/AuditDrawer";
import { StatusPill } from "@/components/govops/cases/StatusPill";
import { RouteError } from "@/components/govops/RouteError";
import { RouteLoading } from "@/components/govops/RouteLoading";
import { DownloadDecisionButton } from "@/components/govops/notices/DownloadDecisionButton";
import { EventTimeline } from "@/components/govops/cases/EventTimeline";
import { NewEventForm } from "@/components/govops/cases/NewEventForm";
import { PreviousDecisions } from "@/components/govops/cases/PreviousDecisions";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [{ title: `Case ${params.caseId} — GovOps` }],
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
  const { locale } = useLocale();
  const { caseId } = Route.useParams();
  const initial = (Route.useLoaderData() as { detail: CaseDetail }).detail;
  const [detail, setDetail] = useState<CaseDetail>(initial);
  const [announcement, setAnnouncement] = useState<string>("");
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [recHistory, setRecHistory] = useState<Recommendation[]>([]);

  const refreshEvents = async () => {
    try {
      const res = await listCaseEvents(caseId);
      setEvents(res.events);
      setRecHistory(res.recommendations);
    } catch {
      /* preview: ignore */
    }
  };

  useEffect(() => {
    void refreshEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

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
        status:
          body.action === "approve" || body.action === "modify" ? "decided" : prev.case.status,
      },
    }));
    setAnnouncement(intl.formatMessage({ id: "cases.review.success" }));
  };

  const handleEventCreated = async (res: PostEventResponse) => {
    if (res.recommendation) {
      setDetail((prev) => ({ ...prev, recommendation: res.recommendation! }));
    }
    await refreshEvents();
    setAnnouncement(intl.formatMessage({ id: "events.created.success" }));
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
        <div id={detail.recommendation ? `recommendation-${detail.recommendation.id}` : undefined}>
          <RecommendationPane
            recommendation={detail.recommendation}
            onEvaluate={handleEvaluate}
            jurisdictionLabel={detail.case.jurisdiction_id}
            downloadSlot={
              detail.recommendation ? (
                <DownloadDecisionButton mode="case" caseId={caseId} language={locale} />
              ) : null
            }
          />
        </div>
      </div>

      {recHistory.length > 1 && (
        <PreviousDecisions
          recommendations={recHistory}
          events={events}
          jurisdictionLabel={detail.case.jurisdiction_id}
        />
      )}

      <section
        aria-labelledby="events-heading"
        className="space-y-3 rounded-md border border-border bg-surface-raised p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="events-heading"
            className="text-lg text-foreground"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {intl.formatMessage({ id: "events.heading" })}
          </h2>
          <NewEventForm caseId={caseId} onCreated={handleEventCreated} />
        </div>
        <EventTimeline events={events} recommendations={recHistory} caseId={caseId} />
      </section>

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
