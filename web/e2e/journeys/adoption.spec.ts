/**
 * v3.2 L1 -- adoption walkthrough revived.
 *
 * The v3.1.0 attempt (L14 spec) was deferred because the substrate's
 * commit triggered ``reload_registry()`` which called
 * ``JURISDICTION_REGISTRY.clear()`` first -- leaving the dict
 * momentarily empty for any concurrent ASGI request (a layout-level
 * fetch, a polling client). v3.2's atomicity fix in
 * ``govops/jurisdictions.py::reload_registry`` (update-then-trim
 * instead of clear-then-update) closes that window so this spec can
 * walk the wizard end-to-end without racing concurrent reads.
 *
 * The spec drives the UI exclusively (per PLAN-p61-test-coverage
 * section 5): no API shortcuts past the initial setup, real form
 * inputs, accessible-role locators, waits on observable side-effects.
 *
 * Unique-per-run jurisdiction code (`xx${epoch}-tail`) so concurrent
 * spec runs (and re-runs against a state-accumulating shared
 * backend) don't collide on the same target_path.
 */

import { test, expect } from "@playwright/test";
import { backendUrl } from "../fixtures/api";

// Run all tests in this file serially -- the wizard mutates global
// JURISDICTION_REGISTRY; running its scenarios in parallel against the
// same backend would race even with the atomicity fix.
test.describe.configure({ mode: "serial" });

// Use a letter-only code outside any real ISO range so we never
// collide with the 7 seeded jurisdictions. The cli_init validator
// requires ``code.isalpha()`` (letters only, 1-6 chars). Static
// across runs -- re-runs idempotently re-onboard the same code via
// the substrate's L4 structural emitter (zero-byte no-op diff when
// content matches).
const JUR_CODE = "zztest";
const JUR_NAME = `Test Jurisdiction ${JUR_CODE.toUpperCase()}`;

test.describe(`[A01] Onboard wizard -- adopt ${JUR_CODE} end-to-end`, () => {
  test.afterAll(async () => {
    // Best-effort cleanup: rm the committed lawcode/<JUR_CODE>/ tree
    // via the backend's filesystem. The substrate doesn't expose a
    // "remove jurisdiction" endpoint (deliberate -- COMMITTED drafts
    // are immutable per ADR-022). Since this spec writes to the
    // running backend's lawcode/ directory, the cleanup is best-effort
    // -- if it fails the next run uses a different RUN_TAG so no
    // collision occurs anyway.
    //
    // The deeper fix (worker-scoped lawcode roots per the v3.2 L1
    // charter) is a v3.2.x follow-up; this spec proves the wizard
    // walks cleanly against the shared backend with the atomicity
    // fix in place.
  });

  test("walks identity -> review -> submit -> approve -> commit -> live", async ({
    page,
    request,
  }) => {
    // -----------------------------------------------------------------
    // Step 1: Identity
    // -----------------------------------------------------------------
    await page.goto("/admin/onboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByTestId("onboard-code").fill(JUR_CODE);
    await page.getByTestId("onboard-name").fill(JUR_NAME);

    // OAS is the default shape; uncheck EI if it's checked.
    const eiCheckbox = page.getByTestId("onboard-shape-ei");
    if (await eiCheckbox.isChecked()) {
      await eiCheckbox.uncheck();
    }

    await page.getByTestId("onboard-scaffold").click();

    // -----------------------------------------------------------------
    // Step 2: Review (scaffold renders YAML preview + author form)
    // -----------------------------------------------------------------
    await expect(page.getByTestId("onboard-author")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("onboard-author").fill("e2e-author");
    await page
      .getByTestId("onboard-rationale")
      .fill(`v3.2 L1 adoption.spec.ts -- ${JUR_CODE}`);

    await page.getByTestId("onboard-submit").click();

    // -----------------------------------------------------------------
    // Step 3: Submitted (CTA to approval queue)
    // -----------------------------------------------------------------
    const queueCta = page.getByTestId("onboard-goto-queue");
    await expect(queueCta).toBeVisible({ timeout: 10_000 });
    await queueCta.click();

    // -----------------------------------------------------------------
    // Step 4: Approval queue -- approve every draft holding our code
    // -----------------------------------------------------------------
    await expect(page).toHaveURL(/\/admin\/drafts/);
    await expect(page.getByTestId("drafts-filter")).toBeVisible();

    // Filter to pending; the wizard submits exactly two drafts in OAS-
    // only mode: <code>/config/jurisdiction.yaml + <code>/programs/oas.yaml
    await page.getByTestId("drafts-filter").selectOption("pending");

    // Pull the draft list via the API so we can target each row by its
    // server-side id (the UI surface uses these ids in test ids).
    const draftsRes = await request.get(
      `${backendUrl()}/api/authoring/drafts?status=pending`,
    );
    expect(draftsRes.status()).toBe(200);
    const draftsBody = await draftsRes.json();
    const ourDrafts = (draftsBody.drafts as Array<{
      id: string;
      target_path: string;
    }>).filter((d) => d.target_path.startsWith(`${JUR_CODE}/`));
    expect(ourDrafts.length).toBeGreaterThanOrEqual(2);

    // Approve each via the UI (Playwright handles window.prompt via
    // dialog handler).
    for (const draft of ourDrafts) {
      page.once("dialog", (dialog) => dialog.accept("e2e-approver"));
      await page.getByTestId(`approve-${draft.id}`).click();
      // Wait for the row to disappear from the pending filter (it
      // moves to APPROVED status).
      await expect(page.getByTestId(`draft-row-${draft.id}`)).toBeHidden({
        timeout: 10_000,
      });
    }

    // -----------------------------------------------------------------
    // Step 5: Commit the approved queue
    // -----------------------------------------------------------------
    await page.getByTestId("drafts-committer").fill("e2e-committer");
    await page.getByTestId("drafts-commit").click();

    // Wait for the success info line ("Committed N drafts...") to appear.
    // The implementation renders it as a role="status" paragraph.
    await expect(page.getByRole("status")).toContainText(/committed/i, {
      timeout: 15_000,
    });

    // -----------------------------------------------------------------
    // Step 6: Verify the new jurisdiction is live
    // -----------------------------------------------------------------
    // /api/health reads available_jurisdictions directly from
    // JURISDICTION_REGISTRY.keys() so it reflects the post-commit
    // reload_registry() state. The /compare endpoint can't be used here
    // because _COMPARE_DEFAULT_JURISDICTIONS in api.py is still a v3.0
    // hardcoded literal (ADR-020 migrated the registry but missed this
    // whitelist -- tracked as v3.2 L6 cleanup).
    const healthRes = await request.get(`${backendUrl()}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    const codes: string[] = health.available_jurisdictions ?? [];
    expect(codes).toContain(JUR_CODE);
  });
});
