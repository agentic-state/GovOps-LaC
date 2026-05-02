/**
 * Federation (Phase 8) journeys — admin-token gated when GOVOPS_ADMIN_TOKEN
 * is set; open on demo deploys where it is unset.
 *
 * J34 — registry view
 * J35 — fetch a signed pack
 * J36 — enable a verified pack
 * J37 — disable a pack
 * J38 — fail-closed on unsigned pack
 *
 * On a fresh deploy the registry is empty (`{"publishers":[]}`); J35-J38
 * skip cleanly when there is no publisher to act on, but the endpoint
 * contract itself is still exercised (J38 verifies the unsigned-pack path
 * by sending an unknown publisher id and asserting a 404/400 — i.e.
 * fail-closed behaviour for an unverifiable input).
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

test.describe("[J34] Federation — registry view", () => {
  test("GET /api/admin/federation/registry returns a registry shape", async ({ request }) => {
    const api = await backend(request);
    const r = await api.federationRegistry();
    expect(r.status).toBe(200);
    expect(r.body).toBeTruthy();
    expect(Array.isArray(r.body!.publishers), "registry has a publishers array").toBe(true);
  });

  test("/admin/federation UI renders without an error boundary", async ({ page }) => {
    const r = await page.goto("/admin/federation");
    expect(r?.status(), "/admin/federation HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("[J35] Federation — fetch a signed pack", () => {
  test("POST /federation/fetch/{publisher} for the first registered publisher (or skip)", async ({ request }) => {
    const api = await backend(request);
    const reg = await api.federationRegistry();
    const publishers = (reg.body?.publishers ?? []) as Array<{ id?: string }>;
    test.skip(publishers.length === 0, "no publisher registered — J35 requires lawcode/REGISTRY.yaml entry");
    const id = publishers[0].id;
    if (!id) test.skip(true, "publisher missing id");
    const r = await api.federationFetch(id!);
    // Successful fetch is 200/201/202; an unverifiable signature is 4xx.
    // Both prove the endpoint is wired; 5xx means the route is broken.
    expect(r.status).toBeLessThan(500);
  });
});

test.describe("[J36] Federation — enable a pack", () => {
  test("POST /federation/packs/{pub}/enable for the first registered publisher (or skip)", async ({ request }) => {
    const api = await backend(request);
    const reg = await api.federationRegistry();
    const publishers = (reg.body?.publishers ?? []) as Array<{ id?: string }>;
    test.skip(publishers.length === 0, "no publisher registered");
    const id = publishers[0].id;
    if (!id) test.skip(true, "publisher missing id");
    const r = await api.federationEnable(id!);
    expect(r.status).toBeLessThan(500);
  });
});

test.describe("[J37] Federation — disable a pack", () => {
  test("POST /federation/packs/{pub}/disable for the first registered publisher (or skip)", async ({ request }) => {
    const api = await backend(request);
    const reg = await api.federationRegistry();
    const publishers = (reg.body?.publishers ?? []) as Array<{ id?: string }>;
    test.skip(publishers.length === 0, "no publisher registered");
    const id = publishers[0].id;
    if (!id) test.skip(true, "publisher missing id");
    const r = await api.federationDisable(id!);
    expect(r.status).toBeLessThan(500);
  });
});

test.describe("[J38] Federation — fail-closed on unknown publisher", () => {
  test("fetch with an unknown publisher id returns 4xx (not 5xx)", async ({ request }) => {
    const api = await backend(request);
    const r = await api.federationFetch("__test_bench_unknown_publisher__");
    expect(r.status, "fail-closed: unknown publisher").toBeGreaterThanOrEqual(400);
    expect(r.status, "fail-closed: not a server error").toBeLessThan(500);
  });

  test("enable with an unknown publisher id returns 4xx (not 5xx)", async ({ request }) => {
    const api = await backend(request);
    const r = await api.federationEnable("__test_bench_unknown_publisher__");
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });
});
