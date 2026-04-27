export type ValueType = "number" | "string" | "bool" | "list" | "enum" | "prompt" | "formula";
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";

export interface ConfigValue {
  id: string;
  domain: string;
  key: string;
  jurisdiction_id: string | null;
  value: unknown;
  value_type: ValueType;
  effective_from: string;
  effective_to: string | null;
  citation: string | null;
  author: string;
  approved_by: string | null;
  rationale: string;
  supersedes: string | null;
  status: ApprovalStatus;
  language: string | null;
  created_at: string;
}

export interface ListConfigValuesResponse {
  values: ConfigValue[];
  count: number;
}

export interface ListConfigValuesParams {
  domain?: string;
  key_prefix?: string;
  jurisdiction_id?: string;
  language?: string;
}

export interface ListVersionsResponse {
  key: string;
  versions: ConfigValue[]; // backend returns oldest-first; UI flips to newest-first
  count: number;
}

export const DOMAINS = ["rule", "enum", "ui", "prompt", "engine"] as const;
export const JURISDICTIONS = [
  "ca-oas",
  "us-fed",
  "uk-gov",
  "fr-gouv",
  "de-bund",
  "br-fed",
] as const;
export const LANGUAGES = ["en", "fr", "pt", "es", "de", "uk"] as const;

export interface CreateConfigValueRequest {
  domain: string;
  key: string;
  jurisdiction_id: string | null;
  value: unknown;
  value_type: ValueType;
  effective_from: string;
  effective_to: string | null;
  citation: string | null;
  author: string;
  rationale: string;
  supersedes: string | null;
  language: string | null;
}

// ── Authority chain (govops-010) ────────────────────────────────────────────

export type DocumentType = "statute" | "regulation" | "policy_manual" | "guidance";

export type RuleType =
  | "age_threshold"
  | "residency_minimum"
  | "residency_partial"
  | "legal_status"
  | "evidence_required"
  | "exclusion";

export interface Jurisdiction {
  id: string;
  name: string;
  country: string;
  level: string;
  parent_id: string | null;
  legal_tradition: string;
  language_regime: string;
}

/**
 * Shape returned by `GET /api/jurisdiction/{code}` for the citizen-facing
 * /screen route. Distinct from the richer admin `Jurisdiction` interface
 * above — only the fields the public surface needs.
 */
export interface JurisdictionResponse {
  id: string;
  jurisdiction_label: string;
  program_name: string;
  default_language: string;
}

export interface AuthorityReference {
  id: string;
  jurisdiction_id: string;
  layer: string;
  title: string;
  citation: string;
  effective_date: string | null;
  url: string;
  parent_id: string | null;
}

export interface LegalSection {
  id: string;
  section_ref: string;
  heading: string;
  text: string;
}

export interface LegalDocument {
  id: string;
  jurisdiction_id: string;
  document_type: DocumentType;
  title: string;
  citation: string;
  effective_date: string | null;
  sections: LegalSection[];
}

export interface LegalRule {
  id: string;
  source_document_id: string;
  source_section_ref: string;
  rule_type: RuleType;
  description: string;
  formal_expression: string;
  citation: string;
  parameters: Record<string, unknown>;
}

// ── Cases (govops-009) ──────────────────────────────────────────────────────

export type CaseStatus =
  | "intake"
  | "evaluating"
  | "recommendation_ready"
  | "under_review"
  | "decided"
  | "escalated";

export type DecisionOutcome =
  | "eligible"
  | "ineligible"
  | "insufficient_evidence"
  | "escalate";

export type ReviewActionType =
  | "approve"
  | "modify"
  | "reject"
  | "request_info"
  | "escalate";

export type RuleOutcome =
  | "satisfied"
  | "not_satisfied"
  | "insufficient_evidence"
  | "not_applicable";

export interface CaseListItem {
  id: string;
  applicant_name: string;
  status: CaseStatus;
  has_recommendation: boolean;
  jurisdiction_id?: string;
}

export interface Applicant {
  id: string;
  date_of_birth: string;
  legal_name: string;
  legal_status: string;
  country_of_birth: string;
}

export interface ResidencyPeriod {
  country: string;
  start_date: string;
  end_date: string | null;
  verified: boolean;
  evidence_ids: string[];
}

export interface EvidenceItem {
  id: string;
  evidence_type: string;
  description: string;
  provided: boolean;
  verified: boolean;
  source_reference: string;
}

export interface CaseBundle {
  id: string;
  created_at: string;
  status: CaseStatus;
  jurisdiction_id: string;
  applicant: Applicant;
  residency_periods: ResidencyPeriod[];
  evidence_items: EvidenceItem[];
}

export interface RuleEvaluation {
  rule_id: string;
  rule_description: string;
  citation: string;
  outcome: RuleOutcome;
  detail: string;
  evidence_used: string[];
}

