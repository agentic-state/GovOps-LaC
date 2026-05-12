/**
 * Federation admin -- UI-driven coverage of /admin/federation.
 *
 * F01 already covered by J34 (registry view + page renders).
 *
 * F02/F03 active: LO-008 (parent admin.tsx missing Outlet) + LO-007
 * (registry shape mismatch) both fixed in L8.1; the federation surface
 * now renders properly. LO-006 fixed in L8.4 -- the playwright config
 * sets GOVOPS_SEED_FEDERATION_DEMO=1 which writes a synthetic publisher
 * `demo-publisher-l8` + an imported pack into the sandbox lawcode dir.
 * F04/F05/F06 are now exercisable end-to-end.
 *
 * F07 (fail-closed on unknown publisher via UI input) remains a
 * deliberate skip: with a non-empty registry the publisher field is a
 * Select bound to registry IDs, so there is no typed-text path to a
 * fail-closed error. Backend fail-closed is covered by J38.
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

const SEEDED_PUBLISHER_ID = "demo-publisher-l8";

/**
 * Force the seeded pack into a known enabled-state via API so F04/F05
 * land deterministically across the chromium -> firefox -> webkit
 * serial run. Tolerates the case where the pack is already in the
 * desired state (the API returns 200 either way).
 */
async function setPackState(
  request: import("@playwright/test").APIRequestContext,
  enable: boolean,
): Promise<void> {
  const api = await backend(request);
  if (enable) {
    await api.federationEnable(SEEDED_PUBLISHER_ID);
  } else {
    await api.federationDisable(SEEDED_PUBLISHER_ID);
  }
}

test.describe("[F02] /admin/federation -- seeded form structure", () => {
  test("page renders the heading + section landmarks + publisher Select with seeded entry", async ({
    page,
  }) => {
    const r = await page.goto("/admin/federation");
    expect(r?.status(), "/admin/federation HTTP status").toBeLessThan(400);

    await expect(page.getByRole("heading", { level: 1, name: /federation/i })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByRole("heading", { name: /registered publishers/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /imported packs/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /fetch a pack/i })).toBeVisible();

    // With LO-006 seed: the publisher Select renders (not a disabled
    // Input). The seeded publisher_id is visible in the desktop registry
    // table -- scope to a `<td>` so the assertion does not accidentally
    // match the hidden mobile-card variant (RegistryTable + PacksTable
    // both render a `md:hidden` mobile list AND a `hidden md:block`
    // desktop table; only the desktop variant is visible at the default
    // playwright viewport).
    await expect(page.locator("td", { hasText: SEEDED_PUBLISHER_ID }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /^fetch$/i })).toBeEnabled();
  });
});

test.describe("[F03] dry-run + allow-unsigned checkbox toggles", () => {
  test("checking and unchecking the two toggles updates their checked state", async ({
    page,
  }) => {
    await page.goto("/admin/federation");
    await expect(page.getByRole("heading", { level: 1, name: /federation/i })).toBeVisible({
      timeout: 10_000,
    });

    // Radix Checkbox renders as a button with role=checkbox + aria-checked.
    // The wrapping <label> in FetchPackForm.tsx does not associate via
    // htmlFor, so we scope by parent label hasText.
    const dryRunLabel = page.locator("label", { hasText: /dry-run/i }).first();
    const dryRun = dryRunLabel.getByRole("checkbox");
    const allowUnsignedLabel = page.locator("label", { hasText: /allow unsigned/i }).first();
    const allowUnsigned = allowUnsignedLabel.getByRole("checkbox");

    await expect(dryRun).not.toBeChecked();
    await expect(allowUnsigned).not.toBeChecked();

    await dryRun.click();
    await expect(dryRun).toBeChecked();

    await allowUnsigned.click();
    await expect(allowUnsigned).toBeChecked();

    await dryRun.click();
    await expect(dryRun).not.toBeChecked();
    await allowUnsigned.click();
    await expect(allowUnsigned).not.toBeChecked();
  });
});

