/**
 * Visual smoke: every primary route renders without an error boundary,
 * the navigation shell is present, and a screenshot is captured per
 * route into test-results/screenshots/. Foundational coverage — if a
 * route throws on SSR, this spec fires before any deeper test.
 */

import { test, expect } from "@playwright/test";

const PRIMARY_ROUTES = [
  { path: "/", name: "home" },
  { path: "/walkthrough", name: "walkthrough" },
  { path: "/authority", name: "authority" },
  { path: "/about", name: "about" },
  { path: "/policies", name: "policies" },
  { path: "/cases", name: "cases" },
  { path: "/encode", name: "encode" },
  { path: "/config", name: "config-search" },
  { path: "/config/draft", name: "config-draft" },
  { path: "/config/approvals", name: "config-approvals" },
  { path: "/config/diff", name: "config-diff" },
  { path: "/config/prompts", name: "config-prompts" },
  { path: "/admin", name: "admin" },
  { path: "/compare/ei", name: "compare-ei" },
  { path: "/check", name: "check-entry" },
  { path: "/check/life-event?jurisdiction=ca&event=job_loss", name: "check-life-event" },
];

for (const route of PRIMARY_ROUTES) {
  test(`[M04] smoke: ${route.path} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} HTTP status`).toBeLessThan(400);

    // Top-level navigation shell is always present. Config moved under the
    // Console dropdown in the IA restructure — verify the dropdown trigger
    // exists rather than a top-level Config link.
    await expect(page.getByRole("link", { name: /^Home$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Walkthrough$/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Console$/i }).first()).toBeVisible();

    // Viewport-only screenshot. WebKit caps fullPage at 32767 px and /config
    // exceeds that with 324+ ConfigValues; viewport is sufficient to verify
    // the route renders without an error boundary.
    await page.screenshot({
      path: `test-results/screenshots/${route.name}.png`,
      fullPage: false,
    });

    expect(errors, `pageerror events on ${route.path}`).toEqual([]);
  });
}

test("[J48] home: modules + actors + walkthrough CTA all render", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Modules section: 7 cards — substrate, encoder, engine, approvals, audit, schema, federation
  const modulesHeading = page.locator("h2#modules-heading");
  await expect(modulesHeading).toBeVisible();
  const moduleCards = page.locator("section[aria-labelledby='modules-heading'] > ul > li");
  await expect(moduleCards).toHaveCount(7);

  // Actors section: 4 cards — agents, public servants, citizens, leaders
  const actorsHeading = page.locator("h2#actors-heading");
  await expect(actorsHeading).toBeVisible();
  const actorCards = page.locator("section[aria-labelledby='actors-heading'] article");
  await expect(actorCards).toHaveCount(4);

  // Walkthrough CTA card present and links to /walkthrough
  await expect(page.locator("h2#walkthrough-cta-heading")).toBeVisible();
  const ctaLink = page
    .locator("section[aria-labelledby='walkthrough-cta-heading'] a")
    .filter({ hasText: /walkthrough|démonstration|recorrido|demonstração|rundgang|огляд/i })
    .first();
  await expect(ctaLink).toBeVisible();

  await page.screenshot({
    path: "test-results/screenshots/home-modules-actors.png",
  });
});

// Breadcrumb is rendered universally by the layout for every non-home route.
// Verify it on every primary route — none should be missing it.
const NON_HOME_ROUTES = [
  "/walkthrough",
  "/authority",
  "/about",
  "/policies",
  "/cases",
  "/encode",
  "/encode/new",
  "/config",
  "/config/draft",
  "/config/diff",
  "/config/approvals",
  "/config/prompts",
  "/admin",
];

for (const route of NON_HOME_ROUTES) {
  test(`[M06] breadcrumb: ${route} renders the layout-level breadcrumb`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const crumbNav = page.locator('[data-testid="breadcrumb"]');
    await expect(crumbNav).toBeVisible();
    // The first link is always the home crumb.
    await expect(crumbNav.getByRole("link").first()).toHaveAttribute("href", "/");
    // The current page is the last list item — non-link, with aria-current="page".
    await expect(crumbNav.locator('li [aria-current="page"]').first()).toBeVisible();
  });
}

test("[M06] breadcrumb: home page does NOT render a breadcrumb (no orientation noise)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[data-testid="breadcrumb"]')).toHaveCount(0);
});

