/**
 * Visual regression baseline -- top routes (en + fr, all 3 browsers).
 *
 * Catches what code-level tests cannot: layout drift, locale-text
 * overflow, theme breakage. Snapshots live in
 * `web/e2e/visual.spec.ts-snapshots/`. CI compares + retains diffs as
 * artifacts on failure. Update locally via:
 *
 *   npx playwright test e2e/visual.spec.ts --update-snapshots --project=chromium
 *
 * Or for Linux + cross-browser baselines (LO-011), trigger the
 * `update-visual-snapshots.yml` workflow_dispatch on GitHub Actions
 * and commit the produced artifact.
 *
 * Scope (LO-011 closeout):
 *   - 10 routes including /config + /check (stabilized via masks +
 *     scroll-to-bottom)
 *   - 2 locales: en (default) + fr (set via cookie before goto -- the
 *     LanguageSwitcher dance is too flaky for snapshot tests)
 *   - All 3 browser projects: chromium / firefox / webkit
 *
 * Cross-platform note: Playwright generates per-platform snapshots
 * (win32, linux, darwin) because font rendering + sub-pixel
 * antialiasing differ between OSes. Linux baselines are produced by
 * the workflow_dispatch above; Windows + macOS contributors regenerate
 * locally before committing.
 *
 * Spec is gated behind RUN_VISUAL_REGRESSION=1 in CI to keep the
 * regular E2E lane green when baselines for the runner's platform are
 * missing. Local runs always include it (no env var required outside CI).
 */

import { test, expect, type Page } from "@playwright/test";

test.skip(
  process.env.CI === "1" && process.env.RUN_VISUAL_REGRESSION !== "1",
  "Visual regression spec disabled in CI until Linux baselines land (LO-011). Set RUN_VISUAL_REGRESSION=1 to enable.",
);

interface RouteSpec {
  path: string;
  id: string;
  /**
   * `true` (default) screenshots the entire scroll height. Routes with
   * tens of thousands of pixels of scroll content (e.g. /config's
   * paginated ConfigValue list) capture the viewport only -- a 35-megapixel
   * baseline image is impractical to diff and is a magnet for noise.
   */
  fullPage?: boolean;
}

// Top routes for v3 visual regression. /config + /check were excluded
// during L7.2 for instability; L8.6 stabilized them and re-included
// them.
const ROUTES: RouteSpec[] = [
  { path: "/", id: "index" },
  { path: "/screen", id: "screen" },
  { path: "/cases", id: "cases" },
  { path: "/authority", id: "authority" },
  { path: "/encode", id: "encode" },
  { path: "/admin/federation", id: "admin-federation" },
  { path: "/compare/oas", id: "compare-oas" },
  { path: "/walkthrough", id: "walkthrough" },
  // /config: relative-time column hidden via injected CSS; viewport-only
  // screenshot because the ConfigValue search list scrolls to 35k+ px
  // and a fullPage diff is too noisy to be useful.
  { path: "/config", id: "config", fullPage: false },
  // /check form sections lazy-mount. The settle helper below scrolls
  // through the page so every section is rendered before the screenshot.
  { path: "/check", id: "check" },
];

const LOCALES = ["en", "fr"] as const;
type Locale = (typeof LOCALES)[number];

async function setLocaleCookie(page: Page, locale: Locale): Promise<void> {
  await page.context().addCookies([
    {
      name: "govops-locale",
      value: locale,
      url: page.url() === "about:blank" ? "http://127.0.0.1:17081" : page.url(),
    },
  ]);
}

async function settleForScreenshot(page: Page): Promise<void> {
  // Step 1: force lazy-mounted sections to materialize. Some routes
  // (notably /check) only render the lower form sections after the
  // user scrolls them into view.
  await page.evaluate(async () => {
    const last = document.body.scrollHeight;
    window.scrollTo(0, last);
    await new Promise((r) => setTimeout(r, 200));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 100));
  });

  // Step 2: drain in-flight network so any fetch the scroll triggered
  // can land before we measure stability.
  await page.waitForLoadState("networkidle");

  // Step 3: wait for scrollHeight to be stable across N consecutive
  // animation frames. The previous version skipped this check, which
  // bit `--update-snapshots` runs (see PR #39 / LO-011): Playwright's
  // regular mode does its own consecutive-stability check, but
  // --update-snapshots writes after a single capture, so a hydration
  // race between scrollTo and the screenshot baked viewport-only
  // baselines for some routes (e.g. /encode at 765px when the real
  // page is 1539px). The CI re-render then failed visual diff.
  await page.evaluate(async () => {
    const TARGET_STABLE_FRAMES = 3;
    const MAX_FRAMES = 60; // ~1s ceiling at 60fps -- bail out rather than hang
    return new Promise<void>((resolve) => {
      let lastHeight = document.body.scrollHeight;
      let stableFrames = 0;
      let framesObserved = 0;
      function tick() {
        framesObserved += 1;
        const current = document.body.scrollHeight;
        if (current === lastHeight) {
          stableFrames += 1;
          if (stableFrames >= TARGET_STABLE_FRAMES) {
            resolve();
            return;
          }
        } else {
          stableFrames = 0;
          lastHeight = current;
        }
        if (framesObserved >= MAX_FRAMES) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  });
}

/**
 * Inject a stylesheet that hides intentionally non-deterministic content
 * (relative-time strings, live timestamps). Playwright's `mask` option
 * paints over a region but doesn't stop the underlying text from
 * shifting page layout between consecutive snapshots -- and Playwright
 * requires two byte-identical consecutive screenshots to mark a snapshot
 * stable. Hiding the content entirely (with reserved space via
 * visibility:hidden) lets the rest of the layout settle.
 */
async function hideUnstableContent(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      [data-testid="recent-activity-relative-time"] {
        visibility: hidden !important;
      }
    `,
  });
}

for (const route of ROUTES) {
  for (const locale of LOCALES) {
    test(`[visual] ${route.id} -- ${locale}`, async ({ page }) => {
      // Set the locale cookie BEFORE navigation so SSR renders the
      // correct catalog and the `<html lang>` attribute matches. The
      // LanguageSwitcher path triggers a refetch and is too flaky for
      // pixel-stable screenshots.
      await setLocaleCookie(page, locale);

      await page.goto(route.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
      await settleForScreenshot(page);
      await hideUnstableContent(page);

      await expect(page).toHaveScreenshot(`${route.id}-${locale}.png`, {
        fullPage: route.fullPage ?? true,
        // Tolerate small antialiasing differences without making the
        // diff too forgiving to catch real regressions.
        maxDiffPixelRatio: 0.01,
      });
    });
  }
}
