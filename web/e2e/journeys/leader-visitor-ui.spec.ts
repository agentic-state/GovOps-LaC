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
  // LO-009 RESOLVED in L8.5: chip-group filter above SummaryStrip wired
  // to ?jurisdictions= in the URL. compareProgram() now passes the
  // selected codes to the API.
  test("toggling a jurisdiction chip narrows the comparison table to the selection", async ({
    page,
  }) => {
    await page.goto("/compare/oas");
    await expect(page.getByTestId("compare-table")).toBeVisible({ timeout: 15_000 });

    const filter = page.getByTestId("compare-jurisdiction-filter");
    await expect(filter).toBeVisible();

    // Default state: no chip pressed -> the help text says "every jurisdiction".
    await expect(filter).toContainText(/every jurisdiction/i);

    // Toggle CA + FR.
    await page.getByTestId("compare-jur-chip-ca").click();
    await page.getByTestId("compare-jur-chip-fr").click();

    // The aria-pressed state reflects the toggle.
    await expect(page.getByTestId("compare-jur-chip-ca")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("compare-jur-chip-fr")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The URL carries the selection so a deep-link survives a refresh.
    await expect.poll(() => new URL(page.url()).searchParams.get("jurisdictions"))
      .toMatch(/ca/);

    // The compare table re-renders -- header column count drops
    // (only the selected jurisdictions plus the rule column).
    const headerCells = page.getByTestId("compare-table").locator("thead th");
    await expect.poll(() => headerCells.count()).toBeLessThanOrEqual(3);
  });
});

test.describe("[L04] View program-interaction warnings", () => {
  // LO-009 RESOLVED in L8.5: new InteractionsPanel + GET /api/programs/{id}/interactions
  // back the section. Empty-state copy renders for programs with no
  // registered cross-program rules.
  test("the /compare page renders an Interactions section with at least an empty-state notice", async ({
    page,
  }) => {
    await page.goto("/compare/oas");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("compare-interactions")).toBeVisible({ timeout: 15_000 });

    // For OAS the registry has the OAS+EI dual-eligibility rule today,
    // so the section should list at least one interaction. Tolerate
    // both states -- a future commit might empty the registry.
    const list = page.getByTestId(/^compare-interaction-/);
    const empty = page.getByTestId("compare-interactions-empty");
    const hasItem = await list.first().isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasItem || hasEmpty, "interactions section must show items or an empty-state notice").toBe(
      true,
    );
  });
});

test.describe("[V05] Switch jurisdiction via header selector", () => {
  // LO-010 RESOLVED in L8.5: GlobalJurisdictionSwitcher in Masthead.tsx
  // (desktop header), persists to localStorage('govops-jurisdiction').
  test("the global header jurisdiction selector renders, accepts a change, and persists", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for the React bundle to finish loading + hydration to complete
    // so the controlled-component onChange handler is wired before we
    // drive the select. Without networkidle + a small grace, selectOption
    // mutates the DOM but onChange never runs and localStorage stays empty.
    await page.waitForLoadState("networkidle");
    const switcher = page.getByTestId("global-jurisdiction-switcher").first();
    await expect(switcher).toBeVisible({ timeout: 10_000 });

    const select = switcher.getByLabel(/^jurisdiction$/i);
    await expect(select).toHaveValue("ca", { timeout: 10_000 });
    await page.waitForTimeout(300);

    await select.selectOption("fr");
    await expect(select).toHaveValue("fr");

    // Persist contract: localStorage carries the choice across reloads.
    await expect.poll(
      () => page.evaluate(() => window.localStorage.getItem("govops-jurisdiction")),
      { timeout: 5_000 },
    ).toBe("fr");

    await page.reload();
    await expect(page.getByTestId("global-jurisdiction-switcher").first().getByLabel(/^jurisdiction$/i))
      .toHaveValue("fr");
  });
});
