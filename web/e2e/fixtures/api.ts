/**
 * Helpers for talking to the GovOps backend during E2E setup/teardown.
 * Tests should never poke the DB directly — go through the API so the
 * full request path stays under test.
 *
 * Target resolution priority (first defined wins):
 *   1. E2E_BACKEND_URL — explicit override (used by local playwright.config.ts)
 *   2. TEST_BENCH_TARGET — deploy bench (HF Space, etc.); API is same-origin
 *   3. http://127.0.0.1:17765 — fallback for local Playwright runs
 */

import type { APIRequestContext } from "@playwright/test";

function resolveBackend(): string {
  if (process.env.E2E_BACKEND_URL) return process.env.E2E_BACKEND_URL.replace(/\/$/, "");
  if (process.env.TEST_BENCH_TARGET) return process.env.TEST_BENCH_TARGET.replace(/\/$/, "");
  return "http://127.0.0.1:17765";
}

const BACKEND = resolveBackend();

export function backendUrl(): string {
  return BACKEND;
}

function adminHeaders(): Record<string, string> {
  return process.env.GOVOPS_ADMIN_TOKEN
    ? { "X-Govops-Admin-Token": process.env.GOVOPS_ADMIN_TOKEN }
    : {};
}

export async function backend(request: APIRequestContext) {
  return {
    health: async () => (await request.get(`${BACKEND}/api/health`)).json(),

    listValues: async (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      const r = await request.get(`${BACKEND}/api/config/values${qs ? `?${qs}` : ""}`);
      return (await r.json()) as { values: Array<Record<string, unknown>>; count: number };
    },

    getValue: async (id: string) => {
      const r = await request.get(`${BACKEND}/api/config/values/${id}`);
      return await r.json();
    },

    versions: async (key: string, jurisdictionId?: string) => {
      const params = new URLSearchParams({ key });
      if (jurisdictionId) params.set("jurisdiction_id", jurisdictionId);
      const r = await request.get(`${BACKEND}/api/config/versions?${params}`);
      return await r.json();
    },

    createDraft: async (body: Record<string, unknown>) => {
      const r = await request.post(`${BACKEND}/api/config/values`, { data: body });
      if (r.status() !== 201)
        throw new Error(`createDraft failed: ${r.status()} ${await r.text()}`);
      return (await r.json()) as { id: string; status: string };
    },

    approve: async (id: string, approvedBy: string, comment = "") => {
      const r = await request.post(`${BACKEND}/api/config/values/${id}/approve`, {
        data: { approved_by: approvedBy, comment },
      });
      if (r.status() !== 200) throw new Error(`approve failed: ${r.status()} ${await r.text()}`);
      return await r.json();
    },

    requestChanges: async (id: string, reviewer: string, comment = "") => {
      const r = await request.post(`${BACKEND}/api/config/values/${id}/request-changes`, {
        data: { reviewer, comment },
      });
      return await r.json();
    },

    reject: async (id: string, reviewer: string, comment = "") => {
      const r = await request.post(`${BACKEND}/api/config/values/${id}/reject`, {
        data: { reviewer, comment },
      });
      return await r.json();
    },

    resolve: async (key: string, evaluation_date: string, jurisdiction_id?: string) => {
      const params = new URLSearchParams({ key, evaluation_date });
      if (jurisdiction_id) params.set("jurisdiction_id", jurisdiction_id);
      const r = await request.get(`${BACKEND}/api/config/resolve?${params}`);
      return await r.json();
    },

    // Cases
    listCases: async () => {
      const r = await request.get(`${BACKEND}/api/cases`);
      return await r.json();
    },

    getCase: async (id: string) => {
      const r = await request.get(`${BACKEND}/api/cases/${id}`);
      return await r.json();
    },

    evaluateCase: async (id: string, programs?: string[]) => {
      const r = await request.post(`${BACKEND}/api/cases/${id}/evaluate`, {
        data: programs ? { programs } : {},
      });
      return await r.json();
    },

    reviewCase: async (id: string, action: string, body: Record<string, unknown> = {}) => {
      const r = await request.post(`${BACKEND}/api/cases/${id}/review`, {
        data: { action, ...body },
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    audit: async (id: string) => {
      const r = await request.get(`${BACKEND}/api/cases/${id}/audit`);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    notice: async (id: string) => {
      const r = await request.get(`${BACKEND}/api/cases/${id}/notice`);
      const ct = r.headers()["content-type"] ?? "";
      const body = ct.includes("application/json")
        ? await r.json().catch(() => null)
        : await r.text().catch(() => "");
      return { status: r.status(), body, contentType: ct };
    },

    postEvent: async (id: string, body: Record<string, unknown>) => {
      const r = await request.post(`${BACKEND}/api/cases/${id}/events`, { data: body });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    listEvents: async (id: string) => {
      const r = await request.get(`${BACKEND}/api/cases/${id}/events`);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    // Citizen surface
    screen: async (body: Record<string, unknown>) => {
      const r = await request.post(`${BACKEND}/api/screen`, { data: body });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    check: async (body: Record<string, unknown>) => {
      const r = await request.post(`${BACKEND}/api/check`, { data: body });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    // Compare + impact
    compare: async (programId: string, jurisdictions?: string[]) => {
      const params = new URLSearchParams();
      if (jurisdictions?.length) params.set("jurisdictions", jurisdictions.join(","));
      const r = await request.get(`${BACKEND}/api/programs/${programId}/compare?${params}`);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    impact: async (citation?: string) => {
      const params = new URLSearchParams();
      if (citation) params.set("citation", citation);
      const url = `${BACKEND}/api/impact${params.toString() ? `?${params}` : ""}`;
      const r = await request.get(url);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    // Authority
    authorityChain: async () => {
      const r = await request.get(`${BACKEND}/api/authority-chain`);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    rules: async () => {
      const r = await request.get(`${BACKEND}/api/rules`);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    legalDocuments: async () => {
      const r = await request.get(`${BACKEND}/api/legal-documents`);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    jurisdiction: async (code: string) => {
      const r = await request.get(`${BACKEND}/api/jurisdiction/${code}`);
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    // Federation (admin-gated; token may be empty on demo deploys)
    federationRegistry: async () => {
      const r = await request.get(`${BACKEND}/api/admin/federation/registry`, {
        headers: adminHeaders(),
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    federationPacks: async () => {
      const r = await request.get(`${BACKEND}/api/admin/federation/packs`, {
        headers: adminHeaders(),
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    federationFetch: async (publisherId: string) => {
      const r = await request.post(`${BACKEND}/api/admin/federation/fetch/${publisherId}`, {
        headers: adminHeaders(),
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    federationEnable: async (publisherId: string) => {
      const r = await request.post(`${BACKEND}/api/admin/federation/packs/${publisherId}/enable`, {
        headers: adminHeaders(),
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    federationDisable: async (publisherId: string) => {
      const r = await request.post(`${BACKEND}/api/admin/federation/packs/${publisherId}/disable`, {
        headers: adminHeaders(),
      });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },

    // LLM proxy
    llmChat: async (body: Record<string, unknown>) => {
      const r = await request.post(`${BACKEND}/api/llm/chat`, { data: body });
      return { status: r.status(), body: await r.json().catch(() => null) };
    },
  };
}
