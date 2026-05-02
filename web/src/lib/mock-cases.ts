import type {
  AuditPackage,
  CaseDetail,
  CaseListItem,
  CaseEvent,
  CaseEventRequest,
  GetEventsResponse,
  PostEventResponse,
  HumanReviewAction,
  Recommendation,
} from "./types";
import { MOCK_AUTHORITY_CHAIN, MOCK_JURISDICTION } from "./mock-authority";

/**
 * Mock case fixtures used as preview fallback when the FastAPI backend is
 * unreachable. Cover each status path so the list and detail views can be
 * exercised without a live engine.
 */
export const MOCK_CASE_LIST: CaseListItem[] = [
  {
    id: "case-2025-0142",
    applicant_name: "Marie Tremblay",
    status: "recommendation_ready",
    has_recommendation: true,
    jurisdiction_id: "ca-oas",
  },
  {
    id: "case-2025-0143",
    applicant_name: "Anand Patel",
    status: "decided",
    has_recommendation: true,
    jurisdiction_id: "ca-oas",
  },
  {
    id: "case-2025-0144",
    applicant_name: "Lucia Fernández",
    status: "intake",
    has_recommendation: false,
    jurisdiction_id: "ca-oas",
  },
  {
    id: "case-2025-0145",
    applicant_name: "Wei Chen",
    status: "under_review",
    has_recommendation: true,
    jurisdiction_id: "ca-oas",
  },
  {
    id: "case-2025-0146",
    applicant_name: "Olumide Adesanya",
    status: "escalated",
    has_recommendation: true,
    jurisdiction_id: "ca-oas",
  },
];

const REC_142: Recommendation = {
  id: "rec-142",
  case_id: "case-2025-0142",
  timestamp: "2025-04-20T14:32:00Z",
  outcome: "eligible",
  confidence: 0.94,
  rule_evaluations: [
    {
      rule_id: "rule-age-65",
      rule_description: "Applicant must be at least 65 years of age.",
      citation: "Old Age Security Act, s. 3(1)(a)",
      outcome: "satisfied",
      detail: "Applicant is 67 years old as of evaluation date.",
      evidence_used: ["ev-passport"],
    },
    {
      rule_id: "rule-residency-10",
      rule_description: "Applicant must have resided in Canada for at least 10 years after age 18.",
      citation: "Old Age Security Act, s. 3(1)(b)",
      outcome: "satisfied",
      detail: "Verified 42 years of continuous residency.",
      evidence_used: ["ev-tax-records", "ev-utility-bills"],
    },
    {
      rule_id: "rule-legal-status",
      rule_description:
        "Applicant must be a Canadian citizen or legal resident on the day preceding application.",
      citation: "Old Age Security Act, s. 3(1)(c)",
      outcome: "satisfied",
      detail: "Citizenship verified.",
      evidence_used: ["ev-passport"],
    },
  ],
  explanation:
    "All three eligibility rules are satisfied with verified evidence. Recommend full pension.",
  pension_type: "full",
  partial_ratio: null,
  missing_evidence: [],
  flags: [],
  benefit_amount: {
    value: 727.67,
    currency: "CAD",
    period: "monthly",
    formula_trace: [
      { op: "ref", inputs: ["oas.base.monthly"], output: 727.67, citation: "OAS Act, s. 7(1)" },
      { op: "field", inputs: ["residency_years"], output: 42 },
      { op: "const", inputs: [40], output: 40, note: "full-pension threshold" },
      { op: "min", inputs: [42, 40], output: 40 },
      { op: "divide", inputs: [40, 40], output: 1 },
      { op: "multiply", inputs: [727.67, 1], output: 727.67, citation: "OAS Act, s. 7(2)" },
    ],
    citations: ["OAS Act, s. 7(1)", "OAS Act, s. 7(2)"],
  },
};

const REC_143: Recommendation = {
  ...REC_142,
  id: "rec-143",
  case_id: "case-2025-0143",
  timestamp: "2025-04-18T10:12:00Z",
  outcome: "eligible",
  confidence: 0.88,
  pension_type: "partial",
  partial_ratio: "25/40",
  explanation: "Eligible for partial pension based on 25 years of post-18 residency.",
  benefit_amount: {
    value: 454.79,
    currency: "CAD",
    period: "monthly",
    formula_trace: [
      { op: "ref", inputs: ["oas.base.monthly"], output: 727.67, citation: "OAS Act, s. 7(1)" },
      { op: "field", inputs: ["residency_years"], output: 25 },
      { op: "const", inputs: [40], output: 40 },
      { op: "divide", inputs: [25, 40], output: 0.625 },
      { op: "multiply", inputs: [727.67, 0.625], output: 454.79, citation: "OAS Act, s. 7(2)" },
    ],
    citations: ["OAS Act, s. 7(1)", "OAS Act, s. 7(2)"],
  },
};

