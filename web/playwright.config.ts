import { defineConfig, devices } from "@playwright/test";

// Uncommon ports so we don't collide with a developer's running govops-demo
// (default :8000) or vite dev (default :8080). reuseExistingServer:false
// further guards against picking up a stale dev server that didn't get the
// VITE_API_BASE_URL env passed through.
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "17765";
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? "17081";
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // SQLite is single-writer; serial keeps state predictable
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1, // serial — single backend process per run
  reporter: isCI
    ? [["list"], ["html", { open: "never" }], ["junit", { outputFile: "test-results/junit.xml" }]]
    : [["html", { open: "never" }], ["list"]],
  outputDir: "test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: `python -m uvicorn govops.api:app --port ${BACKEND_PORT} --log-level warning`,
      cwd: "..",
      url: `${BACKEND_URL}/api/health`,
      timeout: 60_000,
      reuseExistingServer: false, // always start fresh so seed runs cleanly
      env: {
        GOVOPS_DB_PATH: process.env.E2E_DB_PATH ?? "var/govops-e2e.db",
        GOVOPS_SEED_DEMO: "1",
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      timeout: 60_000,
      reuseExistingServer: false, // never reuse — guards against a stale dev server that didn't get VITE_API_BASE_URL
      env: {
        VITE_API_BASE_URL: BACKEND_URL,
      },
    },
  ],
});
