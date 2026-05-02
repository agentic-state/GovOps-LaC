import { defineConfig, devices } from "@playwright/test";

/**
 * Test-bench config for running the full journey catalog against any
 * deployed GovOps instance (HF Space, future deploys, partner forks).
 *
 * Usage:
 *   TEST_BENCH_TARGET=https://agentic-state-govops-lac.hf.space \
 *     npx playwright test --config=playwright.deploy.config.ts
 *
 * Defaults to the canonical HF Space if TEST_BENCH_TARGET is unset.
 *
 * Differences from the local playwright.config.ts:
 *   - No webServer block — the target is remote
 *   - baseURL points at TEST_BENCH_TARGET
 *   - Same-origin API: BACKEND === FRONTEND (HF serves both from one process)
 *   - Cold-start tolerance: longer navigation timeout
 *   - Custom journey-reporter writes structured per-journey JSON for the
 *     run-record aggregator (web/scripts/build-run-record.mjs)
 */

const TARGET = (process.env.TEST_BENCH_TARGET ?? "https://agentic-state-govops-lac.hf.space").replace(/\/$/, "");
// Existing specs that bypass the api fixture and raw-fetch the backend
// (configure-without-deploy.spec.ts, approval-actions.spec.ts) read
// E2E_BACKEND_URL directly. Bridge it to the deploy target so they hit HF.
if (!process.env.E2E_BACKEND_URL) process.env.E2E_BACKEND_URL = TARGET;
const isCI = !!process.env.CI;
const browsersEnv = process.env.TEST_BENCH_BROWSERS ?? "chromium";
const browsers = new Set(browsersEnv.split(",").map((b) => b.trim()).filter(Boolean));

const allProjects = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 1,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-deploy", open: "never" }],
    ["json", { outputFile: "test-results-deploy/report.json" }],
    ["./e2e/reporters/journey-reporter.ts"],
  ],
  outputDir: "test-results-deploy",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: TARGET,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    extraHTTPHeaders: process.env.GOVOPS_ADMIN_TOKEN
      ? { "X-Govops-Admin-Token": process.env.GOVOPS_ADMIN_TOKEN }
      : undefined,
  },
  projects: allProjects.filter((p) => browsers.has(p.name)),
});
