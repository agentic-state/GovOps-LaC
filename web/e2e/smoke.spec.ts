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
];

for (const route of PRIMARY_ROUTES) {
  test(`smoke: ${route.path} renders`, async ({ page }) => {
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

test("home: modules + actors + walkthrough CTA all render", async ({ page }) => {
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

test("breadcrumb: walkthrough page shows a breadcrumb back to home", async ({ page }) => {
  await page.goto("/walkthrough");
  await page.waitForLoadState("networkidle");
  // Breadcrumb is a nav with role=list; the home crumb is a link with the
  // home icon's sr-only label, and the current page crumb is non-link text.
  const crumbNav = page.getByRole("navigation").filter({
    has: page.locator('ol[role="list"]'),
  });
  await expect(crumbNav).toBeVisible();
  await expect(crumbNav.getByRole("link").first()).toHaveAttribute("href", "/");
});

test("help drawer: Help button opens a sheet with route-aware content", async ({ page }) => {
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

test("runbook: cases page shows the operator runbook with collapsible scenarios", async ({
  page,
}) => {
  await page.goto("/cases");
  await page.waitForLoadState("networkidle");
  // Runbook section heading + 3 scenario buttons
  const scenarioButtons = page.locator('section[aria-labelledby="runbook.cases-heading"] button');
  await expect(scenarioButtons).toHaveCount(3);
  // Click the first scenario; its body should expand
  const first = scenarioButtons.first();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
});

test("walkthrough: 7-step paid-vacation scenario renders end to end", async ({ page }) => {
  await page.goto("/walkthrough");
  await page.waitForLoadState("networkidle");

  // 7 step sections, each with a step header (h2 inside the step's section)
  const stepHeadings = page.locator("main h2");
  // 7 steps + 1 closing heading = 8 h2s minimum
  await expect(stepHeadings).toHaveCount(8);

  // Closing CTA has primary + secondary actions
  const closingPrimary = page.getByRole("link", { name: /approvals|approbations|aprobaciones|aprovaç|genehmigung|затверд/i }).last();
  await expect(closingPrimary).toBeVisible();

  // Visual record of the full scenario
  await page.screenshot({
    path: "test-results/screenshots/walkthrough-full.png",
  });
});
