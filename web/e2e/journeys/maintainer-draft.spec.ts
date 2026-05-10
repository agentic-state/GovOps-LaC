/**
 * Maintainer persona -- /config/draft form UI-driven coverage.
 *
 *   M07 Submit a brand-new ConfigValue draft via the UI form. Verifies
 *       the form fills, validates, submits, redirects to the per-key
 *       timeline, and the new id appears in the approvals queue (proves
 *       the post-mutation invalidation shipped in PR #21 still works).
 *
 *   M08 "Save as draft (URL)" puts the form state into the URL search
 *       params so reloading or sharing the URL hydrates the same draft.
 *
 * Per-test cleanup pattern (same as maintainer-approvals.spec.ts):
 * sequential browser projects share one backend; tests must reject any
 * draft they leave behind so the demo seed stays under the page-size
 * cutoff for J20.
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

const draftsToCleanup: string[] = [];
test.afterEach(async ({ request }) => {
  const api = await backend(request);
  while (draftsToCleanup.length > 0) {
    const id = draftsToCleanup.pop()!;
    try {
      await api.reject(id, "e2e-cleanup", "auto cleanup after test");
    } catch {
      /* already-resolved or already-removed -- fine */
    }
  }
});

const VALID_RATIONALE =
  "M07 e2e draft -- exercises the full ConfigValue submit path including invalidation.";

test.describe("[M07] Submit a new ConfigValue draft via the UI form", () => {
  test("filling the form and clicking Submit creates a draft, redirects to the timeline, and the new draft is visible on /config/approvals", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const uniqueKey = `e2e.maintainer.m07.${Date.now()}`;

    await page.goto("/config/draft");
    await expect(page.getByRole("heading", { name: /draft new configvalue/i })).toBeVisible();

    // Key (mono input).
    await page.getByLabel(/^key\b/i).fill(uniqueKey);

    // Jurisdiction is a shadcn Select; click trigger then option. Scope to
    // the form because LO-010 added a global jurisdiction switcher in the
    // header that also has aria-label="Jurisdiction".
    const draftForm = page.getByRole("form", { name: /draft new configvalue/i });
    await draftForm.getByLabel(/^jurisdiction\b/i).click();
    await page.getByRole("option", { name: /^ca-oas$/i }).click();

    // Domain defaults to "rule" but pin it explicitly so a future seed
    // change does not silently break the test.
    await page.getByLabel(/^domain\b/i).click();
    await page.getByRole("option", { name: /^rule$/i }).click();

    // Value type: number.
    await page.getByLabel(/^value type\b/i).click();
    await page.getByRole("option", { name: /^number$/i }).click();

    // Effective from -- native datetime-local input. Format: YYYY-MM-DDTHH:mm
    await page.locator('input[type="datetime-local"]').fill("2030-01-01T00:00");

    // Value (number type renders <input type="number">). Negative
    // lookahead so we do not collide with the "Value type" Select label
    // that shares the same word stem.
    await page.getByLabel(/^value(?!\s*type)/i).fill("65");

    // Citation (rule-domain requires it).
    await page.getByLabel(/^citation\b/i).fill("OAS Act, s. 3(1)");

    // Rationale (>= 20 chars).
    await page.getByLabel(/^rationale\b/i).fill(VALID_RATIONALE);

    // Submit.
    await page.getByRole("button", { name: /^submit draft$/i }).click();

    // Post-submit: navigate to /config/$key/$jurisdictionId timeline.
    await page.waitForURL(`**/config/${encodeURIComponent(uniqueKey)}/ca-oas`, {
      timeout: 15_000,
    });
    // Heading on the timeline page renders.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Find the just-created draft via the API so we can clean it up + verify
    // the post-mutation invalidation by visiting the queue.
    const drafts = await api.listValues({ status: "draft" });
    const created = drafts.values.find(
      (v: Record<string, unknown>) => v.key === uniqueKey,
    ) as { id: string } | undefined;
    expect(created, "createConfigValue produced a draft on the backend").toBeTruthy();
    draftsToCleanup.push(created!.id);

    await page.goto("/config/approvals");
    const draftLink = page.locator(`a[href*="/config/approvals/${created!.id}"]`);
    await expect(draftLink).toHaveCount(1, { timeout: 10_000 });
  });
});

test.describe("[M08] Save-as-draft pushes form state into the URL", () => {
  test("typing in the form and clicking 'Save as draft (URL)' updates the search params + persists across reload", async ({
    page,
  }) => {
    const seedKey = `e2e.maintainer.m08.${Date.now()}`;

    await page.goto("/config/draft");
    await expect(page.getByRole("heading", { name: /draft new configvalue/i })).toBeVisible();

    // Fill a few representative fields.
    await page.getByLabel(/^key\b/i).fill(seedKey);
    await page.getByLabel(/^citation\b/i).fill("OAS Act, s. 3(1)");
    await page.getByLabel(/^rationale\b/i).fill(
      "M08 save-as-draft -- verifies URL state hydration round-trip.",
    );

    // Click save-as-draft. Button is variant="ghost"; locate by accessible
    // name from the i18n key "draft.save_as_draft" -> "Save as draft (URL)".
    await page.getByRole("button", { name: /save as draft \(url\)/i }).click();

    // URL should now carry our key + citation + rationale.
    await expect.poll(
      () => {
        const url = new URL(page.url());
        return url.searchParams.get("key");
      },
      { timeout: 5_000 },
    ).toBe(seedKey);

    expect(new URL(page.url()).searchParams.get("citation")).toBe("OAS Act, s. 3(1)");

    // Reload from the same URL -- fields hydrate from the search params, no
    // backend round-trip required.
    await page.reload();
    await expect(page.getByLabel(/^key\b/i)).toHaveValue(seedKey);
    await expect(page.getByLabel(/^citation\b/i)).toHaveValue("OAS Act, s. 3(1)");
  });
});
