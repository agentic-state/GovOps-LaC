/**
 * Visual regression baseline -- top routes (en only).
 *
 * Catches what code-level tests cannot: layout drift, locale-text
 * overflow, theme breakage. Snapshots live in
 * `web/e2e/visual.spec.ts-snapshots/`. CI compares + retains diffs as
 * artifacts on failure. Update via:
 *
 *   npx playwright test e2e/visual.spec.ts --update-snapshots --project=chromium
 *
 * Then review the diff before committing.
 *
 * Scope today (LO-011):
 *   - 9 routes (top-10 minus /config which has unstable height between
 *     consecutive screenshots)
 *   - en locale only -- the LanguageSwitcher dance that fr requires is
 *     flaky for snapshot tests; french-locale visual baselines are a
 *     separate follow-up
 *   - chromium only -- firefox + webkit baselines are a follow-up
 *
 * Cross-platform note: Playwright generates per-platform snapshots
 * (win32, linux, darwin) because font rendering + sub-pixel
 * antialiasing differ between OSes. Baselines committed today are
 * Windows-Chromium. CI runs on linux-x64 and will fail-with-attach on
 * the first run; the attached diffs become the Linux baselines after
 * Marco downloads + commits them.
 *
 * Spec is gated behind RUN_VISUAL_REGRESSION=1 in CI to keep the
 * regular E2E lane green until both platforms have baselines. Local
 * runs always include it (no env var required outside CI). Tracked as
 * LO-011 in PLAN-p61-test-coverage.md section 9.
 */

import { test, expect } from "@playwright/test";

test.skip(
  process.env.CI === "1" && process.env.RUN_VISUAL_REGRESSION !== "1",
  "Visual regression spec disabled in CI until Linux baselines land (LO-011). Set RUN_VISUAL_REGRESSION=1 to enable.",
);

// PLAN-p61-test-coverage.md section 7: top routes for v3 visual
// regression. Excluded for instability:
//   /config -- admin search list page has a relative-time column
//     ("3 minutes ago") that updates between screenshots
//   /check -- form sections lazy-mount; fullPage height jumps from
//     720px to 800px between consecutive screenshots
const ROUTES = [
  { path: "/", id: "index" },
  { path: "/screen", id: "screen" },
  { path: "/cases", id: "cases" },
  { path: "/authority", id: "authority" },
  { path: "/encode", id: "encode" },
  { path: "/admin/federation", id: "admin-federation" },
  { path: "/compare/oas", id: "compare-oas" },
  { path: "/walkthrough", id: "walkthrough" },
];

for (const route of ROUTES) {
  test(`[visual] ${route.id} -- en`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    // Wait for any post-load fetches to settle so the screenshot
    // doesn't include a half-loaded skeleton.
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${route.id}-en.png`, {
      fullPage: true,
      // Tolerate small antialiasing differences without making the
      // diff too forgiving to catch real regressions.
      maxDiffPixelRatio: 0.01,
    });
  });
}