const REC_145: Recommendation = {
  ...REC_142,
  id: "rec-145",
  case_id: "case-2025-0145",
  timestamp: "2025-04-22T09:00:00Z",
  outcome: "insufficient_evidence",
  confidence: 0.42,
  rule_evaluations: [
    {
      rule_id: "rule-residency-10",
      rule_description: "Applicant must have resided in Canada for at least 10 years after age 18.",
      citation: "Old Age Security Act, s. 3(1)(b)",
      outcome: "insufficient_evidence",
      detail: "Gap of 6 years (2003–2009) lacks supporting documents.",
      evidence_used: [],
    },
  ],
  explanation: "Cannot confirm residency requirement; request additional records before deciding.",
  pension_type: "",
  partial_ratio: null,
  missing_evidence: ["Tax records 2003–2009", "Lease agreement during gap period"],
  flags: ["residency_gap"],
};

const REC_146: Recommendation = {
  ...REC_142,
  id: "rec-146",
  case_id: "case-2025-0146",
  timestamp: "2025-04-19T16:40:00Z",
  outcome: "escalate",
  confidence: 0.31,
  pension_type: "",
  flags: ["complex_dual_residency", "treaty_implication"],
  explanation: "Treaty interaction with bilateral agreement requires senior reviewer.",
};

const DETAILS: Record<string, CaseDetail> = {
  "case-2025-0142": {
    case: {
      id: "case-2025-0142",
      created_at: "2025-04-15T08:00:00Z",
      status: "recommendation_ready",
      jurisdiction_id: "ca-oas",
      applicant: {
        id: "applicant-142",
        date_of_birth: "1957-11-04",
        legal_name: "Marie Tremblay",
        legal_status: "Citizen",
        country_of_birth: "Canada",
      },
      residency_periods: [
        {
          country: "CA",
          start_date: "1975-09-01",
          end_date: null,
          verified: true,
          evidence_ids: ["ev-tax-records"],
        },
      ],
      evidence_items: [
        {
          id: "ev-passport",
          evidence_type: "identity",
          description: "Canadian passport (current)",
          provided: true,
          verified: true,
          source_reference: "Passport Canada",
        },
        {
          id: "ev-tax-records",
          evidence_type: "residency",
          description: "Tax records 1975–2024",
          provided: true,
          verified: true,
          source_reference: "CRA",
        },
        {
          id: "ev-utility-bills",
          evidence_type: "residency",
          description: "Utility bills (sample years)",
          provided: true,
          verified: true,
          source_reference: "Self-attested",
        },
      ],
    },
    recommendation: REC_142,
    reviews: [],
  },
  "case-2025-0143": {
    case: {
      id: "case-2025-0143",
      created_at: "2025-04-10T08:00:00Z",
      status: "decided",
      jurisdiction_id: "ca-oas",
      applicant: {
        id: "applicant-143",
        date_of_birth: "1956-03-22",
        legal_name: "Anand Patel",
        legal_status: "Permanent Resident",
        country_of_birth: "India",
      },
      residency_periods: [
        {
          country: "CA",
          start_date: "2000-06-01",
          end_date: null,
          verified: true,
          evidence_ids: ["ev-pr-card"],
        },
      ],
      evidence_items: [
        {
          id: "ev-pr-card",
          evidence_type: "identity",
          description: "Permanent Resident card",
          provided: true,
          verified: true,
          source_reference: "IRCC",
        },
      ],
    },
    recommendation: REC_143,
    reviews: [
      {
        id: "review-143-01",
        case_id: "case-2025-0143",
        recommendation_id: "rec-143",
        reviewer: "human:reviewer.jdoe",
        action: "approve",
        rationale: "Verified residency calculation matches submitted records. Approved as partial.",
        timestamp: "2025-04-19T11:20:00Z",
        final_outcome: "eligible",
      },
    ],
  },
  "case-2025-0144": {
    case: {
      id: "case-2025-0144",
      created_at: "2025-04-23T09:30:00Z",
      status: "intake",
      jurisdiction_id: "ca-oas",
      applicant: {
        id: "applicant-144",
        date_of_birth: "1958-08-12",
        legal_name: "Lucia Fernández",
        legal_status: "Citizen",
        country_of_birth: "Spain",
      },
      residency_periods: [],
      evidence_items: [],
    },
    recommendation: null,
    reviews: [],
  },
  "case-2025-0145": {
    case: {
      id: "case-2025-0145",
      created_at: "2025-04-12T08:00:00Z",
      status: "under_review",
      jurisdiction_id: "ca-oas",
      applicant: {
        id: "applicant-145",
        date_of_birth: "1959-02-10",
        legal_name: "Wei Chen",
        legal_status: "Citizen",
        country_of_birth: "China",
      },
      residency_periods: [
        {
          country: "CA",
          start_date: "1985-03-15",
          end_date: "2003-01-01",
          verified: true,
          evidence_ids: [],
        },
        {
          country: "CN",
          start_date: "2003-01-02",
          end_date: "2009-06-30",
          verified: false,
          evidence_ids: [],
        },
        {
          country: "CA",
          start_date: "2009-07-01",
          end_date: null,
          verified: true,
          evidence_ids: [],
        },
      ],
      evidence_items: [
        {
          id: "ev-citizenship",
          evidence_type: "identity",
          description: "Citizenship certificate",
          provided: true,
          verified: true,
          source_reference: "IRCC",
        },
      ],
    },
    recommendation: REC_145,
    reviews: [],
  },
  "case-2025-0146": {
    case: {
      id: "case-2025-0146",
      created_at: "2025-04-08T08:00:00Z",
      status: "escalated",
      jurisdiction_id: "ca-oas",
      applicant: {
        id: "applicant-146",
        date_of_birth: "1955-12-01",
        legal_name: "Olumide Adesanya",
        legal_status: "Citizen",
        country_of_birth: "Nigeria",
      },
      residency_periods: [
        {
          country: "CA",
          start_date: "1990-01-01",
          end_date: null,
          verified: true,
          evidence_ids: [],
        },
      ],
      evidence_items: [],
    },
    recommendation: REC_146,
    reviews: [],
  },
};

