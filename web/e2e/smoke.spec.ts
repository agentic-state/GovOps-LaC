/**
 * Visual smoke: every primary route renders without an error boundary,
 * the navigation shell is present, and a screenshot is captured per
 * route into test-results/screenshots/. Foundational coverage — if a
 * route throws on SSR, this spec fires before any deeper test.
 */

import { test, expect } from "@playwright/test";

const PRIMARY_ROUTES = [
  { path: "/", name: "home" },
  { path: "/policies", name: "policies" },
  { path: "/authority", name: "authority" },
  { path: "/cases", name: "cases" },
  { path: "/encode", name: "encode" },
  { path: "/config", name: "config-search" },
  { path: "/config/draft", name: "config-draft" },
  { path: "/config/approvals", name: "config-approvals" },
  { path: "/config/diff", name: "config-diff" },
  { path: "/config/prompts", name: "config-prompts" },
  { path: "/about", name: "about" },
  { path: "/admin", name: "admin" },
];

for (const route of PRIMARY_ROUTES) {
  test(`smoke: ${route.path} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} HTTP status`).toBeLessThan(400);

    // Top-level navigation shell is always present
    await expect(page.getByRole("link", { name: /^Home$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Config$/i }).first()).toBeVisible();

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

test("home: persona sections (citizens / public servants / leaders) all render with anchors", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Each persona has a heading inside an anchored section. Verify the
  // anchor target exists AND a recognizable heading is visible.
  for (const anchor of ["citizens", "servants", "leaders"]) {
    await expect(page.locator(`section#${anchor}`)).toBeVisible();
    await expect(page.locator(`section#${anchor} h2`)).toBeVisible();
  }

  // Persona-nav pills point at each anchor
  for (const anchor of ["citizens", "servants", "leaders"]) {
    await expect(page.locator(`a[href="#${anchor}"]`)).toBeVisible();
  }

  // Leaders engage block ("Three concrete ways to engage") renders 3 numbered options
  const engageItems = page.locator("section#leaders ol > li");
  await expect(engageItems).toHaveCount(3);

  // Capture screenshots of each persona section for the visual record
  for (const anchor of ["citizens", "servants", "leaders"]) {
    const section = page.locator(`section#${anchor}`);
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({
      path: `test-results/screenshots/persona-${anchor}.png`,
    });
  }
});
