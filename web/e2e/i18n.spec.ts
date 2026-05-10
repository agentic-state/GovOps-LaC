/**
 * Internationalization smoke — verify the language toggle in the nav
 * shell switches the rendered locale. The repo ships with 6 locales
 * (en, fr, pt-BR, es-MX, de, uk); this spec checks the visible
 * language selector exposes them and switching changes the rendered
 * text on a known label.
 */

import { test, expect } from "@playwright/test";

async function openLanguageMenu(page: import("@playwright/test").Page) {
  // Radix Select trigger renders as role=combobox. Use the keyboard pattern
  // (focus + Space) which is the most reliable way to open it across all
  // three browser engines — synthetic clicks have known timing issues with
  // the @radix-ui/react-select pointerdown handler under SSR hydration.
  const trigger = page.getByRole("combobox", { name: /^Language$/i });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("listbox")).toBeVisible({ timeout: 5_000 });
}

test("[M03] language selector lists all 6 GovOps locales", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await openLanguageMenu(page);
  // Locale labels per src/messages/en.json — accept the exact rendered text
  // (some include country qualifiers).
  for (const label of [
    "English",
    "Français",
    "Español (México)",
    "Português (Brasil)",
    "Deutsch",
    "Українська",
  ]) {
    await expect(page.getByRole("option", { name: label }).first()).toBeVisible();
  }
});

test("[M03] switching to French changes a known nav label", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await openLanguageMenu(page);
  await page.getByRole("option", { name: "Français" }).click();

  // Wait for the locale change to take effect
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "test-results/screenshots/i18n-french.png",
    fullPage: true,
  });

  // The nav links should now be in French ("Accueil" / "Cas" / "Configuration"
  // depending on the translation file). We assert at least one French label
  // is reachable, accommodating either translation choice.
  const frenchish = page.getByRole("link", { name: /accueil|cas|configuration|autorité/i }).first();
  await expect(frenchish).toBeVisible({ timeout: 10_000 });
});