test("[M06] breadcrumb: stays visible (sticky) when the page is scrolled", async ({ page }) => {
  await page.goto("/walkthrough");
  await page.waitForLoadState("networkidle");

  const crumb = page.locator('[data-testid="breadcrumb"]');
  const masthead = page.getByRole("banner");
  await expect(crumb).toBeVisible();

  // Scroll deep — far enough that a non-sticky element would scroll off.
  await page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY >= 1500);

  // Breadcrumb is still visible AND its top is pinned just below the
  // masthead's bottom edge. A non-sticky element would have scrolled off
  // (top < 0).
  await expect(crumb).toBeVisible();
  const crumbTop = await crumb.evaluate((el) => el.getBoundingClientRect().top);
  const mastheadBottom = await masthead.evaluate((el) => el.getBoundingClientRect().bottom);

  // Within ±12px of the masthead's bottom edge. Browser sub-pixel rounding
  // can put the breadcrumb 1-2px above (visual overlap with backdrop blur)
  // or below the masthead's logical bottom; the human eye reads either as
  // "tucked against the header."
  expect(Math.abs(crumbTop - mastheadBottom)).toBeLessThan(12);

  // CSS computed-style sanity check: position: sticky.
  const computedPosition = await crumb.evaluate((el) => getComputedStyle(el).position);
  expect(computedPosition).toBe("sticky");
});

test("[M05] help drawer: Help button opens a sheet with route-aware content", async ({ page }) => {
  await page.goto("/walkthrough");
  await page.waitForLoadState("networkidle");
  // Click the Help button (label varies by locale; English default is "Help")
  const helpButton = page.getByRole("button", { name: /^Help$/i });
  await expect(helpButton).toBeVisible();
  await helpButton.click();
  // Sheet renders a dialog with the route-specific title
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Walkthrough route help title contains "Walkthrough" or its locale variant
  await expect(dialog.getByRole("heading").first()).toContainText(/walkthrough|paid statutory/i);
});

test("[J32] encoder: approving a proposal locks the Approve/Modify/Reject buttons; Reopen replaces Annotate", async ({
  page,
}) => {
  // The seeded encoding example puts a batch with pending proposals on /encode.
  await page.goto("/encode");
  await page.waitForLoadState("networkidle");

  // Each batch list item is itself a link to /encode/{batchId} (excluding
  // the /encode/new "new extraction" link).
  const firstBatchLink = page.locator('a[href^="/encode/"]:not([href="/encode/new"])').first();
  if (!(await firstBatchLink.isVisible().catch(() => false))) {
    test.skip(true, "no encoding batch fixture available in this run");
  }
  await firstBatchLink.click();
  await page.waitForLoadState("networkidle");

  // Find the first proposal card and its Approve button.
  const approveButton = page
    .getByRole("button", { name: /^Approve$|^Approuver|^Aprobar|^Aprovar|^Genehmigen|^Затверд/i })
    .first();
  await expect(approveButton).toBeEnabled();

  await approveButton.click();
  // Either the click drives the backend update, or the mock fallback flips the
  // local state. Either way, the same button should now be disabled.
  await expect(approveButton).toBeDisabled({ timeout: 10_000 });

  // The locked-state hint surfaces alongside the disabled buttons.
  const lockedHint = page.locator('[data-testid="proposal-locked-hint"]').first();
  await expect(lockedHint).toBeVisible();
});

// Every operator page renders a runbook with three collapsible scenarios.
// Consistency principle: if a page is operator-action, it has a runbook.
const RUNBOOK_ROUTES = [
  { path: "/cases", prefix: "runbook.cases" },
  { path: "/encode", prefix: "runbook.encode" },
  { path: "/config", prefix: "runbook.config" },
  { path: "/config/approvals", prefix: "runbook.approvals" },
  { path: "/config/prompts", prefix: "runbook.prompts" },
  { path: "/admin", prefix: "runbook.admin" },
];

for (const { path, prefix } of RUNBOOK_ROUTES) {
  test(`[M04] runbook: ${path} shows the operator runbook with 3 collapsible scenarios`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const scenarioButtons = page.locator(
      `section[aria-labelledby="${prefix}-heading"] > ul > li > button`,
    );
    await expect(scenarioButtons).toHaveCount(3);
    const first = scenarioButtons.first();
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
  });
}

test("[J45] walkthrough: 7-step paid-vacation scenario renders end to end", async ({ page }) => {
  await page.goto("/walkthrough");
  await page.waitForLoadState("networkidle");

  // 7 step sections, each with a step header (h2 inside the step's section)
  const stepHeadings = page.locator("main h2");
  // 7 steps + 1 closing heading = 8 h2s minimum
  await expect(stepHeadings).toHaveCount(8);

  // Closing CTA has primary + secondary actions
  const closingPrimary = page
    .getByRole("link", { name: /approvals|approbations|aprobaciones|aprovaç|genehmigung|затверд/i })
    .last();
  await expect(closingPrimary).toBeVisible();

  // Visual record of the full scenario
  await page.screenshot({
    path: "test-results/screenshots/walkthrough-full.png",
  });
});
