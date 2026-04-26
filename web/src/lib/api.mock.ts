import type { ConfigValue, CreateConfigValueRequest } from "./types";
import { MOCK_CONFIG_VALUES } from "./mock-config-values";

/**
 * Synthetic ULID-ish id for mock-created drafts. Not cryptographically sound,
 * just stable-ish and visually similar so the timeline UI renders correctly.
 */
function mockUlid(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Array.from(
    { length: 16 },
    () => "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[Math.floor(Math.random() * 32)],
  ).join("");
  return (ts + rnd).slice(0, 26);
}

/**
 * Backend `POST /api/config/values` does not yet exist. While the spec is
 * forward-looking, this mock returns a synthetic ConfigValue after a short
 * delay so the route can navigate to the (also-mocked) timeline.
 */
export async function mockCreateConfigValue(body: CreateConfigValueRequest): Promise<ConfigValue> {
  await new Promise((r) => setTimeout(r, 300));
  const now = new Date().toISOString();
  return {
    id: mockUlid(),
    domain: body.domain,
    key: body.key,
    jurisdiction_id: body.jurisdiction_id,
    value: body.value,
    value_type: body.value_type,
    effective_from: body.effective_from,
    effective_to: null,
    citation: body.citation,
    author: body.author,
    approved_by: null,
    rationale: body.rationale,
    supersedes: body.supersedes,
    status: "pending",
    language: body.language,
    created_at: now,
  };
}

/**
 * Synthetic in-memory pool of draft/pending records so the approvals route
 * has something to render in preview. Seeded from MOCK_CONFIG_VALUES (any
 * row already in `pending` status) plus two scripted scenarios that exercise
 * the side-by-side current-vs-proposed UI.
 */
