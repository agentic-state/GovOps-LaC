import type {
  EncodingAuditEntry,
  EncodingBatch,
  EncodingBatchSummary,
  ProposalStatus,
  RuleProposal,
  RuleType,
} from "./types";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function counts(proposals: RuleProposal[]): Record<ProposalStatus, number> {
  const out: Record<ProposalStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    modified: 0,
  };
  for (const p of proposals) out[p.status]++;
  return out;
}

const AGENT = "agent:claude-encoder";
const HUMAN = "human:reviewer.preview";

const SAMPLE_PROPOSALS_LLM: RuleProposal[] = [
  {
    id: "prop-001",
    rule_type: "age_threshold" as RuleType,
    description: "Applicant must be at least 65 years of age on the date of application.",
    formal_expression: "applicant.age_years >= 65",
    citation: "Old Age Security Act, s. 3(1)(a)",
    parameters: { threshold_years: 65 },
    status: "pending",
    notes: "",
    reviewer: null,
    reviewed_at: null,
    source_section_ref: "s. 3(1)(a)",
  },
  {
    id: "prop-002",
    rule_type: "residency_minimum" as RuleType,
    description: "Applicant must have resided in Canada for at least 10 years after age 18.",
    formal_expression: "sum(residency_years_after_age(18, country='CA')) >= 10",
    citation: "Old Age Security Act, s. 3(1)(b)",
    parameters: { minimum_years: 10, after_age: 18, country: "CA" },
    status: "pending",
    notes: "",
    reviewer: null,
    reviewed_at: null,
    source_section_ref: "s. 3(1)(b)",
  },
  {
    id: "prop-003",
    rule_type: "legal_status" as RuleType,
    description: "Applicant must be a Canadian citizen or legal resident on the day preceding application.",
    formal_expression: "applicant.legal_status in {'citizen','permanent_resident'}",
    citation: "Old Age Security Act, s. 3(1)(c)",
    parameters: { allowed: ["citizen", "permanent_resident"] },
    status: "pending",
    notes: "",
    reviewer: null,
    reviewed_at: null,
    source_section_ref: "s. 3(1)(c)",
  },
  {
    id: "prop-004",
    rule_type: "residency_partial" as RuleType,
    description: "Partial pension is calculated as years of post-18 residency divided by 40.",
    formal_expression: "partial_ratio = min(years_post_18 / 40, 1.0)",
    citation: "Old Age Security Act, s. 3(2)",
    parameters: { divisor: 40 },
    status: "pending",
    notes: "",
    reviewer: null,
    reviewed_at: null,
    source_section_ref: "s. 3(2)",
  },
];

const BATCHES: Record<string, EncodingBatch> = {
  "batch-001": {
    id: "batch-001",
    jurisdiction_id: "ca-oas",
    document_title: "Old Age Security Act — eligibility extract",
    document_citation: "R.S.C., 1985, c. O-9, s. 3",
    source_url: "https://laws-lois.justice.gc.ca/eng/acts/O-9/",
    input_text:
      "3 (1) Subject to this Act and the regulations, a full monthly pension may be paid to every person who\n" +
      "  (a) has attained sixty-five years of age;\n" +
      "  (b) has resided in Canada for at least ten years after attaining eighteen years of age; and\n" +
      "  (c) is a Canadian citizen or, on the day preceding the day of application approval, was legally resident in Canada.\n" +
      "(2) Where a person fails to qualify for a full pension under subsection (1), a partial pension may be paid.",
    method: "llm:claude",
    proposals: SAMPLE_PROPOSALS_LLM,
    audit: [
      {
        timestamp: "2025-04-21T09:00:00Z",
        event_type: "batch.created",
        actor: AGENT,
        detail: "Extraction completed: 4 proposals generated.",
        data: { proposal_count: 4 },
      },
    ],
    created_at: "2025-04-21T09:00:00Z",
  },
  "batch-002": {
    id: "batch-002",
    jurisdiction_id: "ca-oas",
    document_title: "Manual encoding — exclusion clause",
    document_citation: "R.S.C., 1985, c. O-9, s. 5(1)",
    source_url: null,
    input_text:
      "5 (1) An applicant for a pension shall meet the requirements of this Act despite any agreement to the contrary.",
    method: "manual",
    proposals: [
      {
        id: "prop-101",
        rule_type: "exclusion" as RuleType,
        description: "Side agreements cannot waive eligibility requirements.",
        formal_expression: "ignore(applicant.side_agreement_waivers)",
        citation: "Old Age Security Act, s. 5(1)",
        parameters: {},
        status: "approved",
        notes: "Reviewed and approved by counsel.",
        reviewer: HUMAN,
        reviewed_at: "2025-04-15T14:00:00Z",
        source_section_ref: "s. 5(1)",
      },
    ],
    audit: [
      {
        timestamp: "2025-04-15T13:00:00Z",
        event_type: "batch.created",
        actor: HUMAN,
        detail: "Manual encoding from legal counsel.",
        data: {},
      },
      {
        timestamp: "2025-04-15T14:00:00Z",
        event_type: "proposal.approved",
        actor: HUMAN,
        detail: "prop-101 approved.",
        data: {},
      },
    ],
    created_at: "2025-04-15T13:00:00Z",
  },
};

