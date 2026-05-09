/**
 * Federation admin -- UI-driven coverage of /admin/federation.
 *
 * F01 already covered by J34 (registry view + page renders).
 *
 * F02/F03 active: LO-008 (parent admin.tsx missing Outlet) + LO-007
 * (registry shape mismatch) both fixed in L8.1; the federation surface
 * now renders properly and F02/F03 can drive the empty-state UI.
 *
 * F04-F07 remain `test.fixme` tied to LO-006: F04 (enable from row),
 * F05 (disable from row), F06 (re-fetch from row), F07 (fail-closed via
 * UI input) all require a seeded registry + imported pack. There is no
 * test fixture today that seeds either; tracked as LO-006 in
 * PLAN-p61-test-coverage.md section 9. Scaffolding stays in place.
 */

import { test, expect } from "@playwright/test";

test.describe("[F02] /admin/federation -- empty-state form structure", () => {
  test("page renders the heading + section landmarks + an empty-registry CTA", async ({
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

    await expect(page.getByText(/no publishers registered/i)).toBeVisible();

    const publisherInput = page.locator("#fed-publisher");
    await expect(publisherInput).toBeDisabled();
    await expect(page.getByRole("button", { name: /^fetch$/i })).toBeDisabled();
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

test.describe("[F04] Enable a pack via row toggle", () => {
  test.fixme("pack-row Enable action toggles the row to Active", async ({ page }) => {
    // LO-006: requires an imported pack in lawcode/.federated/<id>/. No
    // test fixture seeds one today; the pack list is hydrated from
    // on-disk state at startup.
    await page.goto("/admin/federation");
  });
});

test.describe("[F05] Disable a pack via row toggle", () => {
  test.fixme("pack-row Disable action toggles the row to Disabled", async ({ page }) => {
    // Same blocker as F04 -- LO-006.
    await page.goto("/admin/federation");
  });
});

test.describe("[F06] Re-fetch a pack from row", () => {
  test.fixme("pack-row Re-fetch action triggers a fetch and surfaces a toast", async ({ page }) => {
    // Same blocker as F04 -- LO-006.
    await page.goto("/admin/federation");
  });
});

test.describe("[F07] Fail-closed on unknown publisher (UI path)", () => {
  test.fixme("typing an unknown publisher id in the fetch form surfaces an error toast", async ({
    page,
  }) => {
    // LO-006: publisher field is a Select bound to the registry; with
    // empty registry it is a disabled Input -- no typed-text path to a
    // fail-closed error. Backend fail-closed already covered by J38.
    await page.goto("/admin/federation");
  });
});