function seedApprovals(): ConfigValue[] {
  const seeded = MOCK_CONFIG_VALUES.filter((v) => v.status === "draft" || v.status === "pending");
  const synthetic: ConfigValue[] = [
    {
      id: "01HRX0DRAFTOAS65MINAGEPROP",
      domain: "rule",
      key: "ca-oas.rule.age-65.min_age",
      jurisdiction_id: "ca-oas",
      value: 67,
      value_type: "number",
      effective_from: "2027-01-01T00:00:00Z",
      effective_to: null,
      citation: "Bill C-204 (proposed amendment)",
      author: "agent:policy-drafter-v2",
      approved_by: null,
      rationale:
        "Proposal to align OAS minimum age with the federal retirement-age review tabled in 2026.",
      supersedes: "01HRX0AGENTOAS65MINAGE0001",
      status: "pending",
      language: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    },
    {
      id: "01HRX0DRAFTPROMPTELIGCHK06",
      domain: "prompt",
      key: "global.prompt.eligibility.check",
      jurisdiction_id: null,
      value:
        "Determine eligibility from the inputs. Cite each rule by section, and flag any inputs that are missing or ambiguous before answering.",
      value_type: "prompt",
      effective_from: "2026-06-01T00:00:00Z",
      effective_to: null,
      citation: "Internal: prompt-library/v4-draft",
      author: "human:lead.ai",
      approved_by: null,
      rationale:
        "v4 prompt adds explicit handling for missing inputs after the March red-team review.",
      supersedes: "01HRX0PROMPTELIGCHECK00005",
      status: "draft",
      language: "en",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ];
  // Dedupe by id (in case MOCK_CONFIG_VALUES already contains a synthetic).
  const map = new Map<string, ConfigValue>();
  for (const v of [...seeded, ...synthetic]) map.set(v.id, v);
  return Array.from(map.values());
}

let approvalsPool: ConfigValue[] | null = null;
function getPool(): ConfigValue[] {
  if (!approvalsPool) approvalsPool = seedApprovals();
  return approvalsPool;
}

export async function mockListApprovals(): Promise<{
  values: ConfigValue[];
  count: number;
}> {
  await new Promise((r) => setTimeout(r, 200));
  const values = getPool();
  return { values, count: values.length };
}

export async function mockGetApproval(id: string): Promise<ConfigValue | null> {
  await new Promise((r) => setTimeout(r, 150));
  return getPool().find((v) => v.id === id) ?? null;
}

function applyAction(id: string, next: ConfigValue["status"], approver?: string): ConfigValue {
  const pool = getPool();
  const idx = pool.findIndex((v) => v.id === id);
  if (idx === -1) throw new Error(`ConfigValue ${id} not found`);
  const updated: ConfigValue = {
    ...pool[idx],
    status: next,
    approved_by: next === "approved" ? (approver ?? pool[idx].approved_by) : pool[idx].approved_by,
  };
  // Removing the row from the approvals pool reflects backend behavior:
  // approve/reject move it out of the queue; request-changes flips to draft
  // (still visible until the author edits it, but for the mock we drop it
  // so the list updates visibly).
  pool.splice(idx, 1);
  return updated;
}

export async function mockApproveConfigValue(
  id: string,
  body: { approved_by: string; comment: string },
): Promise<ConfigValue> {
  await new Promise((r) => setTimeout(r, 250));
  void body.comment;
  return applyAction(id, "approved", body.approved_by);
}

export async function mockRequestChangesConfigValue(
  id: string,
  body: { reviewer: string; comment: string },
): Promise<ConfigValue> {
  await new Promise((r) => setTimeout(r, 250));
  void body;
  return applyAction(id, "draft");
}

export async function mockRejectConfigValue(
  id: string,
  body: { reviewer: string; comment: string },
): Promise<ConfigValue> {
  await new Promise((r) => setTimeout(r, 250));
  void body;
  return applyAction(id, "rejected");
}

// ---- Fixture batches (govops-008) ------------------------------------------

import type { FixtureBatchSummary, FixtureRunResult } from "./api";

const MOCK_FIXTURES: FixtureBatchSummary[] = [
  {
    id: "fxt_oas_2025_amendments",
    jurisdiction_id: "ca-oas",
    document_title: "OAS Act — 2025 amendments excerpt",
    document_citation: "OAS Act, ss. 3–8 (rev. 2025)",
    text_length: 4821,
    created_at: "2026-02-01T09:30:00Z",
  },
  {
    id: "fxt_us_ssa_eligibility",
    jurisdiction_id: "us-fed",
    document_title: "SSA Title II — early retirement eligibility",
    document_citation: "42 U.S.C. § 402(q)–(r)",
    text_length: 6310,
    created_at: "2026-02-08T14:11:00Z",
  },
  {
    id: "fxt_uk_state_pension",
    jurisdiction_id: "uk-gov",
    document_title: "Pensions Act 2014 — qualifying years schedule",
    document_citation: "Pensions Act 2014, Sch. 1",
    text_length: 3240,
    created_at: "2026-02-12T08:00:00Z",
  },
];

export async function mockListFixtures(): Promise<FixtureBatchSummary[]> {
  await new Promise((r) => setTimeout(r, 200));
  return MOCK_FIXTURES;
}

/**
 * Synthesize a plausible extraction result. The proposal count varies a bit
 * based on the prompt length so successive runs feel meaningful when comparing.
 */
export async function mockRunFixtureWithPrompt(
  fixtureId: string,
  body: { prompt_text: string; prompt_key: string },
): Promise<FixtureRunResult> {
  await new Promise((r) => setTimeout(r, 900));
  const fxt = MOCK_FIXTURES.find((f) => f.id === fixtureId);
  if (!fxt) throw new Error(`Fixture ${fixtureId} not found`);
  const len = body.prompt_text.length;
  const base =
    fxt.id === "fxt_oas_2025_amendments" ? 3 : fxt.id === "fxt_us_ssa_eligibility" ? 4 : 2;
  const variance = (len % 3) - 1; // -1, 0, +1
  const count = Math.max(1, base + variance);
  const proposals = Array.from({ length: count }, (_, i) => ({
    rule_type: i % 2 === 0 ? "eligibility.min_age" : "eligibility.residency_years",
    description:
      i % 2 === 0
        ? `Minimum qualifying age clause #${i + 1} extracted from ${fxt.document_title}.`
        : `Residency requirement clause #${i + 1} extracted from ${fxt.document_title}.`,
    citation: `${fxt.document_citation} ¶${i + 1}`,
    parameters:
      i % 2 === 0
        ? { jurisdiction: fxt.jurisdiction_id, min_age: 60 + ((len + i) % 8) }
        : { jurisdiction: fxt.jurisdiction_id, residency_years: 10 + ((len + i) % 5) },
  }));
  return {
    fixture_id: fixtureId,
    prompt_key: body.prompt_key,
    proposals_count: count,
    proposals,
    raw_response: `# Mock LLM response\n\nUsing prompt key \`${body.prompt_key}\` (${len} chars) against ${fxt.document_title}.\n\n${proposals
      .map((p, i) => `${i + 1}. ${p.description}\n   citation: ${p.citation}`)
      .join("\n")}`,
    latency_ms: 700 + (len % 600),
    token_count: 180 + Math.floor(len / 4),
  };
}
