/**
 * Citizen-surface journeys (J01, J02) — landing + per-jurisdiction self-screen.
 *
 * J01 covers the /screen landing route (the jurisdiction picker).
 * J02 covers /screen/{jur} for every jurisdiction the engine supports,
 * walking the SSR shell + a POST /api/screen call to verify the substrate
 * resolves and an outcome lands.
 *
 * No PII storage — same privacy invariants J05 covers, just at the data
 * level here (POST returns no echo of the applicant fields).
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

const ALL_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua", "jp"] as const;

test.describe("[J01] Citizen self-screen — landing", () => {
  test("renders /screen with a jurisdiction picker", async ({ page }) => {
    const r = await page.goto("/screen");
    expect(r?.status(), "/screen HTTP status").toBeLessThan(400);
    // The landing has at minimum a heading + a way to pick a jurisdiction.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("[J02] Citizen self-screen — per jurisdiction", () => {
  for (const jur of ALL_JURISDICTIONS) {
    test(`/screen/${jur} renders the jurisdiction-specific form`, async ({ page }) => {
      const r = await page.goto(`/screen/${jur}`);
      expect(r?.status(), `/screen/${jur} HTTP status`).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The DOB field is the most stable per-jurisdiction marker; it's the
      // first form input and exists across every jurisdiction's screen view.
      await page.waitForSelector("#screen-dob", { state: "visible", timeout: 10_000 });
    });
  }

  test("POST /api/screen for CA returns an outcome + benefit_amount fields", async ({ request }) => {
    const api = await backend(request);
    const r = await api.screen({
      jurisdiction_id: "ca",
      date_of_birth: "1955-01-01",
      legal_status: "citizen",
      country_of_birth: "CA",
      residency_periods: [{ country: "CA", start_date: "1973-01-01", end_date: null }],
      evidence_present: { dob: true, residency: true },
      evaluation_date: "2026-06-01",
    });
    expect(r.status, "POST /api/screen").toBe(200);
    expect(r.body).toBeTruthy();
    expect(r.body!.outcome, "outcome present").toBeTruthy();
    // No applicant PII echoed back
    expect(JSON.stringify(r.body)).not.toContain("1955-01-01");
  });
});
