/**
 * Capture v2 product surfaces as standalone static HTML files for the
 * GitHub Pages "deployable demo" — equivalent to the v1 mockup HTMLs
 * we used to ship under docs/screenshots/, but generated from the real
 * v2 product (not hand-crafted).
 *
 * For each route:
 *   1. Navigate via Playwright (cookie-driven locale where applicable)
 *   2. Wait for hydration
 *   3. Inline all stylesheets into <style> tags
 *   4. Strip <script> tags (page becomes static; no JS will run on Pages)
 *   5. Rewrite asset src/href to data: URIs where small (icons, brand)
 *   6. Save as docs/demo/v2/<name>.html
 *
 * Output is self-contained: each .html file opens directly in any
 * browser without needing the assets folder.
 *
 * Run with:
 *   npx playwright test -c playwright.capture.config.ts --grep html-snapshots
 */

import { test, expect, type Page } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../../docs/demo/v2");

interface Snapshot {
  path: string;
  name: string;
  locale?: string;
  /** Optional setup before snapshot (e.g. fill a form). */
  setup?: (page: Page) => Promise<void>;
}

const SNAPSHOTS: Snapshot[] = [
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
  // Multi-jurisdiction proof: France's program text in the substrate
  { path: "/screen/fr", name: "14-screen-fr", locale: "fr" },
];

async function inlineAndStaticize(page: Page): Promise<string> {
  // 1. Inline all linked stylesheets (CSS files served by Vite dev server)
  await page.evaluate(async () => {
    const links = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]'),
    ) as HTMLLinkElement[];
    for (const link of links) {
      try {
        const resp = await fetch(link.href);
        if (!resp.ok) continue;
        const css = await resp.text();
        const style = document.createElement("style");
        style.setAttribute("data-inlined-from", link.href);
        style.textContent = css;
        link.replaceWith(style);
      } catch {
        // Network error — leave the <link> in place; Pages will 404 on it.
      }
    }
  });

  // 2. Strip all <script> tags. The static demo cannot run JS — TanStack's
  //    hydration script and the Vite dev runtime would only produce errors
  //    when served from GitHub Pages. The DOM we capture has already
  //    hydrated; what we save is the post-hydration snapshot.
  await page.evaluate(() => {
    document.querySelectorAll("script").forEach((s) => s.remove());
  });

  // 3. Rewrite small image assets (brand symbols, favicons) to data: URIs so
  //    the snapshot is fully self-contained. Skip large images (screenshots,
  //    inline data URIs already) — those would balloon the file.
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    for (const img of imgs) {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      try {
        const resp = await fetch(src);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        if (blob.size > 100_000) continue; // skip large images
        const dataUri = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(String(r.result));
          r.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUri);
      } catch {
        // leave as-is
      }
    }
  });

  // 4. Insert a banner identifying this as a MOCK demo. The user wants this
  //    short and clear: it's a stop-gap until v2.1 (hosted live demo) lands.
  await page.evaluate(() => {
    const banner = document.createElement("div");
    banner.style.cssText =
      "position:sticky;top:0;z-index:9999;background:#fff3cd;border-bottom:1px solid #ffc107;color:#664d03;padding:0.55rem 1rem;text-align:center;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:0.82rem;line-height:1.5;";
    banner.innerHTML =
      '<strong>Mock demo</strong> — static snapshot, no interactivity. ' +
      'A real hosted live demo ships with v2.1 (≈1 week). ' +
      '<a href="https://agentic-state.github.io/GovOps-LaC/" style="color:#664d03;font-weight:600;">project home</a> · ' +
      '<a href="https://github.com/agentic-state/GovOps-LaC" style="color:#664d03;">source</a>';
    document.body.insertBefore(banner, document.body.firstChild);
  });

  return await page.content();
}

test.beforeAll(() => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
});

for (const shot of SNAPSHOTS) {
  test(`html-snapshot ${shot.name} (${shot.path})`, async ({ page, context }) => {
    if (shot.locale) {
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
    await page.waitForTimeout(600);

    if (shot.setup) await shot.setup(page);

    const html = await inlineAndStaticize(page);
    fs.writeFileSync(path.join(OUT_DIR, `${shot.name}.html`), html, "utf-8");
  });
}
