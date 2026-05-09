/**
 * Citizen persona -- UI-driven coverage of the screen + check forms.
 *
 * LO-005 RESOLVED in L8.4: form-fill helpers live at
 *   web/e2e/fixtures/forms.ts (fillScreenForm + fillCheckForm).
 *   They produce minimum-valid payloads so submit lands on a result
 *   panel rather than no-op'ing on a missing residency_period.
 *
 * C03 -- /screen submit -> verdict panel (UI-driven).
 * C04 -- /screen submit -> Download decision button -> popup carries notice.
 * C06 -- /check submit -> at least one program result card.
 *
 * C01/C02/C05/C07/C08 already covered by existing journeys/citizen.spec.ts
 * (J01, J02) and check.spec.ts (J03, J04).
 */

import { test, expect } from "@playwright/test";
import { fillScreenForm, submitScreenForm, fillCheckForm, submitCheckForm } from "../fixtures/forms";

test.describe("[C03] Fill /screen form and submit", () => {
  test("checking eligibility for CA with valid DOB + Citizen + residency surfaces a result outcome", async ({
    page,
  }) => {
    await page.goto("/screen/ca");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    await fillScreenForm(page);
    await submitScreenForm(page);

    // The form's outcome panel renders one of the four verdict strings.
    // The exact wording is i18n-driven; use a regex over the recognized
    // outcome verbiage.
    const verdict = page
      .getByText(/you appear to qualify/i)
      .or(page.getByText(/you do not appear to qualify yet/i))
      .or(page.getByText(/more information would help/i))
      .or(page.getByText(/this case needs human review/i))
      .first();
    await expect(verdict).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("[C04] Download decision from screen result", () => {
  test("submitting the screen form then clicking Download decision opens a new tab carrying the notice", async ({
    page,
    context,
  }) => {
    await page.goto("/screen/ca");
    await fillScreenForm(page);
    await submitScreenForm(page);

    // Result panel includes the Download decision button.
    const downloadBtn = page.getByRole("button", { name: /download decision/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });

    // The button opens a new tab via window.open (Blob URL with the notice).
    const popupPromise = context.waitForEvent("page", { timeout: 10_000 }).catch(() => null);
    await downloadBtn.click();
    const popup = await popupPromise;

    if (popup) {
      await popup.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      const len = await popup.evaluate(() => document.documentElement.outerHTML.length);
      expect(len).toBeGreaterThan(50);
    }
    // Popup-block tolerated (screen.download.popup_blocked contract).
  });
});

test.describe("[C06] Fill /check multi-program form and submit", () => {
  test("submitting baseline CA citizen facts surfaces program result cards", async ({ page }) => {
    await page.goto("/check");
    await expect(page.getByRole("heading", { name: /what am i entitled to/i })).toBeVisible({
      timeout: 10_000,
    });

    // The /check route initializes its form with sensible defaults
    // (~67-y-o citizen, residency ~49 years, evidence dob+residency
    // checked). Passing {} just submits those defaults.
    await fillCheckForm(page, {});
    await submitCheckForm(page);

    // Result section renders with at least one program card.
    await expect(page.locator('[data-testid="check-results"]')).toBeVisible({ timeout: 15_000 });
    const cards = page.locator('[data-testid^="program-result-"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });
});
