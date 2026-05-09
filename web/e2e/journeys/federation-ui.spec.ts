/**
 * Federation admin -- UI-driven coverage of /admin/federation.
 *
 * F01 already covered by J34 (registry view + page renders -- though see
 * LO-008 below: J34's h1-visible assertion is too loose to catch the
 * actual rendering bug).
 *
 * All six tests below are `test.fixme` tied to LO-008 (BLOCK):
 *
 *   admin.tsx (the `/admin` route) does not render <Outlet />, so child
 *   routes -- including admin.federation.tsx (`/admin/federation`) --
 *   never mount their component into the page body. Navigating to
 *   `/admin/federation` shows the Operator-overview body of the parent
 *   route. The federation route's head/meta IS produced (you can see
 *   `<title>Federation</title>` in SSR output) because head generation
 *   runs as part of route matching, but the FederationPage component
 *   never renders.
 *
 * Concrete proof: page.locator("#fed-publisher").count() === 0 on
 * /admin/federation, and the visible h1 is "Operator overview", not
 * "Federation". Surfaced 2026-05-08 while writing F02 -- exactly the
 * kind of bug this lane was designed to catch.
 *
 * Fix is one Outlet edit in admin.tsx (or split admin.tsx into
 * admin.index.tsx + admin.tsx -> just <Outlet />). After fix, also
 * resolve LO-006 (registry seed) + LO-007 (shape mismatch) so all
 * F02-F07 can be unfixme'd. See PLAN-p61-test-coverage.md section 9.
 *
 * Scaffolding stays in place so once the fix lands, the test.fixme
 * markers can be removed and the tests run as-is.
 */

import { test, expect } from "@playwright/test";

test.describe("[F02] /admin/federation -- empty-state form structure", () => {
  test.fixme("page renders the heading + section landmarks + an empty-registry CTA", async ({
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
  test.fixme("checking and unchecking the two toggles updates their checked state", async ({
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
    // Blocked by LO-008 (route does not render); also requires LO-006
    // (seeded pack fixture) once routing fixed.
    await page.goto("/admin/federation");
  });
});

test.describe("[F05] Disable a pack via row toggle", () => {
  test.fixme("pack-row Disable action toggles the row to Disabled", async ({ page }) => {
    // Blocked by LO-008 + LO-006.
    await page.goto("/admin/federation");
  });
});

test.describe("[F06] Re-fetch a pack from row", () => {
  test.fixme("pack-row Re-fetch action triggers a fetch and surfaces a toast", async ({ page }) => {
    // Blocked by LO-008 + LO-006.
    await page.goto("/admin/federation");
  });
});

test.describe("[F07] Fail-closed on unknown publisher (UI path)", () => {
  test.fixme("typing an unknown publisher id in the fetch form surfaces an error toast", async ({
    page,
  }) => {
    // Blocked by LO-008 + LO-006 (publisher field is a Select bound to
    // the registry; with empty registry it is a disabled Input -- no
    // typed-text path to a fail-closed error). Backend fail-closed
    // already covered by J38.
    await page.goto("/admin/federation");
  });
});
