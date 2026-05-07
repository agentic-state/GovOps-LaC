// SSR-aware BASE. Two distinct call paths use this fetcher:
//
//   1. Server-side (Vite dev SSR / TanStack Start route loaders running in
//      Node) — Node's fetch cannot do relative URLs, so BASE must be an
//      absolute URL the Node process can reach. In the v2.1 hosted-demo
//      container this is FastAPI on the loopback interface; in local dev
//      (two-process model per CONTRIBUTING.md) FastAPI also runs on :8000.
//
//   2. Client-side (browser after hydration) — uses BASE as a prefix for
//      `fetch(`${BASE}${path}`)`. On the v2.1 hosted demo, BASE is empty so
//      the browser does same-origin requests that Vite's dev proxy forwards
//      to FastAPI; in local dev with cross-origin (vite :8080, FastAPI
//      :8000) BASE must be the absolute URL of the FastAPI process.
//
// The SSR branch ALWAYS uses 127.0.0.1:8000 because that's where FastAPI
// listens in both deploy targets we support. Browser branch honours
// VITE_API_BASE_URL when set (empty string allowed → relative URLs), falls
// back to 127.0.0.1:8000 for the local dev case.
const BASE = import.meta.env.SSR
  ? "http://127.0.0.1:8000"
  : ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000");

/**
 * Minimal fetch wrapper for the GovOps FastAPI backend.
 * Set VITE_API_BASE_URL to point at a deployed endpoint; otherwise consumers
 * should fall back to mock data (the FastAPI dev server is not reachable from
 * the cloud preview).
 */
export async function fetcher<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

import type {
  ListConfigValuesParams,
  ListConfigValuesResponse,
  ListVersionsResponse,
} from "./types";
import type {
  AuditPackage,
  AuthorityReference,
  CaseDetail,
  CaseListItem,
  ConfigValue,
  CreateConfigValueRequest,
  HealthResponse,
  HumanReviewAction,
  ImpactResponse,
  Jurisdiction,
  JurisdictionResponse,
  LegalDocument,
  LegalRule,
  Recommendation,
  ReviewActionType,
  DecisionOutcome,
  EncodingBatch,
  EncodingBatchSummary,
  ProposalStatus,
  RuleProposal,
} from "./types";
import { MOCK_CONFIG_VALUES } from "./mock-config-values";
import {
  MOCK_AUTHORITY_CHAIN,
  MOCK_JURISDICTION,
  MOCK_LEGAL_DOCUMENTS,
  MOCK_LEGAL_RULES,
} from "./mock-authority";
import {
  MOCK_CASE_LIST,
  mockEvaluateCase,
  mockGetAudit,
  mockGetCase,
  mockReviewCase,
  mockListCaseEvents,
  mockPostCaseEvent,
} from "./mock-cases";

/**
 * Lazy mock loader — dynamic import so production bundles tree-shake the
 * mock module (and its sample data) when not exercised. In preview/dev
 * builds the import resolves on first failure.
 */
const loadMocks = () => import("./api.mock");

const isMockMode = () => import.meta.env.VITE_USE_MOCK_API === "true";

/**
 * fetchOrMock: try the configured backend; on failure, return the supplied
 * mock payload. Lets feature pages render in preview without a live API.
 */
export async function fetchOrMock<T>(path: string, mock: T, init?: RequestInit): Promise<T> {
  try {
    return await fetcher<T>(path, init);
  } catch {
    await new Promise((r) => setTimeout(r, 200));
    return mock;
  }
}

// ---- Fixture batches (govops-008) ------------------------------------------

export interface FixtureBatchSummary {
  id: string;
  jurisdiction_id: string;
  document_title: string;
  document_citation: string;
  text_length: number;
  created_at: string;
}

export interface FixtureRunResult {
  fixture_id: string;
  prompt_key: string;
  proposals_count: number;
  proposals: Array<{
    rule_type: string;
    description: string;
    citation: string;
    parameters: Record<string, unknown>;
  }>;
  raw_response: string;
  latency_ms: number;
  token_count: number | null;
}

