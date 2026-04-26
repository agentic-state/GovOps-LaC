/**
 * Helpers for talking to the GovOps backend during E2E setup/teardown.
 * Tests should never poke the DB directly — go through the API so the
 * full request path stays under test.
 */

import type { APIRequestContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:17765";

export async function backend(request: APIRequestContext) {
  return {
    health: async () => (await request.get(`${BACKEND}/api/health`)).json(),

    listValues: async (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      const r = await request.get(`${BACKEND}/api/config/values${qs ? `?${qs}` : ""}`);
      return (await r.json()) as { values: Array<Record<string, unknown>>; count: number };
    },

    createDraft: async (body: Record<string, unknown>) => {
      const r = await request.post(`${BACKEND}/api/config/values`, { data: body });
      if (r.status() !== 201) throw new Error(`createDraft failed: ${r.status()} ${await r.text()}`);
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
  };
}