export function mockListEncodingBatches(): EncodingBatchSummary[] {
  return Object.values(BATCHES)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((b) => ({
      id: b.id,
      jurisdiction_id: b.jurisdiction_id,
      document_title: b.document_title,
      document_citation: b.document_citation,
      method: b.method,
      counts: counts(b.proposals),
      created_at: b.created_at,
    }));
}

export function mockGetEncodingBatch(id: string): EncodingBatch {
  const b = BATCHES[id];
  if (!b) throw new Error(`No batch ${id}`);
  return b;
}

export interface CreateBatchRequest {
  document_title: string;
  document_citation: string;
  source_url?: string;
  input_text: string;
  method: "manual" | "llm";
  api_key?: string;
}

export function mockCreateEncodingBatch(body: CreateBatchRequest): EncodingBatch {
  const id = `batch-${uid()}`;
  const llm = body.method === "llm";
  const proposals: RuleProposal[] = llm
    ? SAMPLE_PROPOSALS_LLM.map((p) => ({ ...p, id: `${id}-${p.id}` }))
    : [
        {
          id: `${id}-manual-01`,
          rule_type: "age_threshold" as RuleType,
          description: body.document_title.slice(0, 80) || "Manually encoded rule",
          formal_expression: "// fill in formal expression",
          citation: body.document_citation,
          parameters: {},
          status: "pending",
          notes: "",
          reviewer: null,
          reviewed_at: null,
          source_section_ref: "",
        },
      ];
  const batch: EncodingBatch = {
    id,
    jurisdiction_id: "ca-oas",
    document_title: body.document_title,
    document_citation: body.document_citation,
    source_url: body.source_url ?? null,
    input_text: body.input_text,
    method: llm ? "llm:claude" : "manual",
    proposals,
    audit: [
      {
        timestamp: new Date().toISOString(),
        event_type: "batch.created",
        actor: llm ? AGENT : HUMAN,
        detail: `Batch created via ${llm ? "LLM extraction" : "manual encoding"} (${proposals.length} proposals).`,
        data: { proposal_count: proposals.length },
      },
    ],
    created_at: new Date().toISOString(),
  };
  BATCHES[id] = batch;
  return batch;
}

export interface ReviewProposalBody {
  status: ProposalStatus;
  notes?: string;
  overrides?: Partial<
    Pick<RuleProposal, "description" | "formal_expression" | "citation" | "parameters">
  >;
}

export function mockReviewProposal(
  batchId: string,
  proposalId: string,
  body: ReviewProposalBody,
): RuleProposal {
  const b = BATCHES[batchId];
  if (!b) throw new Error(`No batch ${batchId}`);
  const idx = b.proposals.findIndex((p) => p.id === proposalId);
  if (idx === -1) throw new Error(`No proposal ${proposalId}`);
  const updated: RuleProposal = {
    ...b.proposals[idx],
    ...(body.overrides ?? {}),
    status: body.status,
    notes: body.notes ?? b.proposals[idx].notes,
    reviewer: HUMAN,
    reviewed_at: new Date().toISOString(),
  };
  b.proposals[idx] = updated;
  const entry: EncodingAuditEntry = {
    timestamp: updated.reviewed_at!,
    event_type: `proposal.${body.status}`,
    actor: HUMAN,
    detail: `${proposalId} → ${body.status}${body.notes ? ` — ${body.notes}` : ""}`,
    data: { proposal_id: proposalId },
  };
  b.audit.push(entry);
  return updated;
}

export function mockBulkReviewProposals(
  batchId: string,
  body: { proposal_ids: string[]; status: ProposalStatus; notes?: string },
): { updated: RuleProposal[] } {
  const updated = body.proposal_ids.map((pid) =>
    mockReviewProposal(batchId, pid, { status: body.status, notes: body.notes }),
  );
  return { updated };
}

export function mockCommitBatch(batchId: string): { committed_rule_ids: string[] } {
  const b = BATCHES[batchId];
  if (!b) throw new Error(`No batch ${batchId}`);
  const approved = b.proposals.filter((p) => p.status === "approved");
  b.audit.push({
    timestamp: new Date().toISOString(),
    event_type: "batch.committed",
    actor: HUMAN,
    detail: `Committed ${approved.length} approved proposals.`,
    data: { rule_ids: approved.map((p) => p.id) },
  });
  return { committed_rule_ids: approved.map((p) => p.id) };
}
