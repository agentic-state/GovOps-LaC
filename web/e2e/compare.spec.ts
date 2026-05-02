/**
 * Phase F — government-leader comparison surface E2E.
 *
 * PLAN-v3 §Phase F exit gate:
 *   `http://localhost:8080/compare/ei` renders the 6-jurisdiction
 *   comparison with parameter diffs.
 *
 * The smoke spec covers "the route loads"; this spec verifies the
 * comparison-specific contract — table + columns per jurisdiction +
 * parameter rows + JP exclusion panel + axe AA.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("[J17] /compare/ei", () => {
  test("renders the headline comparison table with all six active jurisdictions", async ({
    page,
  }) => {
    await page.goto("/compare/ei");
    await page.waitForLoadState("networkidle");

    // Heading + summary card
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("compare-summary")).toBeVisible();

    // The comparison table renders with one column per active jurisdiction
    // (CA/BR/ES/FR/DE/UA) + the leading "Rule" column = 7 column headers.
    const table = page.getByTestId("compare-table");
    await expect(table).toBeVisible();
    const headerCells = table.locator("thead th");
    await expect(headerCells).toHaveCount(7);
  });

  test("surfaces the canonical EI rules as table rows", async ({ page }) => {
    await page.goto("/compare/ei");
    await page.waitForLoadState("networkidle");

    const table = page.getByTestId("compare-table");
    // Each rule_id appears as a row scope header. The row-headers are
    // monospaced rule ids per the route's RuleRow component.
    for (const ruleId of [
      "rule-ei-contribution",
      "rule-ei-evidence",
      "rule-ei-duration",
      "rule-ei-job-search",
    ]) {
      await expect(table.getByText(ruleId, { exact: false }).first()).toBeVisible();
    }
  });

  test("excludes JP and explains why on the same page", async ({ page }) => {
    await page.goto("/compare/ei");
    await page.waitForLoadState("networkidle");

    // The exclusion panel for JP must render the architectural-control
    // reason verbatim from the backend (Phase F treats JP as a first-class
    // entry, not a silent omission).
    const exclusion = page.getByTestId("compare-exclusion-jp");
    await expect(exclusion).toBeVisible();
    await expect(exclusion).toContainText("architectural control");
  });

  test("axe AA scan: no critical violations on /compare/ei", async ({ page }) => {
    await page.goto("/compare/ei");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `critical a11y violations on /compare/ei: ${critical.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
});
