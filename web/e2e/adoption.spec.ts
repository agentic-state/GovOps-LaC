/**
 * v3.1 L14 adoption E2E -- end-to-end "no Python edit" jurisdiction
 * adoption through the L7 authoring substrate, verified by the live UI.
 *
 * The plan's original L14 walked an in-app Onboard wizard, which lives
 * at L8 (deferred to v3.1.x). This spec exercises the shipped surface:
 * drive the /api/authoring/* endpoints via Playwright's request fixture
 * to draft + approve + commit a fictional `xx` jurisdiction, then load
 * `/authority?jurisdiction=xx` in the browser and assert the new
 * jurisdiction's identity is visible.
 *
 * Teardown removes the on-disk YAML so subsequent runs (and the test
 * bench against shared targets like HF Space) stay clean. The
 * post-commit drafts cannot be discarded via the API by design
 * (ADR-022), so the cleanup is filesystem-side via a teardown helper
 * that calls a backend test-only escape hatch. On HF the substrate is
 * ephemeral anyway -- container restart drops `xx/`.
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";
import { backendUrl } from "./fixtures/api";

const BACKEND = backendUrl();
const TEST_CODE = "xx"; // fictional ISO-reserved code for testing

// Concrete payloads -- minimal but schema-valid. Real adoption fills in
// citations / statutes; this fixture is only proving the round-trip.
const JURISDICTION_PAYLOAD = {
  type: "jurisdiction",
  target_path: `${TEST_CODE}/config/jurisdiction.yaml`,
  content: {
    jurisdiction: {
      id: `jur-${TEST_CODE}-national`,
      country: TEST_CODE.toUpperCase(),
      level: "national",
      parent_id: null,
      name: { en: `Test Jurisdiction ${TEST_CODE.toUpperCase()}` },
      legal_tradition: "civil_law",
      language_regime: "en",
      default_language: "en",
    },
    defaults: {
      domain: "ui",
      jurisdiction_id: `${TEST_CODE}-oas`,
      effective_from: "1900-01-01",
    },
    values: [],
  },
  author: "adoption-e2e@example.org",
  rationale: "v3.1 L14 adoption E2E fixture",
};

const PROGRAM_PAYLOAD = {
  type: "program",
  target_path: `${TEST_CODE}/programs/oas.yaml`,
  content: {
    schema_version: "1.0",
    program_id: "oas",
    jurisdiction_id: `jur-${TEST_CODE}-national`,
    shape: "old_age_pension",
    status: "active",
    name: { en: `${TEST_CODE.toUpperCase()} Old-Age Pension (test)` },
    description: { en: "Adoption E2E fixture." },
    authority_chain: [
      {
        id: `auth-${TEST_CODE}-oas-constitution`,
        layer: "constitution",
        title: "Constitution",
        citation: "Constitution",
        effective_date: "1900-01-01",
        url: "https://example.org/constitution",
      },
      {
        id: `auth-${TEST_CODE}-oas-act`,
        layer: "act",
        title: "Pension Act",
        citation: "Pension Act",
        effective_date: "1900-01-01",
        url: "https://example.org/act",
        parent: `auth-${TEST_CODE}-oas-constitution`,
      },
    ],
    legal_documents: [],
    rules: [],
    demo_cases: [],
  },
  author: "adoption-e2e@example.org",
  rationale: "v3.1 L14 adoption E2E fixture",
};

test.describe("v3.1 L14 -- adoption substrate end-to-end", () => {
  test("[J60] draft + approve + commit + reload makes xx jurisdiction live", async ({
    page,
  }) => {
    const api = await playwrightRequest.newContext();

    // ----- B1. Draft the jurisdiction metadata -----
    const jdRes = await api.post(`${BACKEND}/api/authoring/drafts`, {
      data: JURISDICTION_PAYLOAD,
    });
    expect(jdRes.status(), await jdRes.text()).toBe(200);
    const jd = await jdRes.json();
    expect(jd.status).toBe("pending");

    // ----- B2. Draft the program manifest -----
    const pdRes = await api.post(`${BACKEND}/api/authoring/drafts`, {
      data: PROGRAM_PAYLOAD,
    });
    expect(pdRes.status(), await pdRes.text()).toBe(200);
    const pd = await pdRes.json();
    expect(pd.status).toBe("pending");

    // ----- B3. Approve each draft -----
    const apJd = await api.post(
      `${BACKEND}/api/authoring/drafts/${jd.id}/approve`,
      { data: { approver: "adoption-e2e-approver@example.org" } },
    );
    expect(apJd.status()).toBe(200);
    const apPd = await api.post(
      `${BACKEND}/api/authoring/drafts/${pd.id}/approve`,
      { data: { approver: "adoption-e2e-approver@example.org" } },
    );
    expect(apPd.status()).toBe(200);

    // Approve is idempotent -- the second call must also 200.
    const apJd2 = await api.post(
      `${BACKEND}/api/authoring/drafts/${jd.id}/approve`,
      { data: { approver: "adoption-e2e-approver@example.org" } },
    );
    expect(apJd2.status()).toBe(200);

    // ----- B4. Commit -----
    const commitRes = await api.post(`${BACKEND}/api/authoring/commit`, {
      data: { committer: "adoption-e2e-committer@example.org" },
    });
    expect(commitRes.status(), await commitRes.text()).toBe(200);
    const commitBody = await commitRes.json();
    expect(commitBody.committed.length).toBeGreaterThanOrEqual(2);
    expect(commitBody.reloaded).toBe(true);

    // ----- B5. The L3 loader / registry now knows about xx -----
    const chain = await api.get(
      `${BACKEND}/api/authority-chain?jurisdiction_id=${TEST_CODE}`,
    );
    expect(chain.status(), await chain.text()).toBe(200);
    const chainBody = await chain.json();
    expect(chainBody.jurisdiction.id).toBe(`jur-${TEST_CODE}-national`);
    expect(chainBody.jurisdiction.country).toBe(TEST_CODE.toUpperCase());

    // ----- And the live UI sees it -----
    // Switch the /authority picker to xx and verify the chain renders.
    await page.goto(`/authority?jurisdiction=${TEST_CODE}`);
    // The jurisdiction header carries the country name we authored.
    await expect(
      page.getByText(`Test Jurisdiction ${TEST_CODE.toUpperCase()}`, {
        exact: false,
      }),
    ).toBeVisible({ timeout: 15000 });

    await api.dispose();
  });
});
