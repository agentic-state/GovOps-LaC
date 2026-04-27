import { expect, test } from "@playwright/test";

/**
 * govops-015b — privacy regression assertions.
 *
 * Invariant: the citizen-facing /screen surface must NEVER write any
 * field value to localStorage or sessionStorage. The form is in-memory
 * React state only; reload wipes it.
 */

const DRAFT_KEY = "govops:screen-draft"; // legacy key — must not exist
const ROUTE = "/screen/ca";

async function fillSomeFields(page: import("@playwright/test").Page) {
  await page.goto(ROUTE);
  // Wait for the form to mount (loader resolves).
  await page.waitForSelector("#screen-dob", { state: "visible" });
  await page.fill("#screen-dob", "1960-01-01");
  await page.check("#screen-legal-citizen");
}

test.describe("/screen — privacy invariants", () => {
  test("no draft key in sessionStorage after filling the form", async ({ page }) => {
    await fillSomeFields(page);
    const stored = await page.evaluate(
      (k) => window.sessionStorage.getItem(k),
      DRAFT_KEY,
    );
    expect(stored).toBeNull();
  });

  test("no draft key in sessionStorage after submitting", async ({ page }) => {
    await fillSomeFields(page);
    // Submit — even if validation rejects, no storage write should happen.
    await page.locator('button[type="submit"]').first().click();
    const stored = await page.evaluate(
      (k) => window.sessionStorage.getItem(k),
      DRAFT_KEY,
    );
    expect(stored).toBeNull();
  });

  test("reloading discards all input (no rehydration)", async ({ page }) => {
    await fillSomeFields(page);
    await page.reload();
    await page.waitForSelector("#screen-dob", { state: "visible" });
    await expect(page.locator("#screen-dob")).toHaveValue("");
    await expect(page.locator("#screen-legal-citizen")).not.toBeChecked();
    const stored = await page.evaluate(
      (k) => window.sessionStorage.getItem(k),
      DRAFT_KEY,
    );
    expect(stored).toBeNull();
  });

  test("no Screen-related keys in sessionStorage at all", async ({ page }) => {
    await fillSomeFields(page);
    const screenKeys = await page.evaluate(() => {
      const out: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && /screen/i.test(k)) out.push(k);
      }
      return out;
    });
    expect(screenKeys).toEqual([]);
  });
});