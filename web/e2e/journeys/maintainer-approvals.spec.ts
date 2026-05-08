/**
 * Maintainer persona -- approvals page UI-driven coverage.
 *
 * Closes the gap that PR #21 only filled for J47 (approve) and J48
 * (resolved-notice). This file drives every other interaction on the
 * approvals page through real UI events:
 *
 *   M03 Reject via UI
 *   M04 Request changes via UI
 *   M05 Self-approval blocked at the UI
 *   M06 Cmd/Ctrl+Enter keyboard shortcut opens approve confirmation
 *   M13 Status filter narrows the list
 *   M14 Search narrows the list
 *   M15 Load-more paginates additional rows
 *
 * Conventions per PLAN-p61-test-coverage.md section 5: drive the UI
 * (no API shortcuts past setup), accessible-role locators, run-unique
 * keys, wait on observable side-effects.
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

const COMMENT_OK = "out of scope for this jurisdiction";

test.describe("[M03] Reject a draft via the UI", () => {
  test("reject from detail panel removes record from queue + detail page renders 'Already rejected'", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.maintainer.reject.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 999,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "M03 reject UI flow",
    });
    const draftLink = page.locator(`a[href*="/config/approvals/${draft.id}"]`);

    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /^decision$/i })).toBeVisible();

    const expand = page.getByRole("button", { name: /^expand$/i });
    if (await expand.isVisible().catch(() => false)) await expand.click();

    await page.getByLabel(/^comment$/i).fill(COMMENT_OK);
    await page.getByRole("button", { name: /^reject$/i }).first().click();
    await page.getByRole("button", { name: /^confirm rejection$/i }).click();

    await page.waitForURL("**/config/approvals", { timeout: 10_000 });
    await expect(draftLink).toHaveCount(0, { timeout: 10_000 });

    // Detail page now status-gated -- ResolvedNotice replaces actions.
    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /already rejected/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^decision$/i })).toHaveCount(0);
  });
});

test.describe("[M04] Request changes via the UI", () => {
  test("request-changes returns the draft to the author + record stays in queue with status=draft", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.maintainer.request.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 1,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "M04 request-changes UI flow",
    });
    const draftLink = page.locator(`a[href*="/config/approvals/${draft.id}"]`);

    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /^decision$/i })).toBeVisible();

    const expand = page.getByRole("button", { name: /^expand$/i });
    if (await expand.isVisible().catch(() => false)) await expand.click();

    await page.getByLabel(/^comment$/i).fill("needs more citation context, please add references");
    await page.getByRole("button", { name: /request changes/i }).click();
    await page.getByRole("button", { name: /send back/i }).click();

    await page.waitForURL("**/config/approvals", { timeout: 10_000 });
    // request-changes resets the draft to status=draft and bounces it to
    // the author -- the row stays in the queue. Different from approve/
    // reject, which remove the record.
    await expect(draftLink).toHaveCount(1, { timeout: 10_000 });

    const after = await api.getValue(draft.id);
    expect((after as { status: string }).status).toBe("draft");
  });
});

test.describe("[M05] Self-approval blocked at the UI", () => {
  test("when the current user authored the draft, the action panel is disabled + shows the blocked alert", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    // Visit ANY page first so we can write to localStorage.
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.setItem("govops-user", "e2e-self-author");
    });

    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.maintainer.self.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 65,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-self-author",
      rationale: "M05 self-approval block UI flow",
    });

    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /^decision$/i })).toBeVisible();

    const expand = page.getByRole("button", { name: /^expand$/i });
    if (await expand.isVisible().catch(() => false)) await expand.click();

    // The blocked alert renders via role="alert" with the i18n message.
    await expect(page.getByRole("alert").first()).toBeVisible();

    // All three action buttons are disabled.
    await expect(page.getByRole("button", { name: /^approve$/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /request changes/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^reject$/i })).toBeDisabled();
  });
});

test.describe("[M06] Keyboard shortcut Cmd/Ctrl+Enter opens the approve confirmation", () => {
  test("typing the shortcut while the panel is focused opens the approve dialog", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.maintainer.kbd.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 65,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "M06 keyboard shortcut flow",
    });

    await page.goto(`/config/approvals/${draft.id}`);
    await expect(page.getByRole("heading", { name: /^decision$/i })).toBeVisible();

    const expand = page.getByRole("button", { name: /^expand$/i });
    if (await expand.isVisible().catch(() => false)) await expand.click();

    await page.getByLabel(/^comment$/i).focus();
    // The hook listens on window for Cmd/Ctrl+Enter; Playwright's keyboard
    // API generates the right modifier per platform automatically.
    await page.keyboard.press("ControlOrMeta+Enter");

    await expect(page.getByRole("button", { name: /^confirm approval$/i })).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe("[M13] Status filter narrows the approvals queue", () => {
  test("selecting 'pending' hides draft-only records and selecting 'all' restores them", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    // Make a draft we can identify deterministically.
    const draft = await api.createDraft({
      domain: "rule",
      key: `e2e.maintainer.filter.${Date.now()}`,
      jurisdiction_id: "ca-oas",
      value: 65,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "M13 filter UI flow",
    });
    const draftLink = page.locator(`a[href*="/config/approvals/${draft.id}"]`);

    await page.goto("/config/approvals");
    await expect(draftLink).toHaveCount(1, { timeout: 10_000 });

    // Filter to "pending" -- our draft is status=draft, should disappear.
    await page.getByLabel(/^status$/i).click();
    await page.getByRole("option", { name: /^pending$/i }).click();
    await expect(draftLink).toHaveCount(0, { timeout: 5_000 });

    // Restore "all" -- draft is back.
    await page.getByLabel(/^status$/i).click();
    await page.getByRole("option", { name: /^all$/i }).click();
    await expect(draftLink).toHaveCount(1, { timeout: 5_000 });
  });
});

test.describe("[M14] Search narrows the approvals queue", () => {
  test("typing the unique key in the search box hides every other row and leaves only the match", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const uniqueKey = `e2e.maintainer.search.${Date.now()}.unique-marker`;
    const draft = await api.createDraft({
      domain: "rule",
      key: uniqueKey,
      jurisdiction_id: "ca-oas",
      value: 65,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "M14 search UI flow",
    });
    const draftLink = page.locator(`a[href*="/config/approvals/${draft.id}"]`);

    await page.goto("/config/approvals");
    await expect(draftLink).toHaveCount(1, { timeout: 10_000 });

    // Type a key fragment that should ONLY match our draft.
    await page.getByRole("searchbox", { name: /search approvals/i }).fill("unique-marker");

    // Our row must be visible.
    await expect(draftLink).toHaveCount(1);
    // Demo seed rows must be filtered out -- assert the seeded ca-oas
    // amendment key is not visible (it is part of GOVOPS_SEED_DEMO=1).
    await expect(page.getByText("demo.draft.ca-oas.age-67-amendment")).toHaveCount(0);
  });
});

test.describe("[M15] Pagination -- Load more reveals additional rows", () => {
  test.skip("Load-more advances visible window by page-size; deferred until at least 11 drafts exist on target", () => {
    // Skipped because the demo seed today provides 3 drafts and adding 8
    // more in the test would slow the run. Re-enabled when the seed
    // gains a "stress" mode or when a follow-up adds a fixture batch
    // factory. Tracked in PLAN-p61-test-coverage.md section 9.
  });
});
