/**
 * Accessibility audit — runs axe-core (WCAG 2.1 AA + best-practices)
 * against every primary route. Government-grade procurement requires
 * WCAG conformance; this spec is the gate that enforces it.
 *
 * Failures are reported but do not block the build by default. Flip the
 * E2E_A11Y_STRICT env var to "1" to make any violation a hard fail.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const A11Y_ROUTES = [
  "/",
  "/walkthrough",
  "/authority",
  "/about",
  "/policies",
  "/cases",
  "/encode",
  "/config",
  "/config/draft",
  "/config/approvals",
  "/config/diff",
  "/config/prompts",
  "/admin",
];

const STRICT = process.env.E2E_A11Y_STRICT === "1";

for (const path of A11Y_ROUTES) {
  test(`a11y: ${path} (WCAG 2.1 AA)`, async ({ page }) => {
    await page.goto(path);
    // Let any client hydration finish
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    if (results.violations.length > 0) {
      const summary = results.violations
        .map(
          (v) =>
            `[${v.impact}] ${v.id} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}): ${v.help} — ${v.helpUrl}`,
        )
        .join("\n  ");
      const msg = `axe found ${results.violations.length} violation(s) on ${path}:\n  ${summary}`;
      console.warn(msg);
      if (STRICT) {
        expect(results.violations, msg).toEqual([]);
      }
    }

    // Always-on assertions: critical violations always fail, even when
    // not in strict mode. Critical = blocking impairment for AT users.
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `critical a11y violations on ${path}: ${critical.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
}