export function mockGetCase(caseId: string): CaseDetail | null {
  return DETAILS[caseId] ?? null;
}

export function mockEvaluateCase(caseId: string): { recommendation: Recommendation } {
  const d = DETAILS[caseId];
  if (!d) throw new Error(`No case ${caseId}`);
  // If no recommendation yet, fabricate one for preview demo.
  const rec: Recommendation = d.recommendation ?? {
    id: `rec-${caseId}`,
    case_id: caseId,
    timestamp: new Date().toISOString(),
    outcome: "insufficient_evidence",
    confidence: 0.5,
    rule_evaluations: [],
    explanation: "Preview evaluation — backend unavailable.",
    pension_type: "",
    partial_ratio: null,
    missing_evidence: ["Backend connection"],
    flags: ["preview_mode"],
  };
  return { recommendation: rec };
}

export function mockReviewCase(
  caseId: string,
  body: { action: string; rationale: string; final_outcome: string | null },
): { review: HumanReviewAction } {
  return {
    review: {
      id: `review-${caseId}-${Date.now()}`,
      case_id: caseId,
      recommendation_id: DETAILS[caseId]?.recommendation?.id ?? "",
      reviewer: "human:reviewer.preview",
      action: body.action as HumanReviewAction["action"],
      rationale: body.rationale,
      timestamp: new Date().toISOString(),
      final_outcome: body.final_outcome as HumanReviewAction["final_outcome"],
    },
  };
}

export function mockGetAudit(caseId: string): AuditPackage {
  const d = DETAILS[caseId];
  return {
    case_id: caseId,
    generated_at: new Date().toISOString(),
    jurisdiction: {
      id: MOCK_JURISDICTION.id,
      name: MOCK_JURISDICTION.name,
      country: MOCK_JURISDICTION.country,
      level: MOCK_JURISDICTION.level,
    },
    authority_chain: MOCK_AUTHORITY_CHAIN.map((a) => ({
      id: a.id,
      layer: a.layer,
      title: a.title,
      citation: a.citation,
      effective_date: a.effective_date,
      url: a.url,
    })),
    applicant_summary: d
      ? {
          legal_name: d.case.applicant.legal_name,
          date_of_birth: d.case.applicant.date_of_birth,
          legal_status: d.case.applicant.legal_status,
          country_of_birth: d.case.applicant.country_of_birth,
        }
      : {},
    recommendation: d?.recommendation ?? null,
    review_actions: d?.reviews ?? [],
    audit_trail: d
      ? [
          {
            timestamp: d.case.created_at,
            event_type: "case.created",
            actor: "system",
            detail: `Case ${caseId} created`,
            data: {},
          },
          ...(d.recommendation
            ? [
                {
                  timestamp: d.recommendation.timestamp,
                  event_type: "recommendation.generated",
                  actor: "agent:engine",
                  detail: `Recommendation: ${d.recommendation.outcome} (${Math.round(d.recommendation.confidence * 100)}%)`,
                  data: { outcome: d.recommendation.outcome },
                },
              ]
            : []),
          ...d.reviews.map((r) => ({
            timestamp: r.timestamp,
            event_type: `review.${r.action}`,
            actor: r.reviewer,
            detail: r.rationale,
            data: { final_outcome: r.final_outcome },
          })),
        ]
      : [],
    rules_applied: d?.recommendation?.rule_evaluations ?? [],
    evidence_summary:
      d?.case.evidence_items.map((e) => ({
        id: e.id,
        type: e.evidence_type,
        description: e.description,
        verified: e.verified,
      })) ?? [],
  };
}

