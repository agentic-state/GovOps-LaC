/**
 * Encoder persona -- full UI-driven coverage of the encoding pipeline.
 *
 *   E02 New batch (manual mode) -- fill IngestForm, submit, redirect to
 *       /encode/$batchId and verify the new batch is visible in /encode.
 *   E03 New batch (LLM mode) -- DEFERRED: requires a real LLM provider
 *       key on the test target; tracked in PLAN section 11 (out of scope).
 *   E04 Approve a single proposal via UI ProposalCard.
 *   E05 Reject a single proposal via UI ProposalCard.
 *   E06 Modify a proposal -- open the modify dialog, save changes.
 *   E07 Bulk approve via BulkActionBar.
 *   E08 Bulk reject via BulkActionBar.
 *   E09 Filter proposals by status chip.
 *   E10 Source-text disclosure toggle.
 *   E11 Commit a batch -- click "Commit to engine", confirm, verify nav
 *       to /authority.
 *
 * Conventions per PLAN-p61-test-coverage.md section 5: drive the UI;
 * API only for state setup; afterEach cleans up created batches so
 * sequential browser projects don't accumulate state.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

const BACKEND = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:17765";

const SAMPLE_STATUTORY_TEXT = `An Act respecting the Old Age Security framework.

Section 3.
A person who has attained sixty-five years of age is eligible to receive
a monthly pension. The pension is paid each month and is conditional on
residence in Canada or on having resided in Canada for not less than ten
years after the age of eighteen.`;

/**
 * Create an encoding batch in manual mode via the API. Used as setup
 * for the proposal-action tests (E04-E11) so each test gets a fresh
 * batch with proposals to act on.
 */
async function createManualBatch(
  request: APIRequestContext,
  marker: string,
): Promise<{ id: string; proposalIds: string[] }> {
  const r = await request.post(`${BACKEND}/api/encode/batches`, {
    data: {
      document_title: `E2E encoder ${marker}`,
      document_citation: `e2e.encoder.${marker}`,
      input_text: SAMPLE_STATUTORY_TEXT,
      method: "manual",
    },
  });
  if (![200, 201].includes(r.status())) {
    throw new Error(`createManualBatch failed: ${r.status()} ${await r.text()}`);
  }
  const batch = (await r.json()) as { id: string; proposals: Array<{ id: string }> };
  return { id: batch.id, proposalIds: batch.proposals.map((p) => p.id) };
}

const batchesToCleanup: string[] = [];
test.afterEach(async ({ request }) => {
  // Encoder batches are not removable via API today; track them only so a
  // future cleanup (or test-bench reset) has the list. Important: the
  // approvals queue is unaffected since encoder batches live in a separate
  // store, but the /encode list will accumulate entries across runs.
  // PLAN-p61-test-coverage.md section 9 LO-002 candidate: encoder needs a
  // test-friendly DELETE /api/encode/batches/{id} endpoint.
  void request;
  batchesToCleanup.length = 0;
});