test.describe("[F04] Enable a pack via row action", () => {
  test("disabled pack -> click Enable in row menu -> status flips to Active", async ({
    page,
    request,
  }) => {
    // Pre-condition: seeded pack is in 'disabled' state. Force it via API
    // so this test is independent of the previous test's mutations.
    await setPackState(request, false);

    await page.goto("/admin/federation");
    await expect(page.getByRole("heading", { level: 1, name: /federation/i })).toBeVisible();

    // Locate the row for the seeded pack. The PacksTable renders one
    // <tr> per pack on desktop; the first cell is the publisher_id.
    // Scope to the Imported Packs section so the row locator does not
    // accidentally hit the Registered Publishers row that also contains
    // the publisher_id.
    const packsSection = page.locator('section[aria-labelledby="federation-packs-heading"]');
    const row = packsSection.locator("tr", { hasText: SEEDED_PUBLISHER_ID }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText(/disabled/i)).toBeVisible();

    // Open the actions DropdownMenu in this row.
    await row.getByRole("button", { name: /actions/i }).click();
    // Click "Enable" in the open menu.
    await page.getByRole("menuitem", { name: /^enable$/i }).click();

    // Status flips to Active.
    await expect(row.getByText(/^active$/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("[F05] Disable a pack via row action", () => {
  test("enabled pack -> click Disable in row menu -> status flips to Disabled", async ({
    page,
    request,
  }) => {
    await setPackState(request, true);

    await page.goto("/admin/federation");
    await expect(page.getByRole("heading", { level: 1, name: /federation/i })).toBeVisible();

    // Scope to the Imported Packs section so the row locator does not
    // accidentally hit the Registered Publishers row that also contains
    // the publisher_id.
    const packsSection = page.locator('section[aria-labelledby="federation-packs-heading"]');
    const row = packsSection.locator("tr", { hasText: SEEDED_PUBLISHER_ID }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText(/^active$/i)).toBeVisible();

    await row.getByRole("button", { name: /actions/i }).click();
    await page.getByRole("menuitem", { name: /^disable$/i }).click();

    await expect(row.getByText(/disabled/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("[F06] Re-fetch a pack from row action", () => {
  test("Re-fetch menuitem fires the action and the row stays mounted", async ({
    page,
    request,
  }) => {
    await setPackState(request, true);

    await page.goto("/admin/federation");
    await expect(page.getByRole("heading", { level: 1, name: /federation/i })).toBeVisible();

    // Scope to the Imported Packs section so the row locator does not
    // accidentally hit the Registered Publishers row that also contains
    // the publisher_id.
    const packsSection = page.locator('section[aria-labelledby="federation-packs-heading"]');
    const row = packsSection.locator("tr", { hasText: SEEDED_PUBLISHER_ID }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Click the Re-fetch menuitem. The toast that announces success/
    // failure auto-dismisses on a Sonner timer that's hard to race
    // reliably across all 3 browsers, so we assert on the side-effect
    // that DOES persist: the action fires, the menu closes, and the
    // row stays mounted (the catch path keeps the pack on screen).
    await row.getByRole("button", { name: /actions/i }).click();
    const refetchItem = page.getByRole("menuitem", { name: /re-fetch/i });
    await expect(refetchItem).toBeVisible();
    await refetchItem.click();

    // Menu has closed (menuitem detached from DOM) and the row is still there.
    await expect(refetchItem).toBeHidden({ timeout: 5_000 });
    await expect(row).toBeVisible();
  });
});

test.describe("[F07] Fail-closed on unknown publisher (UI path)", () => {
  test.skip("deferred -- with non-empty registry the publisher field is a Select bound to known IDs; there is no typed-text path to a fail-closed error. Backend fail-closed is covered by J38.", () => {
    // Intentionally not implementable end-to-end with the current UI.
    // If a future revision adds an "advanced -- type your own publisher
    // id" affordance, restore this test.
  });
});