export async function listFixtures(): Promise<FixtureBatchSummary[]> {
  if (isMockMode()) return (await loadMocks()).mockListFixtures();
  try {
    return await fetcher<FixtureBatchSummary[]>("/api/encode/fixtures");
  } catch {
    return (await loadMocks()).mockListFixtures();
  }
}

export async function runFixtureWithPrompt(
  fixtureId: string,
  body: { prompt_text: string; prompt_key: string },
): Promise<FixtureRunResult> {
  if (isMockMode()) return (await loadMocks()).mockRunFixtureWithPrompt(fixtureId, body);
  try {
    return await fetcher<FixtureRunResult>(
      `/api/encode/fixtures/${encodeURIComponent(fixtureId)}/run-with-prompt`,
      { method: "POST", body: JSON.stringify(body) },
    );
  } catch {
    return (await loadMocks()).mockRunFixtureWithPrompt(fixtureId, body);
  }
}

export async function listConfigValues(
  params: ListConfigValuesParams,
): Promise<ListConfigValuesResponse> {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "" && v !== "all",
  ) as [string, string][];
  const qs = new URLSearchParams(entries).toString();
  return fetcher<ListConfigValuesResponse>(`/api/config/values${qs ? `?${qs}` : ""}`);
}

export async function listVersions(
  key: string,
  jurisdictionId: string | null,
  language?: string,
): Promise<ListVersionsResponse> {
  const params = new URLSearchParams({ key });
  if (jurisdictionId && jurisdictionId !== "global") {
    params.set("jurisdiction_id", jurisdictionId);
  }
  if (language) params.set("language", language);
  return fetcher<ListVersionsResponse>(`/api/config/versions?${params.toString()}`);
}

export async function getConfigValue(id: string): Promise<ConfigValue> {
  return fetcher<ConfigValue>(`/api/config/values/${encodeURIComponent(id)}`);
}

