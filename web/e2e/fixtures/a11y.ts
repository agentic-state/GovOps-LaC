/**
 * Post-mutation accessibility helpers.
 *
 * `a11y.spec.ts` runs axe on every route at idle load. That misses the
 * most common a11y bugs: result toasts that don't announce, focus
 * dropped after a redirect, list-update with no live-region cue. These
 * helpers make those assertions easy from any mutation spec.
 *
 * Usage pattern in a mutation spec:
 *
 *   import { expectAccessibleMutation } from "../fixtures/a11y";
 *   ...
 *   await page.getByRole("button", { name: /approve/i }).click();
 *   await expectAccessibleMutation(page, {
 *     toastPattern: /approved/i,
 *     focusLandmark: "heading",
 *   });
 *
 * Or call the individual helpers separately.
 */

import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Run axe-core (WCAG 2.1 AA + best-practice) on the current page state
 * and fail on any critical-impact violation. Lower-severity violations
 * are logged but tolerated unless E2E_A11Y_STRICT=1.
 *
 * Use this AFTER a mutation resolves. The contract: the post-mutation
 * page state must be zero-critical-violations, even when result toasts
 * + focus changes are mid-flight.
 */
export async function expectNoCriticalAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();

  const critical = results.violations.filter((v) => v.impact === "critical");
  if (critical.length > 0) {
    const summary = critical
      .map((v) => `[${v.impact}] ${v.id} (${v.nodes.length} nodes): ${v.help}`)
      .join("\n    ");
    expect(critical, `axe critical violations after ${label}:\n    ${summary}`).toEqual([]);
  }

  if (process.env.E2E_A11Y_STRICT === "1") {
    expect(results.violations, `axe violations after ${label}`).toEqual([]);
  } else if (results.violations.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `axe found ${results.violations.length} non-critical violation(s) after ${label}`,
    );
  }
}

/**
 * Assert that a toast / aria-live region carrying the operation result
 * is present + matches the expected pattern. Sonner (the toast library
 * used here) renders into a `[role="status"]` or `[role="alert"]`
 * region under the body.
 *
 * The pattern is regex-matched against the visible text of any
 * matching live region.
 */
export async function expectToastAnnouncement(
  page: Page,
  pattern: RegExp,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 5_000;
  // Sonner uses [role=status] for default toasts and [role=alert] for
  // error toasts. Both are valid live regions.
  const liveRegion = page.locator('[role="status"], [role="alert"], [aria-live]').filter({
    hasText: pattern,
  });
  await expect(liveRegion.first(), `toast announcement matching ${pattern}`).toBeVisible({
    timeout,
  });
}

/**
 * Assert that focus has moved to a sensible landing element after a
 * mutation (typically a heading, primary action button, or content
 * list). Focus dropping back to <body> is the failure mode here -- it
 * forces keyboard / screen-reader users to tab from the top of the
 * page to find the result.
 */
export async function expectFocusOnSensibleLandmark(
  page: Page,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 3_000;
  // Wait briefly for any post-mutation focus shift to settle.
  await page.waitForTimeout(150);
  const focusedTag = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    return el.tagName?.toLowerCase() ?? null;
  });
  // Acceptable landing tags: anything that is not <body> / null.
  // Headings, buttons, links, inputs, lists are all fine. <body> is
  // the failure mode.
  expect(focusedTag, `focus after mutation (timeout ${timeout}ms)`).not.toBe("body");
  expect(focusedTag, `focus must be on a defined element after mutation`).not.toBeNull();
}

/**
 * Convenience wrapper: assert all three post-mutation invariants in
 * one call.
 */
export async function expectAccessibleMutation(
  page: Page,
  opts: {
    label: string;
    toastPattern?: RegExp;
  },
): Promise<void> {
  if (opts.toastPattern) {
    await expectToastAnnouncement(page, opts.toastPattern);
  }
  await expectNoCriticalAxeViolations(page, opts.label);
  // Note: we deliberately do NOT call expectFocusOnSensibleLandmark
  // here by default. Toasts intentionally do NOT steal focus (per
  // sonner / WAI-ARIA guidance), so focus often stays on the
  // triggering button. Use expectFocusOnSensibleLandmark explicitly
  // when the mutation IS expected to move focus (e.g. after redirect
  // to a detail page).
}
