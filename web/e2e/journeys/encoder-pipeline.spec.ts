/**
 * Encoder persona -- UI-driven coverage of the encoding pipeline.
 *
 * LO-002 (V1 block) RESOLVED in L8.2: the JSON endpoints for the encoder
 * pipeline now exist on the FastAPI backend (POST /api/encode/batches,
 * GET /api/encode/batches, GET /api/encode/batches/{id},
 * POST /api/encode/batches/{id}/proposals/{pid}/review,
 * POST /api/encode/batches/{id}/bulk-review,
 * POST /api/encode/batches/{id}/commit). The React frontend now persists
 * server-side; a page reload preserves state.
 *
 *   E02 + E10 New batch via /encode/new + source-text disclosure -- active
 *   E03 LLM mode -- still skipped (needs LLM-stub fixture; PLAN section 11)
 *   E04 Approve a single proposal -- active
 *   E05 Reject a single proposal -- active (post-LO-002)
 *   E06 Modify a proposal -- active (post-LO-002)
 *   E07/E08 Bulk approve/reject -- still fixme (manual mode produces 1
 *     proposal; multi-proposal fixture needed -- separate from LO-002)
 *   E09 Filter by status chip -- still fixme (needs >=2 proposals)
 *   E11 Commit a batch -- active (post-LO-002)
 */

import { test, expect } from "@playwright/test";

const SAMPLE_STATUTORY_TEXT = `An Act respecting the Old Age Security framework.

Section 3.
A person who has attained sixty-five years of age is eligible to receive
a monthly pension.`;

/**
 * Drive the IngestForm. Returns the new batch id parsed from the URL.
 * Caller is responsible for staying on the same page session for any
 * subsequent assertions (LO-002).
 */
async function submitNewManualBatch(
  page: import("@playwright/test").Page,
  marker: string,
): Promise<string> {
  await page.goto("/encode/new");
  await expect(page.getByRole("heading", { name: /new extraction/i })).toBeVisible();

  await page.getByLabel(/document title/i).fill(`E2E encoder ${marker}`);
  await page.getByLabel(/document citation/i).fill(`e2e.encoder.${marker}`);
  await page.getByRole("radio", { name: /^manual$/i }).check();
  await page.getByLabel(/statutory text/i).fill(SAMPLE_STATUTORY_TEXT);

  await page.getByRole("button", { name: /extract proposals/i }).click();

  await page.waitForURL(/\/encode\/[^/]+$/, { timeout: 15_000 });
  return new URL(page.url()).pathname.split("/").pop()!;
}

test.describe("[E02 + E10] New batch via UI + source-text toggle", () => {
  test("manual-mode submit redirects to /encode/$batchId; the source-text disclosure opens and closes", async ({
    page,
  }) => {
    const batchId = await submitNewManualBatch(page, `e02-e10.${Date.now()}`);
    expect(batchId.length).toBeGreaterThan(0);

    // Review heading visible.
    await expect(page.getByRole("heading", { name: /review proposals/i })).toBeVisible();

    // E10: source-text disclosure -- aria-expanded contract.
    const toggle = page.getByRole("button", { name: /^source text$/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(SAMPLE_STATUTORY_TEXT.slice(0, 40))).toBeVisible({
      timeout: 5_000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("[E04] Approve a single proposal via UI ProposalCard", () => {
  test("submit a manual batch, approve the first proposal, verify status pill flips", async ({
    page,
  }) => {
    await submitNewManualBatch(page, `e04.${Date.now()}`);
    await expect(page.getByRole("heading", { name: /review proposals/i })).toBeVisible();

    const firstCard = page.getByRole("article").first();
    // Sanity: the first card starts in 'Pending' state.
    await expect(firstCard.getByText(/^Pending$/i).first()).toBeVisible({ timeout: 5_000 });

    await firstCard.getByRole("button", { name: /^approve$/i }).click();
    await expect(firstCard.getByText(/^Approved$/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("[E03] LLM-mode ingest", () => {
  test.skip("deferred -- requires LLM provider key on test target (PLAN section 11)", () => {
    // Will land in L8 once an LLM-stub fixture is wired.
  });
});

test.describe("[E05] Reject a single proposal via UI", () => {
  test("submit a manual batch, reject the first proposal, verify status pill flips", async ({
    page,
  }) => {
    await submitNewManualBatch(page, `e05.${Date.now()}`);
    const firstCard = page.getByRole("article").first();
    await firstCard.getByRole("button", { name: /^reject$/i }).click();
    await expect(firstCard.getByText(/^Rejected$/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("[E06] Modify a proposal via UI", () => {
  test("submit a manual batch, modify the first proposal, verify it lands as Modified", async ({
    page,
  }) => {
    await submitNewManualBatch(page, `e06.${Date.now()}`);
    const firstCard = page.getByRole("article").first();
    await firstCard.getByRole("button", { name: /^modify$/i }).click();
    await expect(page.getByRole("heading", { name: /modify proposal/i })).toBeVisible();
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(firstCard.getByText(/^Modified$/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("[E07] Bulk-approve via BulkActionBar", () => {
  test.fixme("manual mode produces 1 proposal so multi-select is impossible -- needs LO-013 multi-proposal fixture", () => {
    // After a fixture / extraction mode produces multi-proposal manual
    // batches, drive the BulkActionBar selection + approve and unfixme.
  });
});

test.describe("[E08] Bulk-reject via BulkActionBar", () => {
  test.fixme("manual mode produces 1 proposal -- needs LO-013 multi-proposal fixture", () => {
    // Same gating as E07.
  });
});

test.describe("[E09] Filter proposals by status chip", () => {
  test.fixme("needs >=2 proposals to verify narrowing -- LO-013 multi-proposal fixture", () => {
    // Same gating as E07.
  });
});

test.describe("[E11] Commit a batch -- approved proposals land on /authority", () => {
  test("approve a proposal, commit, and verify the redirect lands on /authority", async ({
    page,
  }) => {
    await submitNewManualBatch(page, `e11.${Date.now()}`);
    const firstCard = page.getByRole("article").first();
    await firstCard.getByRole("button", { name: /^approve$/i }).click();
    await expect(firstCard.getByText(/^Approved$/i).first()).toBeVisible({ timeout: 5_000 });

    // The Commit-trigger button (in the page header) AND the confirm
    // button (inside the dialog) both render the i18n'd "Commit to
    // engine" label per CommitConfirmDialog.tsx. Disambiguate by
    // scoping the second click to the dialog role.
    await page.getByRole("button", { name: /commit to engine/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole("button", { name: /commit to engine/i }).click();

    await page.waitForURL(/\/authority/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
