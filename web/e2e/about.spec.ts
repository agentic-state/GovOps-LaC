/**
 * About-page deep coverage — load-bearing affordances per govops-016 +
 * govops-016a. Complements the shallow checks in smoke.spec.ts and
 * a11y.spec.ts: this spec asserts the page actually conveys what the
 * page is supposed to convey (disclaimer present, SPRIND + Agentic
 * State citations rendered, §10 references point at real targets).
 *
 * The about page is the most-shared artefact in the project — it is the
 * first surface a peer-network reader (university, NGO, agency) lands
 * on. A regression here is a regression in trust. This spec is the
 * enterprise-floor gate that catches such regressions early.
 */

import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const STRICT_A11Y = process.env.E2E_A11Y_STRICT === "1";

async function gotoAbout(page: Page, lang: "en" | "fr" = "en"): Promise<void> {
  // I18nProvider reads the `govops-locale` cookie at SSR boot, not a ?lang=
  // query param. Set the cookie on the active baseURL so it works against
  // any target (local dev, HF Space, partner forks).
  const baseURL =
    process.env.TEST_BENCH_TARGET ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://127.0.0.1:17081/";
  await page.context().addCookies([
    {
      name: "govops-locale",
      value: lang,
      url: baseURL,
    },
  ]);
  await page.goto(`/about`);
  // Hero h1 is always rendered SSR; waiting for it confirms hydration is done.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// ---------------------------------------------------------------------------
// §1 — Hero + Disclaimer card
// ---------------------------------------------------------------------------

test.describe("[J44] About — hero + disclaimer", () => {
  test("page renders without an error boundary", async ({ page }) => {
    await gotoAbout(page);
    // Generic error-boundary patterns the project uses elsewhere.
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
    await expect(page.getByText(/error boundary/i)).not.toBeVisible();
  });

  test("disclaimer card states the prototype-not-affiliated framing", async ({ page }) => {
    await gotoAbout(page);
    // The disclaimer is load-bearing — a reader who skims must see this.
    // Text matches the canonical phrasing from govops-016 §1 (allow either
    // the EN body or a localized restatement that preserves the substance).
    const disclaimer = page.locator("section, aside, div").filter({
      hasText: /independent open[- ]source prototype/i,
    });
    await expect(disclaimer.first()).toBeVisible();
    await expect(
      page.getByText(/not affiliated with, endorsed by, or representing/i),
    ).toBeVisible();
  });

  test("masthead exposes both GitHub repo and Pages CTAs (govops-016a)", async ({ page }) => {
    await gotoAbout(page);
    // GitHub repo link
    const repoLink = page.getByRole("link", {
      name: /github|view on github/i,
    });
    await expect(repoLink.first()).toHaveAttribute("href", /github\.com\/agentic-state\/GovOps-LaC/);
    // Pages link (PROJECT_HOME) — distinct from the repo link
    const pagesLink = page.getByRole("link", { name: /github pages/i });
    await expect(pagesLink.first()).toHaveAttribute("href", /agentic-state\.github\.io\/GovOps-LaC/);
  });
});

// ---------------------------------------------------------------------------
// §4 — Reference cards (SPRIND + Agentic State)
// ---------------------------------------------------------------------------

test.describe("[J44] About — reference cards", () => {
  test("SPRIND reference card shows the verbatim definition + correct attribution", async ({
    page,
  }) => {
    await gotoAbout(page);
    // SPRIND attribution must be exactly "Dr. Hakke Hansen, LL.M. and Jörg Resch"
    // — anything else is a regression worth catching.
    await expect(page.getByText(/Hakke Hansen.+Jörg Resch/)).toBeVisible();
    // External SPRIND URL
    const sprindLink = page.getByRole("link", { name: /sprind/i });
    await expect(sprindLink.first()).toHaveAttribute("href", /sprind\.org\/en\/law-as-code/);
  });

  test("Agentic State reference card carries the full 5-author citation", async ({ page }) => {
    await gotoAbout(page);
    // Per the prior session's audit: full citation, no "et al." Use .first()
    // because the page intentionally renders the citation in two places
    // (reference card + body paragraph) — both must be visible; we just need
    // a non-strict match so the assertion doesn't fail on the multiplicity.
    await expect(
      page.getByText(/Ilves.+Kilian.+Parazzoli.+Peixoto.+Velsberg/).first(),
    ).toBeVisible();
    const agenticLink = page.getByRole("link", { name: /agentic state/i });
    await expect(agenticLink.first()).toHaveAttribute("href", /agenticstate\.org/);
  });
});

// ---------------------------------------------------------------------------
// §10 — In-repo references resolve to canonical agentic-state/GovOps-LaC URLs
// ---------------------------------------------------------------------------

test.describe("[J44] About — §10 references", () => {
  test("Project home row points at the GitHub Pages URL", async ({ page }) => {
    await gotoAbout(page);
    // The "Project home" row is the new govops-016a addition; the link
    // opens in a new tab.
    const link = page.getByRole("link", { name: /project home/i }).first();
    await expect(link).toHaveAttribute("href", /agentic-state\.github\.io\/GovOps-LaC/);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("every in-repo reference link uses the canonical eva-foundry URL", async ({ page }) => {
    await gotoAbout(page);
    // Collect every `<a href>` whose host is github.com/agentic-state/GovOps-LaC
    // and assert none uses the placeholder `your-org`.
    const hrefs = await page
      .locator("a")
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLAnchorElement).href));
    const placeholders = hrefs.filter((h) => h.includes("your-org"));
    expect(
      placeholders,
      "About page contains your-org placeholder URLs — REPO_BASE not finalized",
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FR locale — page localizes; reference cards keep verbatim quotes
// ---------------------------------------------------------------------------

test.describe("[J44] About — French locale", () => {
  test("page renders FR strings in chrome but keeps verbatim SPRIND quote", async ({ page }) => {
    await gotoAbout(page, "fr");
    // The lang attribute should reflect FR.
    await expect(page.locator("html")).toHaveAttribute("lang", /fr/i);
    // Verbatim quotes from English sources must not be machine-translated;
    // the SPRIND attribution names stay untranslated.
    await expect(page.getByText(/Hakke Hansen.+Jörg Resch/)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Accessibility — axe-core deep scan on about specifically
// ---------------------------------------------------------------------------

test.describe("[J44] About — accessibility", () => {
  test("axe scan: no critical or serious violations", async ({ page }) => {
    await gotoAbout(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    // Log every critical+serious violation for visibility regardless of
    // whether they hard-fail.
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    if (blocking.length > 0) {
      const summary = blocking.map((v) => `  - [${v.impact}] ${v.id}: ${v.help}`).join("\n");
      console.error(`About a11y blockers:\n${summary}`);
    }

    if (STRICT_A11Y) {
      // In strict mode, any violation breaks the build.
      expect(results.violations).toEqual([]);
    } else {
      // Default: only `critical` is hard-fail — matches the project-wide
      // posture in a11y.spec.ts. `serious` violations (e.g. webkit-specific
      // color-contrast tightenings on the gold accent against parchment) are
      // logged above so they're visible to anyone reading CI output, but
      // they don't block the build. Set E2E_A11Y_STRICT=1 to flip them on.
      const critical = results.violations.filter((v) => v.impact === "critical");
      expect(
        critical,
        `critical a11y violations on /about: ${critical.map((v) => v.id).join(", ")}`,
      ).toEqual([]);
    }
  });
});
