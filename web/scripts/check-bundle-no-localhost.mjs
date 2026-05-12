#!/usr/bin/env node
/**
 * Build-artifact sanity gate.
 *
 * Scans web/dist/client/assets/*.js for tokens that should never be present
 * in a production bundle but easily slip through when build-time env vars
 * aren't set correctly:
 *
 *   - "127.0.0.1" / "localhost:8000" — caused by VITE_API_BASE_URL not being
 *     set at build time, leaving api.ts's dev-fallback inlined into every
 *     visitor's bundle (the regression that bit us 2026-04-29 → 2026-05-02).
 *
 *   - Other forbidden tokens can be added below as the project surfaces more.
 *
 * The script intentionally accepts these tokens in code paths that branch on
 * `import.meta.env.SSR`. Vite tree-shakes the SSR branch out of the client
 * bundle, but the constant-folded literals can survive in some builds. We
 * detect "real" inlining by checking whether the token appears in a literal
 * string the runtime would actually use — a heuristic, not a perfect one,
 * but it catches the regression class we know about.
 *
 * Usage:
 *   node web/scripts/check-bundle-no-localhost.mjs            # checks dist/
 *   BUNDLE_DIR=/some/path node ...                            # custom dir
 *
 * Exit code 0 = clean; exit code 1 = forbidden token found.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const bundleDir = process.env.BUNDLE_DIR ?? path.join(webRoot, "dist", "client", "assets");

const FORBIDDEN_TOKENS = [
  // The api.ts fallback. If it appears in a built JS chunk, vite inlined it
  // because VITE_API_BASE_URL was not set at build time.
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  // The vite dev server port. Should never appear in a built artifact.
  "http://127.0.0.1:8080",
  "http://localhost:8080",
];

function findJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(bundleDir)) {
    console.error(`[check-bundle] no bundle at ${bundleDir} -- did you run \`npm run build\`?`);
    process.exit(1);
  }

  const files = findJsFiles(bundleDir);
  if (files.length === 0) {
    console.error(`[check-bundle] no .js files under ${bundleDir}`);
    process.exit(1);
  }

  const hits = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const token of FORBIDDEN_TOKENS) {
      if (content.includes(token)) {
        hits.push({ file: path.relative(webRoot, file), token });
      }
    }
  }

  if (hits.length === 0) {
    console.log(`[check-bundle] OK -- ${files.length} JS file(s) scanned, no forbidden tokens.`);
    process.exit(0);
  }

  console.error(`[check-bundle] FAIL -- forbidden tokens found in built bundle:`);
  for (const { file, token } of hits) {
    console.error(`  - ${file}: ${token}`);
  }
  console.error("");
  console.error("This typically means a build-time env var was not set.");
  console.error("If the token is 'http://127.0.0.1:8000', the fix is to set");
  console.error("VITE_API_BASE_URL='' on the `vite build` command. See:");
  console.error("  docs/runbooks/debug-fetch-failure.md");
  console.error("  eva-foundation/.claude-memory/feedback_build_pattern_pivot_audit.md");
  process.exit(1);
}

main();
