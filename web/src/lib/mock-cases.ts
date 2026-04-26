import type {
  AuditPackage,
  CaseDetail,
  CaseListItem,
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
      rule_description: "Applicant must be a Canadian citizen or legal resident on the day preceding application.",
      citation: "Old Age Security Act, s. 3(1)(c)",
      outcome: "satisfied",
      detail: "Citizenship verified.",
      evidence_used: ["ev-passport"],
    },
  ],
  explanation: "All three eligibility rules are satisfied with verified evidence. Recommend full pension.",
  pension_type: "full",
  partial_ratio: null,
  missing_evidence: [],
  flags: [],
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