// ── Case events (govops-019) ────────────────────────────────────────────────

const eventsByCase: Record<string, CaseEvent[]> = {
  "case-2025-0142": [
    {
      id: "evt-142-001",
      case_id: "case-2025-0142",
      event_type: "re_evaluate",
      effective_date: "2025-04-20",
      recorded_at: "2025-04-20T14:30:00Z",
      actor: "system",
      payload: {},
      note: "Initial evaluation.",
      triggered_recommendation_id: "rec-142",
    },
  ],
  "case-2025-0143": [
    {
      id: "evt-143-001",
      case_id: "case-2025-0143",
      event_type: "re_evaluate",
      effective_date: "2025-04-18",
      recorded_at: "2025-04-18T10:10:00Z",
      actor: "system",
      payload: {},
      triggered_recommendation_id: "rec-143",
    },
  ],
  "demo-case-001": [
    {
      id: "evt-demo-001",
      case_id: "demo-case-001",
      event_type: "re_evaluate",
      effective_date: "2025-01-15",
      recorded_at: "2025-01-15T09:00:00Z",
      actor: "system",
      payload: {},
      triggered_recommendation_id: "rec-142",
    },
  ],
};

const recommendationsByCase: Record<string, Recommendation[]> = {
  "case-2025-0142": [REC_142],
  "case-2025-0143": [REC_143],
  "demo-case-001": [REC_142],
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function mockListCaseEvents(caseId: string): Promise<GetEventsResponse> {
  await new Promise((r) => setTimeout(r, 120));
  const events = (eventsByCase[caseId] ?? []).slice().sort((a, b) => {
    const cmp = a.effective_date.localeCompare(b.effective_date);
    return cmp !== 0 ? cmp : a.recorded_at.localeCompare(b.recorded_at);
  });
  const recommendations = (recommendationsByCase[caseId] ?? [])
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { events, recommendations };
}

function validatePayload(body: CaseEventRequest): string | null {
  switch (body.event_type) {
    case "move_country":
      if (!body.payload.to_country) return "to_country required";
      return null;
    case "change_legal_status":
      if (!body.payload.to_status) return "to_status required";
      return null;
    case "add_evidence":
      if (!body.payload.evidence_type) return "evidence_type required";
      return null;
    case "re_evaluate":
      return null;
    default:
      return "unknown event_type";
  }
}

export async function mockPostCaseEvent(
  caseId: string,
  body: CaseEventRequest,
  reevaluate: boolean,
): Promise<PostEventResponse> {
  await new Promise((r) => setTimeout(r, 350));
  const err = validatePayload(body);
  if (err) throw new Error(err);

  const event: CaseEvent = {
    id: uid("evt"),
    case_id: caseId,
    event_type: body.event_type,
    effective_date: body.effective_date,
    recorded_at: new Date().toISOString(),
    actor: body.actor ?? "citizen",
    payload: body.payload,
    note: body.note ?? null,
    triggered_recommendation_id: null,
  };

  if (!eventsByCase[caseId]) eventsByCase[caseId] = [];
  eventsByCase[caseId].push(event);

  if (!reevaluate) return { event };

  // Synthesize a new recommendation that supersedes the most recent one.
  const prior = (recommendationsByCase[caseId] ?? []).slice(-1)[0] ?? null;
  const base: Recommendation = prior ?? {
    id: uid("rec"),
    case_id: caseId,
    timestamp: new Date().toISOString(),
    outcome: "insufficient_evidence",
    confidence: 0.5,
    rule_evaluations: [],
    explanation: "Re-evaluation requested.",
    pension_type: "",
    partial_ratio: null,
    missing_evidence: [],
    flags: [],
  };
  const newRec: Recommendation = {
    ...base,
    id: uid("rec"),
    case_id: caseId,
    timestamp: new Date().toISOString(),
    supersedes: prior?.id ?? null,
    triggered_by_event_id: event.id,
    explanation:
      body.event_type === "move_country"
        ? `Re-evaluated after move to ${String(body.payload.to_country)}.`
        : body.event_type === "change_legal_status"
          ? `Re-evaluated after legal status change to ${String(body.payload.to_status)}.`
          : body.event_type === "add_evidence"
            ? `Re-evaluated after adding evidence: ${String(body.payload.evidence_type)}.`
            : "Reassessment requested by caseworker.",
  };
  if (!recommendationsByCase[caseId]) recommendationsByCase[caseId] = [];
  recommendationsByCase[caseId].push(newRec);
  event.triggered_recommendation_id = newRec.id;

  return { event, recommendation: newRec };
}