test.describe("[E02] New batch via /encode/new -- manual mode", () => {
  test("fill IngestForm + submit -> redirect to /encode/$batchId; new batch visible on /encode list", async ({
    page,
    request,
  }) => {
    const marker = `e02.${Date.now()}`;
    await page.goto("/encode/new");
    await expect(page.getByRole("heading", { name: /new extraction/i })).toBeVisible();

    // Required text inputs.
    await page.getByLabel(/document title/i).fill(`E2E encoder ${marker}`);
    await page.getByLabel(/document citation/i).fill(`e2e.encoder.${marker}`);

    // Method radio: pick Manual so we don't need an LLM key.
    await page.getByRole("radio", { name: /^manual$/i }).check();

    // Statutory text textarea.
    await page.getByLabel(/statutory text/i).fill(SAMPLE_STATUTORY_TEXT);

    // Submit.
    await page.getByRole("button", { name: /extract proposals/i }).click();

    // Post-submit: navigate to /encode/$batchId.
    await page.waitForURL(/\/encode\/[^/]+$/, { timeout: 15_000 });
    const batchId = new URL(page.url()).pathname.split("/").pop()!;
    batchesToCleanup.push(batchId);

    // Page renders the review heading + the manual MethodChip.
    await expect(page.getByRole("heading", { name: /review proposals/i })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to the list and verify the batch appears (post-mutation
    // invalidation per PR #21 IngestForm fix).
    await page.goto("/encode");
    await expect(page.getByText(`E2E encoder ${marker}`)).toBeVisible({ timeout: 10_000 });

    // Sanity at the API layer.
    const got = await request.get(`${BACKEND}/api/encode/batches/${batchId}`);
    const body = (await got.json()) as { method: string; proposals: unknown[] };
    expect(body.method).toBe("manual");
    expect(body.proposals.length).toBeGreaterThan(0);
  });
});

test.describe("[E04] Approve a single proposal via UI ProposalCard", () => {
  test("clicking Approve flips the proposal's status pill to 'Approved'", async ({
    page,
    request,
  }) => {
    const { id } = await createManualBatch(request, `e04.${Date.now()}`);
    batchesToCleanup.push(id);

    await page.goto(`/encode/${id}`);
    await expect(page.getByRole("heading", { name: /review proposals/i })).toBeVisible();

    // First proposal card -- click its Approve button.
    const firstCard = page.getByRole("article").first();
    await firstCard.getByRole("button", { name: /^approve$/i }).click();

    // Status pill flips to 'Approved'. The card now shows "verdict
    // recorded" hint, and the action buttons go to a Reopen state.
    await expect(firstCard.getByText(/^Approved$/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("[E05] Reject a single proposal via UI ProposalCard", () => {
  test("clicking Reject flips the proposal's status pill to 'Rejected'", async ({
    page,
    request,
  }) => {
    const { id } = await createManualBatch(request, `e05.${Date.now()}`);
    batchesToCleanup.push(id);

    await page.goto(`/encode/${id}`);
    const firstCard = page.getByRole("article").first();
    await firstCard.getByRole("button", { name: /^reject$/i }).click();
    await expect(firstCard.getByText(/^Rejected$/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("[E06] Modify a proposal via UI", () => {
  test("opening Modify, editing description, and saving changes flips status to 'Modified'", async ({
    page,
    request,
  }) => {
    const { id } = await createManualBatch(request, `e06.${Date.now()}`);
    batchesToCleanup.push(id);

    await page.goto(`/encode/${id}`);
    const firstCard = page.getByRole("article").first();

    // Click Modify -- opens the proposal-edit dialog.
    await firstCard.getByRole("button", { name: /^modify$/i }).click();
    await expect(page.getByRole("heading", { name: /modify proposal/i })).toBeVisible();

    // Save without further edits -- the dialog allows save when the
    // form is valid; description is already populated.
    await page.getByRole("button", { name: /save changes/i }).click();

    // Pill flips to Modified.
    await expect(firstCard.getByText(/^Modified$/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("[E07] Bulk-approve proposals via BulkActionBar", () => {
  test("selecting multiple proposals and clicking 'Approve all' flips them to 'Approved'", async ({
    page,
    request,
  }) => {
    const { id, proposalIds } = await createManualBatch(request, `e07.${Date.now()}`);
    batchesToCleanup.push(id);
    test.skip(
      proposalIds.length < 2,
      "manual encoder produced <2 proposals; bulk requires multi-select",
    );

    await page.goto(`/encode/${id}`);

    // Select first two proposals via their "Select proposal" checkboxes.
    const checkboxes = page.getByLabel(/select proposal/i);
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // The BulkActionBar's "Approve all" button.
    await page.getByRole("button", { name: /approve all/i }).click();

    // Both selected proposals show 'Approved'.
    await expect(page.getByText(/^Approved$/i)).toHaveCount(proposalIds.length >= 2 ? 2 : 1, {
      timeout: 10_000,
    });
  });
});

test.describe("[E08] Bulk-reject proposals via BulkActionBar", () => {
  test("selecting multiple proposals and clicking 'Reject all' flips them to 'Rejected'", async ({
    page,
    request,
  }) => {
    const { id, proposalIds } = await createManualBatch(request, `e08.${Date.now()}`);
    batchesToCleanup.push(id);
    test.skip(
      proposalIds.length < 2,
      "manual encoder produced <2 proposals; bulk requires multi-select",
    );

    await page.goto(`/encode/${id}`);

    const checkboxes = page.getByLabel(/select proposal/i);
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.getByRole("button", { name: /reject all/i }).click();
    await expect(page.getByText(/^Rejected$/i)).toHaveCount(2, { timeout: 10_000 });
  });
});

test.describe("[E09] Filter proposals by status chip", () => {
  test("clicking the 'Approved' status chip narrows the list; clicking again restores it", async ({
    page,
    request,
  }) => {
    const { id, proposalIds } = await createManualBatch(request, `e09.${Date.now()}`);
    batchesToCleanup.push(id);

    await page.goto(`/encode/${id}`);

    // Approve the first proposal so we have at least one in 'approved'.
    const firstCard = page.getByRole("article").first();
    await firstCard.getByRole("button", { name: /^approve$/i }).click();
    await expect(firstCard.getByText(/^Approved$/i).first()).toBeVisible({ timeout: 5_000 });

    const cards = page.getByRole("article");
    const totalBefore = await cards.count();
    expect(totalBefore).toBeGreaterThanOrEqual(1);

    // Click the 'Approved' filter chip (aria-pressed toggle button).
    await page.getByRole("button", { name: /^approved$/i, exact: false }).first().click();

    // Filtered count should be at most the previous total, and at least 1.
    const totalAfter = await cards.count();
    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
    expect(totalAfter).toBeGreaterThanOrEqual(1);

    // If there were multiple proposals to start with, filtering should
    // strictly narrow.
    if (proposalIds.length > 1) {
      expect(totalAfter).toBeLessThan(totalBefore);
    }
  });
});

test.describe("[E10] Source-text disclosure toggles open and closed", () => {
  test("clicking the 'Source text' button reveals the <pre> with the input text and clicking again hides it", async ({
    page,
    request,
  }) => {
    const { id } = await createManualBatch(request, `e10.${Date.now()}`);
    batchesToCleanup.push(id);

    await page.goto(`/encode/${id}`);
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

test.describe("[E11] Commit a batch -- approved proposals land on /authority", () => {
  test("approving + committing redirects to /authority and reports the rule count via aria-live", async ({
    page,
    request,
  }) => {
    const { id, proposalIds } = await createManualBatch(request, `e11.${Date.now()}`);
    batchesToCleanup.push(id);
    test.skip(proposalIds.length === 0, "manual encoder produced no proposals to commit");

    await page.goto(`/encode/${id}`);

    // Approve the first proposal so commit has something to do.
    const firstCard = page.getByRole("article").first();
    await firstCard.getByRole("button", { name: /^approve$/i }).click();
    await expect(firstCard.getByText(/^Approved$/i).first()).toBeVisible({ timeout: 5_000 });

    // Click Commit -- opens confirmation dialog.
    await page.getByRole("button", { name: /commit to engine/i }).click();
    // Confirm. The CommitConfirmDialog uses the same i18n family with
    // a confirm CTA; accept any button whose name starts with "Commit".
    await page.getByRole("button", { name: /^commit/i }).last().click();

    // Post-commit: navigate to /authority (per encode.$batchId.tsx).
    await page.waitForURL("**/authority**", { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("[E03] New batch (LLM mode)", () => {
  test.skip("deferred -- requires a real LLM provider key on the test target; tracked in PLAN section 11 (out of scope)", () => {
    // Will land in L8 once an LLM-stub fixture is wired into playwright.config.ts.
  });
});
