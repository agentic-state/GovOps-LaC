/**
 * One-off capture spec: produces the PNG screenshots embedded in
 * docs/index.html (GitHub Pages landing) and README.md.
 *
 * Not part of the regular E2E suite — runs only via:
 *   npx playwright test -c playwright.capture.config.ts
 *
 * Output: ../docs/screenshots/v2/*.png  (committed to the repo)
 *
 * Each capture targets a v2.0-distinctive surface so the public-facing
 * landing reflects what was actually built (Vite + TanStack + shadcn,
 * dark-first parchment-soft palette), not the v1.0 Jinja look-alikes.
 */

import { test, expect, type Page } from "@playwright/test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../../docs/screenshots/v2");

interface Shot {
  path: string;
  name: string;
  /** Locale to set via the govops-locale cookie before navigation. Defaults to "en". */
  locale?: string;
  /** When true, scroll-to-bottom and capture full page; otherwise viewport only. */
  fullPage?: boolean;
  /** Optional setup step (e.g. fill a form) before screenshot. */
  setup?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  { path: "/", name: "01-home" },
  { path: "/about", name: "02-about" },
  { path: "/walkthrough", name: "03-walkthrough" },
  { path: "/authority", name: "04-authority" },
  { path: "/screen", name: "05-screen-picker" },
  { path: "/screen/ca", name: "06-screen-ca" },
  { path: "/cases", name: "07-cases" },
  { path: "/impact?citation=OAS+Act%2C+s.+3%281%29", name: "08-impact" },
  { path: "/config", name: "09-config" },
  { path: "/config/approvals", name: "10-config-approvals" },
  { path: "/config/prompts", name: "11-config-prompts" },
  { path: "/admin/federation", name: "12-admin-federation" },
  { path: "/encode", name: "13-encode" },
  // Multi-jurisdiction proof point — French jurisdiction; substrate-driven
  // program text renders in French (Retraite de base CNAV, République française)
  // even though the UI chrome stays at the default until the cookie path is
  // fully wired through SSR. Sufficient as a "different jurisdiction, different
  // language" proof; full multi-locale UI screenshots can be re-shot when the
  // cookie-vs-SSR-locale handshake is completed.
  { path: "/screen/fr", name: "14-screen-fr", locale: "fr" },
];

for (const shot of SHOTS) {
  test(`capture ${shot.name} (${shot.path})`, async ({ page, context }) => {
    if (shot.locale) {
      // Cookie URL must include trailing slash to match path "/" — same pattern
      // as web/e2e/about.spec.ts. The I18nProvider reads this at SSR boot.
      const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? "17081";
      await context.addCookies([
        {
          name: "govops-locale",
          value: shot.locale,
          url: `http://127.0.0.1:${FRONTEND_PORT}/`,
        },
      ]);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(shot.path);
    expect(response?.status(), `${shot.path} HTTP status`).toBeLessThan(400);
    await page.waitForLoadState("networkidle");

    if (shot.setup) await shot.setup(page);

    // Settle: pause for any post-load animations / fonts.
    await page.waitForTimeout(400);

    await page.screenshot({
      path: path.join(OUT_DIR, `${shot.name}.png`),
      fullPage: shot.fullPage ?? false,
      animations: "disabled",
    });
  });
}
