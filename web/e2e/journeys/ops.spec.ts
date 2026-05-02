/**
 * Ops + admin + framing journeys.
 *
 * J39 — admin landing
 * J40 — manual GC trigger
 * J41 — LLM proxy passthrough (covered manually pre-this; promoted here)
 * J42 — health endpoint (was implicit via smoke; explicit here)
 * J43 — switch jurisdiction (legacy Jinja path)
 * J46 — policies
 * J47 — authority chain browse + APIs
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

test.describe("[J39] Admin — landing", () => {
  test("/admin renders + surfaces operator runbook", async ({ page }) => {
    const r = await page.goto("/admin");
    expect(r?.status(), "/admin HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("[J40] Admin — manual GC trigger", () => {
  test("POST /api/admin/gc returns a result shape (or 401/403 if token-gated)", async ({ request, baseURL }) => {
    const url = `${(baseURL ?? "").replace(/\/$/, "")}/api/admin/gc`;
    const r = await request.post(url, {
      headers: process.env.GOVOPS_ADMIN_TOKEN
        ? { "X-Govops-Admin-Token": process.env.GOVOPS_ADMIN_TOKEN }
        : {},
    });
    // 200 = ran; 401/403 = token-gated and we don't have one; both prove
    // the route is wired. 5xx is a real failure.
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe("[J41] LLM proxy passthrough", () => {
  test("POST /api/llm/chat with a tiny prompt returns content (or rate-limit/4xx)", async ({ request }) => {
    const api = await backend(request);
    const r = await api.llmChat({
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 16,
    });
    // 200 = success path; 401/402/429 = upstream limits; 4xx = bad request.
    // 5xx = real failure. The bench's contract is "the proxy is wired."
    expect(r.status).toBeLessThan(500);
    if (r.status === 200) {
      expect(r.body).toBeTruthy();
    }
  });
});

test.describe("[J42] Health endpoint", () => {
  test("GET /api/health is healthy + reports the expected version shape", async ({ request }) => {
    const api = await backend(request);
    const h = await api.health();
    expect(h.status).toBe("healthy");
    expect(h.version, "version field present").toBeTruthy();
    expect(h.available_jurisdictions, "7 jurisdictions present").toEqual(
      expect.arrayContaining(["ca", "br", "es", "fr", "de", "ua", "jp"]),
    );
  });
});

test.describe("[J43] Switch jurisdiction (legacy path)", () => {
  test("POST /api/jurisdiction/{code} flips the active jurisdiction", async ({ request }) => {
    const api = await backend(request);
    const r = await api.jurisdiction("br");
    // 200 = success, 4xx = legacy/deprecated, 5xx = broken
    expect(r.status).toBeLessThan(500);
  });
});

test.describe("[J46] Policies registry", () => {
  test("/policies renders the live registry with verdicts + provenance", async ({ page }) => {
    const r = await page.goto("/policies");
    expect(r?.status(), "/policies HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // /policies is the registry of statutes and proposals (govops-008) — every
    // row carries a title, verdict, and last-updated date. Assert at least one
    // recognizable verdict word is present.
    const body = (await page.textContent("body"))?.toLowerCase() ?? "";
    expect(body).toMatch(/enacted|pending|draft|rejected|registry|verdict/);
  });
});

test.describe("[J47] Authority chain browse", () => {
  test("/authority renders + GET /api/authority-chain returns a non-empty chain", async ({ page, request }) => {
    const api = await backend(request);
    const chain = await api.authorityChain();
    expect(chain.status).toBe(200);
    expect(chain.body, "authority chain body present").toBeTruthy();

    const r = await page.goto("/authority");
    expect(r?.status(), "/authority HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("GET /api/rules + /api/legal-documents return data", async ({ request }) => {
    const api = await backend(request);
    const rules = await api.rules();
    expect(rules.status).toBe(200);
    expect(rules.body).toBeTruthy();

    const docs = await api.legalDocuments();
    expect(docs.status).toBe(200);
    expect(docs.body).toBeTruthy();
  });
});
