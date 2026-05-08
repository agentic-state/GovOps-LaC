/**
 * Mutation flow journeys (post-2026-05-07 manual-test bug class).
 *
 * Drives the actual UI buttons, not only the API. The bench/API tests pass
 * even when the browser-side TanStack-router cache holds a stale list, so a
 * UI-driven test is the only way to catch the regression. Three contracts
 * under test:
 *
 *   J47 — after approving via the UI, the queue list refetches and the
 *         record is gone. The "find one, fix the class" coverage anchor.
 *   J48 — landing on /config/approvals/{id} for an already-approved record
 *         renders the resolved-notice banner instead of the action panel.
 *         Catches the "approve a second time" path that 409'd in bug-2.
 *   J49 — `fetcher` has a 15s default timeout. We do not exercise a hung
 *         backend in CI (would slow the run); covered by code review of
 *         FETCHER_DEFAULT_TIMEOUT_MS plus AbortSignal.timeout in api.ts.
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

test.describe("Mutation flow — list invalidation + status-gated detail", () => {
  test("[J47] approving via the UI removes the record from the queue without a hard reload", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.mutations.approve-target.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 65,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "approve-flow invalidation test",
    });

    // Locate the draft via its detail-page link href (canonical identifier
    // in the DOM; ApprovalRow renders the key + status, not the id).
    const draftLink = page.locator(`a[href*="/config/approvals/${draft.id}"]`);

    await page.goto("/config/approvals");
    await expect(page.getByRole("heading", { name: /pending approvals/i })).toBeVisible();
    await expect(draftLink).toHaveCount(1, { timeout: 10_000 });

    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /^decision$/i })).toBeVisible();

    // Drive the UI: expand if collapsed, fill the comment, click Approve,
    // then confirm.
    const expand = page.getByRole("button", { name: /expand/i });
    if (await expand.isVisible().catch(() => false)) {
      await expand.click();
    }
    await page.getByLabel(/comment/i).fill("approved by e2e mutation test");
    await page.getByRole("button", { name: /^approve$/i }).first().click();
    await page.getByRole("button", { name: /confirm approval/i }).click();

    // Mutation completes -> router invalidate -> nav -> queue refetches.
    await page.waitForURL("**/config/approvals", { timeout: 10_000 });
    // The draft link must be gone from the list (this is the load-bearing
    // invalidation assertion — it would fail without router.invalidate()).
    await expect(draftLink).toHaveCount(0, { timeout: 10_000 });
  });

  test("[J48] visiting /config/approvals/{id} for an already-approved record shows the resolved notice, not action buttons", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.mutations.resolved-notice.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 65,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-other-author",
      rationale: "resolved-notice gating test",
    });
    await api.approve(draft.id, "e2e-reviewer", "");

    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /already approved/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^decision$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^approve$/i })).toHaveCount(0);
  });
});