export async function createConfigValue(body: CreateConfigValueRequest): Promise<ConfigValue> {
  if (isMockMode()) return (await loadMocks()).mockCreateConfigValue(body);
  try {
    return await fetcher<ConfigValue>("/api/config/values", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return (await loadMocks()).mockCreateConfigValue(body);
  }
}

export async function listApprovals(): Promise<ListConfigValuesResponse> {
  if (isMockMode()) return (await loadMocks()).mockListApprovals();
  try {
    const [draft, pending] = await Promise.all([
      fetcher<ListConfigValuesResponse>("/api/config/values?status=draft"),
      fetcher<ListConfigValuesResponse>("/api/config/values?status=pending"),
    ]);
    return {
      values: [...draft.values, ...pending.values],
      count: draft.count + pending.count,
    };
  } catch {
    return (await loadMocks()).mockListApprovals();
  }
}

export async function getApproval(id: string): Promise<ConfigValue | null> {
  if (isMockMode()) return (await loadMocks()).mockGetApproval(id);
  try {
    return await getConfigValue(id);
  } catch {
    return (await loadMocks()).mockGetApproval(id);
  }
}

export async function approveConfigValue(
  id: string,
  body: { approved_by: string; comment: string },
): Promise<ConfigValue> {
  if (isMockMode()) return (await loadMocks()).mockApproveConfigValue(id, body);
  try {
    return await fetcher<ConfigValue>(`/api/config/values/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return (await loadMocks()).mockApproveConfigValue(id, body);
  }
}

export async function requestChangesConfigValue(
  id: string,
  body: { reviewer: string; comment: string },
): Promise<ConfigValue> {
  if (isMockMode()) return (await loadMocks()).mockRequestChangesConfigValue(id, body);
  try {
    return await fetcher<ConfigValue>(
      `/api/config/values/${encodeURIComponent(id)}/request-changes`,
      { method: "POST", body: JSON.stringify(body) },
    );
  } catch {
    return (await loadMocks()).mockRequestChangesConfigValue(id, body);
  }
}

export async function rejectConfigValue(
  id: string,
  body: { reviewer: string; comment: string },
): Promise<ConfigValue> {
  if (isMockMode()) return (await loadMocks()).mockRejectConfigValue(id, body);
  try {
    return await fetcher<ConfigValue>(`/api/config/values/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return (await loadMocks()).mockRejectConfigValue(id, body);
  }
}

export async function resolveCurrentConfigValue(
  key: string,
  jurisdictionId: string | null,
  evaluationDate: string,
): Promise<ConfigValue | null> {
  const params = new URLSearchParams({ key, evaluation_date: evaluationDate });
  if (jurisdictionId) params.set("jurisdiction_id", jurisdictionId);
  try {
    return await fetcher<ConfigValue | null>(`/api/config/resolve?${params.toString()}`);
  } catch {
    const evalTs = new Date(evaluationDate).getTime();
    const candidates = MOCK_CONFIG_VALUES.filter((v) => {
      if (v.key !== key) return false;
      if ((v.jurisdiction_id ?? null) !== (jurisdictionId ?? null)) return false;
      if (v.status !== "approved") return false;
      const from = new Date(v.effective_from).getTime();
      if (from > evalTs) return false;
      const to = v.effective_to ? new Date(v.effective_to).getTime() : null;
      if (to !== null && to < evalTs) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    return candidates[0];
  }
}

// ---- Authority chain (govops-010) ------------------------------------------

export async function getAuthorityChain(): Promise<{
  jurisdiction: Jurisdiction;
  chain: AuthorityReference[];
}> {
  try {
    return await fetcher("/api/authority-chain");
  } catch {
    return { jurisdiction: MOCK_JURISDICTION, chain: MOCK_AUTHORITY_CHAIN };
  }
}

export async function listLegalDocuments(): Promise<{ documents: LegalDocument[] }> {
  try {
    return await fetcher("/api/legal-documents");
  } catch {
    return { documents: MOCK_LEGAL_DOCUMENTS };
  }
}

export async function listRules(): Promise<{ rules: LegalRule[] }> {
  try {
    return await fetcher("/api/rules");
  } catch {
    return { rules: MOCK_LEGAL_RULES };
  }
}

// ---- Cases (govops-009) ----------------------------------------------------

export async function listCases(): Promise<{ cases: CaseListItem[] }> {
  try {
    return await fetcher<{ cases: CaseListItem[] }>("/api/cases");
  } catch {
    return { cases: MOCK_CASE_LIST };
  }
}

export async function getCase(caseId: string): Promise<CaseDetail | null> {
  try {
    return await fetcher<CaseDetail>(`/api/cases/${encodeURIComponent(caseId)}`);
  } catch {
    return mockGetCase(caseId);
  }
}

export async function evaluateCase(caseId: string): Promise<{ recommendation: Recommendation }> {
  try {
    return await fetcher(`/api/cases/${encodeURIComponent(caseId)}/evaluate`, {
      method: "POST",
    });
  } catch {
    return mockEvaluateCase(caseId);
  }
}

export interface ReviewRequestBody {
  action: ReviewActionType;
  rationale: string;
  final_outcome: DecisionOutcome | null;
}

export async function reviewCase(
  caseId: string,
  body: ReviewRequestBody,
): Promise<{ review: HumanReviewAction }> {
  try {
    return await fetcher(`/api/cases/${encodeURIComponent(caseId)}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return mockReviewCase(caseId, body);
  }
}

export async function getCaseAudit(caseId: string): Promise<AuditPackage> {
  try {
    return await fetcher<AuditPackage>(`/api/cases/${encodeURIComponent(caseId)}/audit`);
  } catch {
    return mockGetAudit(caseId);
  }
}

// ---- Case events / reassessment (govops-019) ------------------------------

export async function listCaseEvents(caseId: string): Promise<import("./types").GetEventsResponse> {
  try {
    return await fetcher(`/api/cases/${encodeURIComponent(caseId)}/events`);
  } catch {
    return mockListCaseEvents(caseId);
  }
}

export async function postCaseEvent(
  caseId: string,
  body: import("./types").CaseEventRequest,
  reevaluate = true,
): Promise<import("./types").PostEventResponse> {
  const qs = `?reevaluate=${reevaluate ? "true" : "false"}`;
  try {
    const res = await fetch(`${BASE}/api/cases/${encodeURIComponent(caseId)}/events${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = await res.json();
        detail = (j as { detail?: string }).detail ?? detail;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return (await res.json()) as import("./types").PostEventResponse;
  } catch (e) {
    if (e instanceof TypeError) {
      // Network error → fall back to mock so preview works.
      return mockPostCaseEvent(caseId, body, reevaluate);
    }
    throw e;
  }
}

// ---- Federation (govops-020) ----------------------------------------------

import type {
  FederationFetchResult,
  FederationPack,
  FederationRegistryEntry,
} from "./federation-types";

export async function listFederationRegistry(): Promise<{
  entries: FederationRegistryEntry[];
}> {
  return fetcher("/api/admin/federation/registry");
}

export async function listFederationPacks(): Promise<{ packs: FederationPack[] }> {
  return fetcher("/api/admin/federation/packs");
}

export async function fetchFederationPack(
  publisherId: string,
  opts: { dryRun: boolean; allowUnsigned: boolean },
): Promise<FederationFetchResult> {
  const qs = new URLSearchParams({
    dry_run: opts.dryRun ? "true" : "false",
    allow_unsigned: opts.allowUnsigned ? "true" : "false",
  }).toString();
  return fetcher(`/api/admin/federation/fetch/${encodeURIComponent(publisherId)}?${qs}`, {
    method: "POST",
  });
}

export async function setFederationPackEnabled(
  publisherId: string,
  enabled: boolean,
): Promise<FederationPack> {
  const op = enabled ? "enable" : "disable";
  return fetcher(`/api/admin/federation/packs/${encodeURIComponent(publisherId)}/${op}`, {
    method: "POST",
  });
}

// ---- Cross-jurisdiction program comparison (Phase F) -----------------------

import type { CheckRequest, CheckResponse, CompareProgramResponse } from "./types";

export async function compareProgram(
  programId: string,
  jurisdictions?: string[],
): Promise<CompareProgramResponse> {
  const qs = jurisdictions && jurisdictions.length > 0
    ? `?jurisdictions=${encodeURIComponent(jurisdictions.join(","))}`
    : "";
  return fetcher<CompareProgramResponse>(
    `/api/programs/${encodeURIComponent(programId)}/compare${qs}`,
  );
}

// ---- Multi-program citizen check (Phase G) ---------------------------------

export async function runCheck(req: CheckRequest): Promise<CheckResponse> {
  return fetcher<CheckResponse>("/api/check", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ---- Decision notices (govops-018) ----------------------------------------

import type { ScreenRequest as NoticeScreenRequest } from "./types";

export interface NoticeResult {
  /** Rendered HTML body (already a complete document). */
  html: string;
  /** SHA-256 the backend (or mock) computed over the html bytes. */
  sha256: string | null;
  /** True when produced by the local mock fallback. */
  preview: boolean;
}

/**
 * Compute SHA-256 hex over a UTF-8 string in the browser. Used by the mock
 * notice path so previews still surface a working integrity hash.
 */
async function sha256Hex(text: string): Promise<string | null> {
  try {
    const buf = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function mockNoticeHtml(opts: {
  title: string;
  jurisdiction: string;
  body: string;
  generatedAt: string;
}): string {
  // Self-contained, sandbox-friendly. No remote assets, no scripts.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${opts.title}</title>
  <meta name="generator" content="GovOps preview-mode notice" />
  <style>
    body{font:14px/1.5 ui-serif,Georgia,serif;max-width:42rem;margin:2rem auto;color:#0f172a;padding:0 1rem}
    h1{font-size:1.6rem;margin:0 0 .25rem 0}
    .meta{font:12px ui-monospace,monospace;color:#475569;margin-bottom:1.25rem}
    .preview{display:inline-block;background:#fef3c7;color:#854d0e;border:1px solid #fde68a;padding:.15rem .5rem;border-radius:.25rem;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:1rem}
    pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:.75rem;border-radius:.25rem;font:12px ui-monospace,monospace}
  </style>
</head>
<body>
  <span class="preview">Preview-mode notice</span>
  <h1>${opts.title}</h1>
  <p class="meta">${opts.jurisdiction} · generated ${opts.generatedAt}</p>
  <pre>${opts.body.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>
  <p class="meta">This document was produced by the local preview engine because the GovOps backend was unreachable. It is not an official decision.</p>
</body>
</html>`;
}

/**
 * Fetch a rendered decision notice. Returns the HTML body + the integrity
 * hash from `X-Notice-Sha256`. Falls back to a self-contained mock so that
 * previews and offline reviews always produce something the citizen can
 * download. The HTML is treated as an opaque document — UIs render it via
 * Blob/object URL, never `document.write`.
 */
export async function fetchDecisionNotice(
  args:
    | { mode: "case"; caseId: string; language?: string; signal?: AbortSignal }
    | {
        mode: "screen";
        screenRequest: NoticeScreenRequest;
        language?: string;
        signal?: AbortSignal;
      },
): Promise<NoticeResult> {
  const language = args.language ?? "en";
  const url =
    args.mode === "case"
      ? `${BASE}/api/cases/${encodeURIComponent(args.caseId)}/notice?lang=${encodeURIComponent(language)}`
      : `${BASE}/api/screen/notice?lang=${encodeURIComponent(language)}`;
  const init: RequestInit =
    args.mode === "case"
      ? { method: "GET", signal: args.signal }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args.screenRequest),
          signal: args.signal,
        };
  try {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`Notice request failed: ${res.status}`);
    const html = await res.text();
    const sha = res.headers.get("X-Notice-Sha256");
    return { html, sha256: sha, preview: false };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Preview fallback — mock a notice so users can still download something.
    const generatedAt = new Date().toISOString();
    const html =
      args.mode === "case"
        ? mockNoticeHtml({
            title: `Decision notice — case ${args.caseId}`,
            jurisdiction: "Preview jurisdiction",
            body: JSON.stringify({ case_id: args.caseId, language }, null, 2),
            generatedAt,
          })
        : mockNoticeHtml({
            title: "Self-screen notice",
            jurisdiction: args.screenRequest.jurisdiction_id,
            body: JSON.stringify(args.screenRequest, null, 2),
            generatedAt,
          });
    const sha256 = await sha256Hex(html);
    return { html, sha256, preview: true };
  }
}

// ---- Health & jurisdiction switch (govops-012) -----------------------------

export async function health(): Promise<HealthResponse> {
  try {
    return await fetcher<HealthResponse>("/api/health");
  } catch {
    return {
      status: "preview",
      engine: "mock",
      version: "0.0.0-preview",
      jurisdiction: MOCK_JURISDICTION.id,
      program: "Old Age Security",
      available_jurisdictions: [MOCK_JURISDICTION.id],
    };
  }
}

export async function switchJurisdiction(
  code: string,
): Promise<{ jurisdiction: string; name: string; program: string }> {
  try {
    return await fetcher(`/api/jurisdiction/${encodeURIComponent(code)}`, { method: "POST" });
  } catch {
    return { jurisdiction: code, name: code, program: "Old Age Security" };
  }
}

/**
 * Fetch the public jurisdiction metadata (program name + label) used by
 * the citizen-facing /screen route. In `VITE_USE_MOCK_API=true` mode the
 * deterministic fixture is returned without touching the network. On any
 * network/HTTP failure the caller decides what to do (the /screen loader
 * falls back to a hardcoded label table for preview parity).
 */
export async function fetchJurisdiction(code: string): Promise<JurisdictionResponse> {
  if (isMockMode()) {
    const { MOCK_JURISDICTIONS } = await import("./mock-jurisdiction");
    const hit = MOCK_JURISDICTIONS[code];
    if (!hit) throw new Error(`Unknown jurisdiction: ${code}`);
    return hit;
  }
  return fetcher<JurisdictionResponse>(`/api/jurisdiction/${encodeURIComponent(code)}`);
}

// ---- Encoding pipeline (govops-011) ---------------------------------------

const loadEncodeMocks = () => import("./mock-encode");

export interface CreateBatchRequest {
  document_title: string;
  document_citation: string;
  source_url?: string;
  input_text: string;
  method: "manual" | "llm";
  api_key?: string;
}

export interface ReviewProposalBody {
  status: ProposalStatus;
  notes?: string;
  overrides?: Partial<
    Pick<RuleProposal, "description" | "formal_expression" | "citation" | "parameters">
  >;
}

export async function listEncodingBatches(): Promise<EncodingBatchSummary[]> {
  if (isMockMode()) return (await loadEncodeMocks()).mockListEncodingBatches();
  try {
    return await fetcher<EncodingBatchSummary[]>("/api/encode/batches");
  } catch {
    return (await loadEncodeMocks()).mockListEncodingBatches();
  }
}

export async function getEncodingBatch(id: string): Promise<EncodingBatch> {
  if (isMockMode()) return (await loadEncodeMocks()).mockGetEncodingBatch(id);
  try {
    return await fetcher<EncodingBatch>(`/api/encode/batches/${encodeURIComponent(id)}`);
  } catch {
    return (await loadEncodeMocks()).mockGetEncodingBatch(id);
  }
}

export async function createEncodingBatch(body: CreateBatchRequest): Promise<EncodingBatch> {
  if (isMockMode()) return (await loadEncodeMocks()).mockCreateEncodingBatch(body);
  try {
    return await fetcher<EncodingBatch>("/api/encode/batches", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    // LLM failures auto-fall back to manual encoding via the mock.
    const fallback = body.method === "llm" ? { ...body, method: "manual" as const } : body;
    return (await loadEncodeMocks()).mockCreateEncodingBatch(fallback);
  }
}

export async function reviewProposal(
  batchId: string,
  proposalId: string,
  body: ReviewProposalBody,
): Promise<RuleProposal> {
  if (isMockMode()) return (await loadEncodeMocks()).mockReviewProposal(batchId, proposalId, body);
  try {
    return await fetcher<RuleProposal>(
      `/api/encode/batches/${encodeURIComponent(batchId)}/proposals/${encodeURIComponent(proposalId)}/review`,
      { method: "POST", body: JSON.stringify(body) },
    );
  } catch {
    return (await loadEncodeMocks()).mockReviewProposal(batchId, proposalId, body);
  }
}

export async function bulkReviewProposals(
  batchId: string,
  body: { proposal_ids: string[]; status: ProposalStatus; notes?: string },
): Promise<{ updated: RuleProposal[] }> {
  if (isMockMode()) return (await loadEncodeMocks()).mockBulkReviewProposals(batchId, body);
  try {
    return await fetcher(`/api/encode/batches/${encodeURIComponent(batchId)}/bulk-review`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    return (await loadEncodeMocks()).mockBulkReviewProposals(batchId, body);
  }
}

export async function commitBatch(batchId: string): Promise<{ committed_rule_ids: string[] }> {
  if (isMockMode()) return (await loadEncodeMocks()).mockCommitBatch(batchId);
  try {
    return await fetcher(`/api/encode/batches/${encodeURIComponent(batchId)}/commit`, {
      method: "POST",
    });
  } catch {
    return (await loadEncodeMocks()).mockCommitBatch(batchId);
  }
}

// ---- Citation impact (govops-014) ------------------------------------------

export interface ImpactQueryOpts {
  limit?: number;
  page?: number;
}

export async function impactByCitation(
  citation: string,
  opts: ImpactQueryOpts = {},
): Promise<ImpactResponse> {
  const trimmed = citation.trim();
  if (!trimmed)
    return {
      query: "",
      total: 0,
      jurisdiction_count: 0,
      results: [],
      limit: opts.limit,
      page: opts.page,
      page_count: 0,
    };
  const params = new URLSearchParams({ citation: trimmed });
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.page) params.set("page", String(opts.page));
  const qs = params.toString();
  try {
    return await fetcher<ImpactResponse>(`/api/impact?${qs}`);
  } catch {
    const { MOCK_IMPACT_RESPONSE } = await import("./mock-impact");
    return MOCK_IMPACT_RESPONSE(trimmed, opts);
  }
}

// ---- Self-screening (govops-015) -------------------------------------------

import type { ScreenRequest, ScreenResponse } from "./types";

export async function submitScreen(req: ScreenRequest): Promise<ScreenResponse> {
  try {
    return await fetcher<ScreenResponse>("/api/screen", {
      method: "POST",
      body: JSON.stringify(req),
    });
  } catch {
    const { mockScreen } = await import("./mock-screen");
    return mockScreen(req);
  }
}
