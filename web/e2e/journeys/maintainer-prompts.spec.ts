/**
 * Maintainer persona -- /config/prompts/$key/$jurisdictionId/edit
 * UI-driven coverage.
 *
 *   M09 Save-as-draft from the prompt editor: type into CodeMirror,
 *       click Save, verify the new draft is on /config/approvals.
 *   M10 Reset to current-effective: type a change, click Reset, verify
 *       the editor restores the original (current) value.
 *   M11 Show/hide diff overlay: toggle the diff button, assert the
 *       diff section appears and disappears.
 *   M12 Run fixture test against the prompt -- DEFERRED. Requires an
 *       LLM provider key; not in scope for this batch.
 *
 * Seed assumption: GOVOPS_SEED_DEMO=1 (set by playwright.config.ts) loads
 * at least one prompt-domain ConfigValue. We pick the first one.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
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

/** Pick the first prompt-domain ConfigValue from the live seed. */
async function pickSeededPrompt(
  api: Awaited<ReturnType<typeof backend>>,
): Promise<{ key: string; jurisdictionId: string }> {
  const list = await api.listValues({ domain: "prompt" });
  const first = list.values[0] as
    | { key?: string; jurisdiction_id?: string | null }
    | undefined;
  if (!first?.key) throw new Error("no prompt-domain ConfigValue on target");
  return { key: first.key, jurisdictionId: first.jurisdiction_id ?? "global" };
}

/**
 * CodeMirror's editable area is `.cm-content` -- a contenteditable div.
 * Click to focus, then use keyboard.type. To replace the whole content,
 * select-all first.
 */
async function replaceCodeMirrorContent(page: Page, next: string): Promise<void> {
  const cm = page.locator(".cm-content").first();
  await cm.click();
  // Select-all is platform-aware -- ControlOrMeta works because typing into
  // CodeMirror happens on the host OS, not the page's platform string.
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.keyboard.type(next);
}

async function readCodeMirrorContent(cm: Locator): Promise<string> {
  return (await cm.innerText()).trim();
}

test.describe("[M09] Save-as-draft from the prompt editor", () => {
  // LO-001 RESOLVED in L8.3 (PR #...): api.ts BASE now reads
  // VITE_API_BASE_URL for the SSR branch too, so the E2E backend is
  // reachable. The hydration useEffect was also corrected to mirror
  // `current` when no localStorage draft is saved (instead of running
  // once and staying blank).
  test("typing into CodeMirror + clicking Save creates a draft on /config/approvals", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const { key, jurisdictionId } = await pickSeededPrompt(api);

    await page.goto(
      `/config/prompts/${encodeURIComponent(key)}/${encodeURIComponent(jurisdictionId)}/edit`,
    );
    await expect(page.getByRole("heading", { name: /editing/i })).toBeVisible();

    // Wait for CodeMirror to mount and hydrate from the loader's current
    // value (state.hydrated flips inside a useEffect).
    const cm = page.locator(".cm-content").first();
    await expect(cm).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await cm.innerText()).length, { timeout: 10_000 }).toBeGreaterThan(
      0,
    );

    // Mutate the prompt body. Append a marker so we can verify it survived.
    const marker = `\n\n# e2e M09 marker ${Date.now()}`;
    await cm.click();
    await page.keyboard.press("End");
    await page.keyboard.type(marker);

    // Save-as-draft. Button label = "Save as draft" (no parens, distinct
    // from the /config/draft form's "Save as draft (URL)").
    await page.getByRole("button", { name: /^save as draft$/i }).click();

    // Submit redirects to /config/approvals/$id for the new draft.
    await page.waitForURL(/\/config\/approvals\/[^/]+$/, { timeout: 15_000 });

    // The new draft id is in the URL.
    const newId = new URL(page.url()).pathname.split("/").pop()!;
    draftsToCleanup.push(newId);

    // Confirm the backend has it as draft + carries our marker text.
    const got = (await api.getValue(newId)) as { value: unknown; status: string };
    expect(got.status).toBe("draft");
    expect(String(got.value)).toContain("e2e M09 marker");
  });
});

test.describe("[M10] Reset to current-effective restores the editor value", () => {
  // LO-001 RESOLVED in L8.3: see M09 above.
  test("typing a change then clicking Reset puts the original value back", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const { key, jurisdictionId } = await pickSeededPrompt(api);

    // Clear any saved draft from a previous run so the editor hydrates
    // from `current` and the captured `original` matches what Reset
    // will restore to. Without this clear, a leftover M09-marker draft
    // pollutes the comparison.
    await page.goto(
      `/config/prompts/${encodeURIComponent(key)}/${encodeURIComponent(jurisdictionId)}/edit`,
    );
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByRole("heading", { name: /editing/i })).toBeVisible();

    const cm = page.locator(".cm-content").first();
    await expect(cm).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await cm.innerText()).length, { timeout: 10_000 }).toBeGreaterThan(
      0,
    );

    const original = await readCodeMirrorContent(cm);
    expect(original.length).toBeGreaterThan(0);

    // Capture a stable token from the original to verify Reset restored
    // it. CodeMirror virtualizes line rendering and innerText only
    // returns visible lines, so a strict toBe(original) comparison is
    // brittle when the editor scrolls before vs after the type+reset
    // (asserting the visible-line snapshot is the wrong contract).
    const originalToken = original.split("\n")[0]?.trim() ?? "";
    expect(originalToken.length).toBeGreaterThan(0);

    // Replace with a deliberately different value.
    await replaceCodeMirrorContent(page, "M10 e2e -- transient edit, will be reset");
    await expect.poll(async () => readCodeMirrorContent(cm)).toContain("transient edit");

    // Click Reset.
    await page.getByRole("button", { name: /reset to current-effective/i }).click();

    // After Reset: original first-line token is back, transient edit is gone.
    await expect.poll(async () => readCodeMirrorContent(cm)).toContain(originalToken);
    await expect.poll(async () => readCodeMirrorContent(cm)).not.toContain("transient edit");
  });
});

test.describe("[M11] Diff overlay toggle", () => {
  test("clicking 'Show diff' reveals the Diff section; clicking 'Hide diff' hides it", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const { key, jurisdictionId } = await pickSeededPrompt(api);

    await page.goto(
      `/config/prompts/${encodeURIComponent(key)}/${encodeURIComponent(jurisdictionId)}/edit`,
    );
    await expect(page.getByRole("heading", { name: /editing/i })).toBeVisible();

    // Make a non-trivial change so the diff has something to show.
    const cm = page.locator(".cm-content").first();
    await expect(cm).toBeVisible({ timeout: 10_000 });
    await cm.click();
    await page.keyboard.press("End");
    await page.keyboard.type("\n\n# M11 diff marker\n");

    // Initially, the diff overlay is hidden -- no diff heading.
    const diffHeading = page.getByRole("heading", { name: /^diff$/i });

    // Show.
    await page.getByRole("button", { name: /show diff vs current/i }).click();
    await expect(diffHeading).toBeVisible();

    // Hide.
    await page.getByRole("button", { name: /^hide diff$/i }).click();
    await expect(diffHeading).toHaveCount(0);
  });
});

test.describe("[M12] Run fixture test against the prompt", () => {
  test.skip("deferred -- FixtureTestPanel requires an LLM provider key; not in this batch", () => {
    // Tracked in PLAN-p61-test-coverage.md section 9 (v1/v2 leftovers
    // queue). Will land in L1.4 follow-up or L8 once a stub provider /
    // mock LLM mode is wired into the playwright fixture set.
  });
});