export interface Recommendation {
  id: string;
  case_id: string;
  timestamp: string;
  outcome: DecisionOutcome;
  confidence: number;
  rule_evaluations: RuleEvaluation[];
  explanation: string;
  pension_type: string;
  partial_ratio: string | null;
  missing_evidence: string[];
  flags: string[];
}

export interface HumanReviewAction {
  id: string;
  case_id: string;
  recommendation_id: string;
  reviewer: string;
  action: ReviewActionType;
  rationale: string;
  timestamp: string;
  final_outcome: DecisionOutcome | null;
}

export interface CaseDetail {
  case: CaseBundle;
  recommendation: Recommendation | null;
  reviews: HumanReviewAction[];
}

export interface AuditTrailEntry {
  timestamp: string;
  event_type: string;
  actor: string;
  detail: string;
  data: Record<string, unknown>;
}

export interface AuditPackage {
  case_id: string;
  generated_at: string;
  jurisdiction: { id: string; name: string; country: string; level: string } | null;
  authority_chain: Array<{
    id: string;
    layer: string;
    title: string;
    citation: string;
    effective_date: string | null;
    url: string;
  }>;
  applicant_summary: Record<string, unknown>;
  recommendation: Recommendation | null;
  review_actions: HumanReviewAction[];
  audit_trail: AuditTrailEntry[];
  rules_applied: RuleEvaluation[];
  evidence_summary: Array<Record<string, unknown>>;
}

// ── Admin / health (govops-012) ─────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  engine: string;
  version: string;
  jurisdiction: string;
  program: string;
  available_jurisdictions: string[];
}

// ── Encoding pipeline (govops-011) ──────────────────────────────────────────

export type ProposalStatus = "pending" | "approved" | "rejected" | "modified";
export type EncodeMethod = "manual" | "llm:claude" | "manual:llm-fallback";

export interface RuleProposal {
  id: string;
  rule_type: RuleType;
  description: string;
  formal_expression: string;
  citation: string;
  parameters: Record<string, unknown>;
  status: ProposalStatus;
  notes: string;
  reviewer: string | null;
  reviewed_at: string | null;
  source_section_ref: string;
}

export interface EncodingAuditEntry {
  timestamp: string;
  event_type: string;
  actor: string;
  detail: string;
  data: Record<string, unknown>;
}

export interface EncodingBatch {
  id: string;
  jurisdiction_id: string;
  document_title: string;
  document_citation: string;
  source_url: string | null;
  input_text: string;
  method: EncodeMethod;
  proposals: RuleProposal[];
  audit: EncodingAuditEntry[];
  created_at: string;
}

export interface EncodingBatchSummary {
  id: string;
  jurisdiction_id: string;
  document_title: string;
  document_citation: string;
  method: EncodeMethod;
  counts: Record<ProposalStatus, number>;
  created_at: string;
}

// ── Citation impact (govops-014) ────────────────────────────────────────────

export interface ImpactResult {
  jurisdiction_id: string | null;
  jurisdiction_label: string;
  values: ConfigValue[];
}

export interface ImpactResponse {
  query: string;
  total: number;
  jurisdiction_count: number;
  results: ImpactResult[];
  /** Page-level metadata (govops-014 pagination). Optional for backwards compat. */
  limit?: number;
  page?: number;
  page_count?: number;
}

// ── Self-screening (govops-015) ─────────────────────────────────────────────

export const SCREEN_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua"] as const;
export type ScreenJurisdictionId = (typeof SCREEN_JURISDICTIONS)[number];

export type ScreenLegalStatus = "citizen" | "permanent_resident" | "other";

export type ScreenOutcome =
  | "eligible"
  | "ineligible"
  | "insufficient_evidence"
  | "escalate";

export type ScreenRuleOutcome =
  | "satisfied"
  | "not_satisfied"
  | "insufficient_evidence"
  | "not_applicable";

export interface ScreenResidencyPeriod {
  country: string;
  start_date: string;
  end_date: string | null;
}

export interface ScreenRequest {
  jurisdiction_id: string;
  date_of_birth: string;
  legal_status: ScreenLegalStatus;
  country_of_birth?: string;
  residency_periods: ScreenResidencyPeriod[];
  evidence_present: { dob: boolean; residency: boolean };
  evaluation_date?: string;
}

export interface ScreenRuleResult {
  rule_id: string;
  description: string;
  citation: string;
  outcome: ScreenRuleOutcome;
  detail: string;
  effective_from?: string;
}

export interface ScreenResponse {
  outcome: ScreenOutcome;
  pension_type: "full" | "partial" | "";
  partial_ratio?: string;
  rule_results: ScreenRuleResult[];
  missing_evidence: string[];
  jurisdiction_label: string;
  evaluation_date: string;
  /** Set client-side when the mock fallback ran. Never sent by the server. */
  _preview?: boolean;
}
