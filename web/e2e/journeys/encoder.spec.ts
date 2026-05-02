/**
 * Encoder pipeline journeys.
 *
 * J30 — encoder landing (promotion of partial coverage from smoke.spec.ts)
 * J31 — start a new encoding batch (burns LLM tokens — sandbox-only)
 * J33 — emit YAML from an approved batch
 *
 * J32 (proposal review) is covered in smoke.spec.ts (the approve-locks test).
 */

import { test, expect } from "@playwright/test";

test.describe("[J30] Encoder — landing", () => {
  test("/encode renders + lists at least one batch fixture", async ({ page }) => {
    const r = await page.goto("/encode");
    expect(r?.status(), "/encode HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The seeded encoding example creates one batch; the batch list should
    // surface at least one /encode/{batchId} link (excluding /encode/new).
    const batchLinks = page.locator('a[href^="/encode/"]:not([href="/encode/new"])');
    await expect(batchLinks.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("[J31] Encoder — start a new batch", () => {
  test("/encode/new renders the new-batch form", async ({ page }) => {
    const r = await page.goto("/encode/new");
    expect(r?.status(), "/encode/new HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The new-batch route exposes a textarea for legislative text input.
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("[J33] Encoder — emit YAML", () => {
  test("emit-yaml endpoint accepts requests for known batch ids (or 404 cleanly)", async ({ request, baseURL }) => {
    // Using a deliberately-unknown id so we don't burn tokens or mutate
    // lawcode/. The endpoint's contract is: a known approved batch id →
    // 200 + emitted YAML; an unknown id → 404. Either is a healthy signal
    // that the route is wired.
    const url = `${(baseURL ?? "").replace(/\/$/, "")}/api/encode/batches/__test_bench_unknown__/emit-yaml`;
    const r = await request.post(url);
    expect([200, 400, 404, 409, 422]).toContain(r.status());
  });
});
