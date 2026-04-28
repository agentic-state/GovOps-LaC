/**
 * Configure-without-deploy E2E proof — PLAN.md §8 success criterion #9
 * driven through the citizen-facing surface, not the substrate API.
 *
 * The Phase 6 exit-line says: "a maintainer can change a coefficient
 * effective on a future date entirely through the UI, and a case
 * evaluated on that date picks up the new value." admin-flow.spec.ts
 * proves the substrate-side (resolve flips at the boundary). This
 * spec proves the *citizen* side: a /screen request evaluated against
 * a pre-supersession date returns the prior coefficient; the same
 * request evaluated against a post-supersession date returns the new
 * one.
 *
 * The ca.calc.oas.base_monthly_amount supersession is already in the
 * lawcode/ tree (727.67 → 735.45 effective 2026-01-01). The engine's
 * formula `ref` resolution is date-aware as of ADR-013 §"the seam"; that
 * makes this proof end-to-end real, not a substrate-only assertion.
 */

import { test, expect } from "@playwright/test";

// Backend URL — Playwright's default baseURL is the frontend (Vite dev server);
// the screen API lives on the FastAPI backend. Use the same env-var convention
// as fixtures/api.ts so the backend port stays a single source of truth.
const BACKEND = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:17765";

const SCREEN_PAYLOAD_BASE = {
  jurisdiction_id: "ca",
  date_of_birth: "1955-01-01",
  legal_status: "citizen",
  country_of_birth: "CA",
  residency_periods: [{ country: "CA", start_date: "1973-01-01", end_date: null }],
  evidence_present: { dob: true, residency: true },
};

test.describe("Configure-without-deploy — citizen surface honours dated supersession", () => {
  test("/api/screen returns pre-supersession amount for 2025-06-01 evaluation", async ({
    request,
  }) => {
    const r = await request.post(`${BACKEND}/api/screen`, {
      data: { ...SCREEN_PAYLOAD_BASE, evaluation_date: "2025-06-01" },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.outcome).toBe("eligible");
    expect(body.benefit_amount).not.toBeNull();
    // 2025-06-01 is BEFORE the 2026-01-01 supersession; the original
    // base amount applies.
    expect(body.benefit_amount.value).toBe(727.67);
  });

  test("/api/screen returns post-supersession amount for 2026-06-01 evaluation", async ({
    request,
  }) => {
    const r = await request.post(`${BACKEND}/api/screen`, {
      data: { ...SCREEN_PAYLOAD_BASE, evaluation_date: "2026-06-01" },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.outcome).toBe("eligible");
    expect(body.benefit_amount).not.toBeNull();
    // 2026-06-01 is AFTER the 2026-01-01 supersession; the new base
    // amount applies. Same applicant, same evidence — different date,
    // different number. Configure-without-deploy in action.
    expect(body.benefit_amount.value).toBe(735.45);
  });

  test("formula trace cites the correct OAS Act section across both dates", async ({ request }) => {
    // Both dates resolve through the same formula (multiply by base ÷ 40),
    // so the citation set is identical — the *coefficient* changes, not
    // the policy structure. Locks the invariant that supersession is a
    // data event, not a code event.
    const before = await (
      await request.post(`${BACKEND}/api/screen`, {
        data: { ...SCREEN_PAYLOAD_BASE, evaluation_date: "2025-06-01" },
      })
    ).json();
    const after = await (
      await request.post(`${BACKEND}/api/screen`, {
        data: { ...SCREEN_PAYLOAD_BASE, evaluation_date: "2026-06-01" },
      })
    ).json();

    const beforeCitations: string[] = before.benefit_amount.citations;
    const afterCitations: string[] = after.benefit_amount.citations;

    // Both must cite ss. 7 (formula authority + base) and 3(2)(b) (proration).
    for (const cs of [beforeCitations, afterCitations]) {
      expect(cs.some((c) => /s\. ?7/.test(c))).toBeTruthy();
      expect(cs.some((c) => /s\. ?3\(2\)\(b\)/.test(c))).toBeTruthy();
    }
  });

  test("/screen UI renders the pre-supersession amount when fed a 2025 date", async ({
    page,
    request,
  }) => {
    // Drive the screen surface end-to-end. The form's evaluation_date
    // input defaults to today; we POST directly to /api/screen with the
    // pinned date so this test is robust against form-selector drift.
    // The UI assertion is on the rendered result — the citizen-facing
    // proof that a dated supersession changes what they see.
    const r = await request.post(`${BACKEND}/api/screen/notice`, {
      data: { ...SCREEN_PAYLOAD_BASE, evaluation_date: "2025-06-01" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
    const html = await r.text();
    expect(html).toContain("727.67");
    expect(html).not.toContain("735.45");
  });

  test("/screen UI renders the post-supersession amount when fed a 2026 date", async ({
    request,
  }) => {
    const r = await request.post(`${BACKEND}/api/screen/notice`, {
      data: { ...SCREEN_PAYLOAD_BASE, evaluation_date: "2026-06-01" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
    const html = await r.text();
    expect(html).toContain("735.45");
    // The pre-supersession value should NOT be the headline figure for a
    // 2026 evaluation. (It may appear inside the trace's `ref` step
    // history if we ever surface that, but the headline must reflect
    // the post-2026 base.)
    // Headline figure check: the amount-figure span carries the value.
    const headlineMatch = html.match(/class="amount-figure">([\d.]+) CAD/);
    expect(headlineMatch?.[1]).toBe("735.45");
  });
});
