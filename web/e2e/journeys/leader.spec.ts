/**
 * Government-leader surface — cross-jurisdiction read-only journeys.
 *
 * J18 — compare OAS across all 7 jurisdictions (companion to compare.spec.ts
 *       which covers EI in detail).
 * J19 — citation impact across jurisdictions; renders the /impact page.
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

test.describe("[J18] Compare OAS across jurisdictions", () => {
  test("GET /api/programs/oas/compare returns rows for all 7 jurisdictions", async ({ request }) => {
    const api = await backend(request);
    const r = await api.compare("oas");
    expect(r.status).toBe(200);
    expect(r.body).toBeTruthy();
    // Body shape: { rules: [...], jurisdictions: [...] } or similar; assert
    // the leniently-named jurisdictions list contains all 7.
    const jurs = (r.body!.jurisdictions ?? r.body!.columns ?? []).map((j: { id?: string; code?: string } | string) =>
      typeof j === "string" ? j : j.id ?? j.code ?? "",
    );
    for (const expected of ["ca", "br", "es", "fr", "de", "ua", "jp"]) {
      expect(jurs.map((j: string) => j.toLowerCase())).toContain(expected);
    }
  });

  test("/compare/oas renders the comparison table", async ({ page }) => {
    const r = await page.goto("/compare/oas");
    expect(r?.status(), "/compare/oas HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("compare-table")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("[J19] Citation impact across jurisdictions", () => {
  test("GET /api/impact?citation=... returns an impact set", async ({ request }) => {
    const api = await backend(request);
    // The endpoint requires a citation query param. Use the OAS Act s. 7 (the
    // base benefit-amount authority) — present in every v2+ deploy.
    const r = await api.impact("OAS Act, s. 7");
    expect(r.status).toBe(200);
    expect(r.body).toBeTruthy();
  });

  test("GET /api/impact without citation returns 400 (documented contract)", async ({ request }) => {
    const api = await backend(request);
    const r = await api.impact();
    expect(r.status).toBe(400);
  });

  test("/impact renders without an error boundary", async ({ page }) => {
    const r = await page.goto("/impact");
    expect(r?.status(), "/impact HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
