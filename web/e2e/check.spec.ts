/**
 * Phase G — citizen entry + life-event reassessment E2E.
 *
 * PLAN-v3 §Phase G exit gate:
 *   A citizen lands on `/check`, declares facts, sees "you may be
 *   eligible for OAS and/or EI in CA", clicks "I just lost my job",
 *   and sees EI reassessment with a bounded-duration timeline.
 *
 * Charter cap: ONE life event (job loss). Anything else is v4.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("/check entry", () => {
  test("renders the form with heading + jurisdiction selector", async ({ page }) => {
    await page.goto("/check");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("check-form")).toBeVisible();
    await expect(page.getByTestId("check-jurisdiction")).toBeVisible();
    await expect(page.getByTestId("check-submit")).toBeVisible();
  });

  test("submitting baseline CA facts surfaces both OAS and EI program cards", async ({
    page,
  }) => {
    await page.goto("/check");
    // Baseline form is pre-filled to a 67-year-old CA citizen with 49 years
    // of CA residency + DOB/residency evidence — OAS-eligible by default.
    await page.getByTestId("check-submit").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("check-results")).toBeVisible();
    await expect(page.getByTestId("program-result-oas")).toBeVisible();
    await expect(page.getByTestId("program-result-ei")).toBeVisible();
  });

  test("EI insufficient_evidence card surfaces the life-event CTA", async ({
    page,
  }) => {
    await page.goto("/check");
    await page.getByTestId("check-submit").click();
    await page.waitForLoadState("networkidle");
    // The CTA only renders when EI is insufficient_evidence (no job_loss
    // evidence yet) — that's the v3 entry-to-life-event handshake.
    await expect(page.getByTestId("life-event-cta-ei")).toBeVisible();
  });

  test("checking 'I just lost my job' flips EI to eligible", async ({ page }) => {
    await page.goto("/check");
    await page.getByTestId("check-evidence-job-loss").check();
    await page.getByTestId("check-submit").click();
    await page.waitForLoadState("networkidle");
    const eiOutcome = page.getByTestId("program-outcome-ei");
    await expect(eiOutcome).toBeVisible();
    // The exact outcome text is locale-aware; assert it doesn't say
    // "insufficient_evidence" / "Need more information".
    const txt = (await eiOutcome.textContent())?.toLowerCase() ?? "";
    expect(txt).not.toContain("more information");
  });
});

test.describe("/check/life-event", () => {
  test("CA + job_loss renders the bounded-benefit timeline", async ({ page }) => {
    await page.goto("/check/life-event?jurisdiction=ca&event=job_loss");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("life-event-ei-result")).toBeVisible();
    await expect(page.getByTestId("benefit-timeline")).toBeVisible();
    // Progressbar is the a11y-load-bearing element of the timeline.
    await expect(page.getByRole("progressbar")).toBeVisible();
  });

  test("JP + job_loss surfaces the no-EI message (architectural control)", async ({
    page,
  }) => {
    await page.goto("/check/life-event?jurisdiction=jp&event=job_loss");
    await page.waitForLoadState("networkidle");
    // JP has no EI manifest → the API returns programs=[] when filtered to
    // ei, so the page renders the no-EI explanation.
    await expect(page.getByTestId("life-event-no-ei")).toBeVisible();
  });

  test("axe AA scan: no critical violations on /check/life-event", async ({
    page,
  }) => {
    await page.goto("/check/life-event?jurisdiction=ca&event=job_loss");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
      critical,
      `critical a11y violations: ${critical.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
});
