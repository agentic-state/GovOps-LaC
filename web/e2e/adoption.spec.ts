/**
 * v3.1 L14 adoption E2E -- end-to-end "no Python edit" jurisdiction
 * adoption through the L7 authoring substrate, verified through the
 * /api/authoring/* and /api/authority-chain endpoints.
 *
 * The plan's original L14 walked an in-app Onboard wizard, which lives
 * at L8 (deferred to v3.1.x). This spec exercises the shipped surface:
 * drive the /api/authoring/* endpoints via Playwright's request fixture
 * to draft + approve + commit a fictional `xx` jurisdiction, then
 * verify the new identity is queryable through /api/authority-chain.
 *
 * Browser-side coverage of the freshly-committed jurisdiction is the
 * job of the L8 Onboard wizard E2E (v3.1.x); this spec keeps the
 * v3.1.0 verification scoped to what's actually shipped here -- the
 * substrate's draft / approve / commit / loader-reload round trip.
 *
 * Teardown removes the on-disk YAML so subsequent runs (and the test
 * bench against shared targets like HF Space) stay clean. The
 * post-commit drafts cannot be discarded via the API by design
 * (ADR-022), so the cleanup is filesystem-side via Node fs. On HF the
 * substrate is ephemeral anyway -- container restart drops `xx/`.
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";
import { existsSync, rmSync, unlinkSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { backendUrl } from "./fixtures/api";

const BACKEND = backendUrl();
const TEST_CODE = "xx"; // fictional ISO-reserved code for testing

// Resolve the repo root (this spec lives at web/e2e/) so we can clean up
// the committed YAML files the substrate writes during the test. The
// backend writes to <repo>/lawcode/xx/ via _LAWCODE_ROOT.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const XX_LAWCODE_DIR = join(REPO_ROOT, "lawcode", TEST_CODE);
const DRAFTS_DIR = join(REPO_ROOT, "lawcode", ".drafts");

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

function cleanupTestArtifacts() {
  // Remove the committed lawcode/xx/ tree.
  if (existsSync(XX_LAWCODE_DIR)) {
    rmSync(XX_LAWCODE_DIR, { recursive: true, force: true });
  }
  // Remove draft files that reference xx (their filename is a uuid hex
  // so we can't target by jurisdiction code; instead look inside and
  // drop drafts whose target_path starts with xx/).
  if (existsSync(DRAFTS_DIR)) {
    for (const name of readdirSync(DRAFTS_DIR)) {
      const full = join(DRAFTS_DIR, name);
      try {
        const { readFileSync } = require("node:fs");
        const text = readFileSync(full, "utf-8");
        if (text.includes(`target_path: ${TEST_CODE}/`)) {
          unlinkSync(full);
        }
      } catch {
        // ignore -- if we cannot inspect a file, leave it.
      }
    }
  }
}

test.describe("v3.1 L14 -- adoption substrate end-to-end", () => {
  test.afterAll(() => {
    cleanupTestArtifacts();
  });

  test("[J60] draft + approve + commit + reload makes xx jurisdiction live", async () => {
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
    expect(chainBody.jurisdiction.name).toBe(
      `Test Jurisdiction ${TEST_CODE.toUpperCase()}`,
    );
    // The xx code now appears in the available-jurisdictions list the
    // /authority picker hydrates from on first paint.
    const availableCodes = (
      chainBody.available_jurisdictions as Array<{ code: string }>
    ).map((j) => j.code);
    expect(availableCodes).toContain(TEST_CODE);

    await api.dispose();
  });
});
