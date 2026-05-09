/**
 * Leader + visitor UI-driven coverage.
 *
 * Active here:
 *   L01/L02 -- /compare/oas (full data flow): SummaryStrip + multi-jurisdiction
 *     comparison table + ExclusionPanel rendering the data the API returns.
 *     Goes beyond J18's "compare-table visible" by asserting user-visible
 *     content per jurisdiction column + the exclusion list copy.
 *   V03 -- click an inline walkthrough CTA, verify navigation to the linked
 *     console surface (the only "click through walkthrough steps" path
 *     that exists; the seven step sections all render at once on /walkthrough,
 *     no next/previous step UI).
 *
 * Already covered by other suites:
 *   V01 (visit /), V02 (visit /walkthrough), V04 (language toggle), V06 (/policies),
 *   V07 (/impact), V08 (/authority) -- by smoke.spec.ts + i18n.spec.ts.
 *
 * Deferred via test.fixme:
 *   L03 (jurisdiction filter) -- LO-009: feature is not implemented in
 *     `compare.$programId.tsx`. The page calls `compareProgram(programId)`
 *     with no jurisdiction filter. The API supports it (?jurisdictions=...)
 *     but no UI control surfaces it.
 *   L04 (interaction warnings) -- LO-009: same surface; the comparison page
 *     does not render program-interaction warnings, even though the
 *     evaluate API returns them per ADR-018.
 *   V05 (header jurisdiction selector) -- LO-010: feature is not implemented.
 *     `Masthead.tsx` only includes LanguageSwitcher + ThemeToggle + HelpDrawer.
 *     A jurisdiction switcher exists at `JurisdictionSwitcher.tsx` but is
 *     scoped to /admin only, not the global header.
 */

import { test, expect } from "@playwright/test";

test.describe("[L01/L02] /compare/oas -- multi-jurisdiction comparison data flow", () => {
  test("SummaryStrip shows program + coverage summary, table renders rule rows", async ({
    page,
  }) => {
    await page.goto("/compare/oas");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("compare-table")).toBeVisible({ timeout: 15_000 });

    // SummaryStrip surfaces program id, shape, and "<a> of <n> jurisdictions"
    // coverage summary. n = 7 for OAS (canonical in all 7 jurisdictions);
    // 'a' depends on which are populated in the test seed.
    const summary = page.getByTestId("compare-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/oas/i);
    await expect(summary).toContainText(/of\s+\d+\s+jurisdiction/i);

    // The table has at least the rule column + one jurisdiction column,
    // and the body has at least one statutory rule row with an
    // age_threshold or similar rule_type.
    const headerCells = page.getByTestId("compare-table").locator("thead th");
    expect(await headerCells.count(), "compare-table header column count").toBeGreaterThanOrEqual(2);

    const ruleRows = page.getByTestId("compare-table").locator("tbody tr");
    expect(await ruleRows.count(), "compare-table rule row count").toBeGreaterThan(0);
  });

  test("/compare/ei -- coverage summary + ExclusionPanel surface unavailable jurisdictions", async ({
    page,
  }) => {
    await page.goto("/compare/ei");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });

    // /compare/ei renders the SummaryStrip regardless; the table renders only
    // when at least one jurisdiction is available. EI is excluded from JP as
    // v3 architectural control (per CLAUDE.md), so the ExclusionPanel always
    // has at least one entry on /compare/ei.
    const summary = page.getByTestId("compare-summary");
    await expect(summary).toBeVisible({ timeout: 15_000 });
    await expect(summary).toContainText(/ei/i);

    const exclusions = page.getByTestId("compare-exclusions");
    await expect(exclusions).toBeVisible({ timeout: 15_000 });
    // At least one excluded jurisdiction surfaces.
    const exclusionItems = exclusions.locator("li");
    expect(await exclusionItems.count(), "compare-exclusions item count").toBeGreaterThan(0);
  });
});

test.describe("[V03] Walkthrough CTA clicks", () => {
  test("clicking the step-2 'View encoder' CTA navigates to /encode", async ({ page }) => {
    await page.goto("/walkthrough");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });

    // Step 2's CTA is rendered as a link from `walkthrough.step2.cta` ->
    // `/encode`. Click it via accessible link role.
    const cta = page
      .getByRole("link", { name: /encoder|encode/i })
      .filter({ hasNot: page.locator("nav a") })
      .first();
    await cta.click();

    await page.waitForURL(/\/encode($|\?|#)/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("[L03] Switch jurisdiction filter on /compare", () => {
  test.fixme("changing the jurisdiction filter updates the rendered comparison columns", async ({
    page,
  }) => {
    // LO-009: feature is not implemented. compare.$programId.tsx has no
    // jurisdiction-filter UI control. The API supports
    // ?jurisdictions=ca,fr,de but no UI surface invokes it. Scaffolding
    // stays in place so once the filter ships, the test runs as-is.
    await page.goto("/compare/oas");
  });
});

test.describe("[L04] View program-interaction warnings", () => {
  test.fixme("the /compare page surfaces interaction warnings when programs collide", async ({
    page,
  }) => {
    // LO-009: feature is not implemented on /compare. Interaction warnings
    // are returned by the evaluate API (ADR-018) but the comparison page
    // does not render them. Scaffolding stays in place.
    await page.goto("/compare/oas");
  });
});

test.describe("[V05] Switch jurisdiction via header selector", () => {
  test.fixme("the global header jurisdiction selector switches the active jurisdiction", async ({
    page,
  }) => {
    // LO-010: feature is not implemented. Masthead.tsx renders only
    // LanguageSwitcher + ThemeToggle + HelpDrawer. JurisdictionSwitcher
    // exists at components/govops/admin/JurisdictionSwitcher.tsx but is
    // scoped to /admin, not the global header.
    await page.goto("/");
  });
});
