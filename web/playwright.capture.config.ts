import { defineConfig, devices } from "@playwright/test";

/**
 * Standalone Playwright config used ONLY for the screenshot-capture spec
 * under `web/capture/`. Reuses the same backend + frontend orchestration as
 * the main E2E config, but runs chromium-only and writes PNGs into a
 * permanent location (committed under `docs/screenshots/v2/`).
 *
 * Usage:
 *   cd web && npx playwright test -c playwright.capture.config.ts
 *
 * The regular E2E config (`playwright.config.ts`) is unaffected; the capture
 * spec lives in `./capture/` and is invisible to the standard `npm run test:e2e`.
 */

const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "17765";
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? "17081";
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: "./capture",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results-capture",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONTEND_URL,
    trace: "off",
    screenshot: "off",
    video: "off",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `python -m uvicorn govops.api:app --port ${BACKEND_PORT} --log-level warning`,
      cwd: "..",
      url: `${BACKEND_URL}/api/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        GOVOPS_DB_PATH: process.env.E2E_DB_PATH ?? "var/govops-capture.db",
        GOVOPS_SEED_DEMO: "1",
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: BACKEND_URL,
      },
    },
  ],
});
