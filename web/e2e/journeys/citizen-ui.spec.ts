/**
 * Citizen persona -- UI-driven coverage of the screen + check forms.
 *
 *   C03/C04/C06 are all currently `test.fixme` -- pending PLAN
 *   leftover LO-005 (per-form valid-payload helper). The screen and
 *   check forms have more required fields than the L4 spec fills:
 *   /screen requires at least one residency_period (with country +
 *   start_date), /check has the same residency requirement plus a
 *   jurisdiction-specific evidence map. The forms correctly enforce
 *   their schemas; submit silently no-ops on incomplete payloads, so
 *   no result panel renders and the assertion times out.
 *
 *   Same shape as L3 LO-003 (NewEventForm per-event-type fields). The
 *   right fix is a fixture helper that, given a jurisdiction and
 *   eligibility intent, fills the minimum-valid payload via the form
 *   in the right order. Tracked as LO-005 in PLAN section 9.
 *
 *   Test scaffolding stays in place (selectors, assertions) so once
 *   the helper lands, the test.fixme markers can be removed and the
 *   tests run as-is.
 *
 * C01/C02/C05/C07/C08 already covered by existing journeys/citizen.spec.ts
 * (J01, J02) and check.spec.ts (J03, J04).
 */

import { test, expect } from "@playwright/test";

test.describe("[C03] Fill /screen form and submit", () => {
  test.fixme("checking eligibility for CA with valid DOB + Citizen + residency surfaces a result outcome", async ({
    page,
  }) => {
    await page.goto("/screen/ca");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });

    // DOB -- native date input by id 'screen-dob'.
    await page.locator("#screen-dob").fill("1955-04-12");

    // Legal status radio -- 'Citizen' is the first; identify by the
    // radio's accessible name.
    await page.getByRole("radio", { name: /^citizen$/i }).check();

    // Evidence checkboxes -- both must be checked for an Eligible outcome.
    await page.getByLabel(/birth certificate or passport/i).check();
    await page.getByLabel(/records of my residency/i).check();

    // Submit.
    await page.getByRole("button", { name: /check eligibility/i }).click();

    // Outcome panel renders one of the four outcome verdicts.
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
  test.fixme("submitting the screen form then clicking Download decision opens a new tab carrying the notice", async ({
    page,
    context,
  }) => {
    await page.goto("/screen/ca");
    await page.locator("#screen-dob").fill("1955-04-12");
    await page.getByRole("radio", { name: /^citizen$/i }).check();
    await page.getByLabel(/birth certificate or passport/i).check();
    await page.getByLabel(/records of my residency/i).check();
    await page.getByRole("button", { name: /check eligibility/i }).click();

    // Result panel includes the Download decision button.
    const downloadBtn = page.getByRole("button", { name: /download decision/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });

    // The button opens a new tab via window.open.
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
  test.fixme("submitting baseline CA citizen facts surfaces program result cards", async ({ page }) => {
    await page.goto("/check");
    await expect(page.getByRole("heading", { name: /what am i entitled to/i })).toBeVisible({
      timeout: 10_000,
    });

    // Jurisdiction -- shadcn Select labelled "Jurisdiction".
    // (CA is the default; pin explicitly.)
    const jurSelect = page.getByLabel(/^jurisdiction\b/i).first();
    await jurSelect.selectOption("ca").catch(async () => {
      // Fallback if it's a custom Select (not native).
      await jurSelect.click();
      await page.getByRole("option", { name: /^canada$/i }).click();
    });

    await page.getByLabel(/date of birth/i).fill("1955-04-12");

    // Legal status: Citizen radio.
    await page.getByRole("radio", { name: /^citizen$/i }).check();

    // Residency start.
    await page.getByLabel(/residency.*contributions.*began on/i).fill("1985-01-01");

    // Evidence.
    await page.getByLabel(/birth certificate/i).check().catch(() => {});
    await page.getByLabel(/records of.*residency/i).check().catch(() => {});

    await page.getByRole("button", { name: /check eligibility|submit/i }).click();

    // Result: at least one program card with an outcome string.
    const anyOutcome = page
      .getByText(/likely eligible/i)
      .or(page.getByText(/not eligible/i))
      .or(page.getByText(/need more information/i))
      .or(page.getByText(/needs human review/i))
      .first();
    await expect(anyOutcome).toBeVisible({ timeout: 15_000 });
  });
});
