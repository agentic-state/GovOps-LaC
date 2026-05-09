/**
 * Post-mutation a11y -- demonstrates the helper pattern from
 * `e2e/fixtures/a11y.ts`.
 *
 * Today `a11y.spec.ts` runs axe on every route at idle load. That
 * misses the most common a11y bugs: result toasts that don't announce,
 * focus dropped after a redirect, list updates with no live-region
 * cue. This spec runs axe AFTER mutations resolve, on the post-action
 * page state, on a load-bearing mutation surface (approve a draft).
 *
 * Pattern is intentionally narrow here: one canonical mutation flow.
 * Roll out to other mutation specs in subsequent passes (the helper
 * module makes it a 2-line addition per spec).
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";
import { expectNoCriticalAxeViolations } from "../fixtures/a11y";

test.describe("[a11y/post-mutation] approve-draft flow", () => {
  test("approving a draft leaves the post-redirect page with zero critical axe violations", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.a11y-post-mutation.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 65,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-a11y-author",
      rationale: "post-mutation a11y check",
    });

    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /^decision$/i })).toBeVisible({
      timeout: 10_000,
    });

    const expand = page.getByRole("button", { name: /expand/i });
    if (await expand.isVisible().catch(() => false)) {
      await expand.click();
    }
    await page.getByLabel(/comment/i).fill("a11y post-mutation check");
    await page.getByRole("button", { name: /^approve$/i }).first().click();
    await page.getByRole("button", { name: /confirm approval/i }).click();

    await page.waitForURL("**/config/approvals", { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    // Post-mutation invariant: post-redirect page state has zero
    // critical axe violations, even with toast / focus changes mid-flight.
    //
    // Toast-pattern assertion intentionally not used here -- sonner
    // toasts auto-dismiss faster than `expect(...).toBeVisible()` can
    // race them on the post-redirect page, and the toast lifecycle is
    // a separate concern from the a11y of the resolved page state.
    await expectNoCriticalAxeViolations(page, "approve-draft post-redirect");
  });
});

test.describe("[a11y/post-mutation] page-load axe scan on mutation surfaces", () => {
  // Catch the slice that idle-load a11y might miss: surfaces that
  // RENDER mutation forms have unique a11y considerations (focus
  // traps, dialog roles, button-disabled-state announcements).
  const MUTATION_PAGES = [
    { path: "/config/approvals", label: "approvals queue" },
    { path: "/config/draft", label: "draft form" },
    { path: "/admin/federation", label: "federation admin" },
  ];

  for (const p of MUTATION_PAGES) {
    test(`${p.path} -- zero critical axe violations on idle load`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState("networkidle");
      await expectNoCriticalAxeViolations(page, p.label);
    });
  }
});
