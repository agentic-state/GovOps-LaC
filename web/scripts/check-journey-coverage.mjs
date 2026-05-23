#!/usr/bin/env node
/**
 * Journey-coverage gate.
 *
 * For every route that imports a mutation hook from `src/lib/api.ts`,
 * require at least one E2E spec file under `e2e/journeys/` that
 * navigates to that route via `page.goto(...)`.
 *
 * Why this exists: the 2026-05-07 mutation-flow regression (PR #21,
 * surfaced via manual click-through on the live HF deploy) was a class
 * of bug where the API + the page-render smoke both passed, but the
 * UI-driven mutation flow was broken. Bench tests + render-only E2E
 * could not catch it because they did not click buttons.
 *
 * This gate is the structural follow-up: a new mutation surface lands
 * without a spec exercising it -> CI fails before E2E even runs.
 *
 * Mutation patterns tracked (journey-coverage convention):
 *   approve*, reject*, requestChangesOnDraft, createDraft, commit*,
 *   set*Enabled, fetch*Pack, fetchEvaluation*, reviewCase, submit*,
 *   bulkReview*, bulkApprove*, fetchFederationPack
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = dirname(HERE);
const ROUTES_DIR = join(WEB_ROOT, "src", "routes");
const SPECS_DIR = join(WEB_ROOT, "e2e", "journeys");

const MUTATION_NAME_PATTERN =
  /\b(approveDraft|rejectDraft|requestChangesOnDraft|createDraft|commitBatch|setFederationPackEnabled|fetchFederationPack|reviewCase|reviewProposal|bulkReviewProposals|createEncodingBatch|setPromptDraft|approvePromptDraft|rejectPromptDraft|switchJurisdiction)\b/g;

function listFiles(dir, suffix) {
  const out = [];
  const walk = (p) => {
    for (const entry of readdirSync(p)) {
      const full = join(p, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(suffix)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * Map a TanStack flat-dot route filename to its URL path.
 * Examples:
 *   admin.federation.tsx -> /admin/federation
 *   cases.$caseId.tsx -> /cases/$caseId
 *   compare.$programId.tsx -> /compare/$programId
 *   index.tsx -> /
 *   __root.tsx -> (skip)
 *   admin.index.tsx -> /admin (the parent's index path, not /admin/index)
 *   config.prompts.$key.$jurisdictionId.edit.tsx -> /config/prompts/$key/$jurisdictionId/edit
 */
function routePathFromFilename(filename) {
  const base = basename(filename, ".tsx");
  if (base === "__root") return null;
  if (base === "index") return "/";
  // TanStack flat-dot: a trailing ".index" segment is the parent's
  // index path. admin.index.tsx -> /admin (not /admin/index).
  const segs = base.split(".");
  if (segs.length > 1 && segs[segs.length - 1] === "index") {
    segs.pop();
  }
  return "/" + segs.join("/");
}

/**
 * Read a spec file and return the set of routes it navigates to via
 * page.goto("..."). We capture the *literal-prefix* of the goto path
 * (everything up to a backtick interpolation or a query string) so a
 * spec doing `page.goto(\`/cases/\${id}\`)` covers the /cases/$caseId
 * route.
 */
function gotoRoutes(specSource) {
  const out = new Set();
  // Match page.goto("..."), page.goto('...'), page.goto(`...`).
  const re = /page\.goto\(\s*([`'"])([^`'"]*?)(?=[`'"$?])/g;
  let m;
  while ((m = re.exec(specSource)) !== null) {
    const path = m[2];
    if (path.startsWith("/")) out.add(path);
  }
  return out;
}

/**
 * Match a goto'd path against a route pattern.
 *  - Exact match: /cases/abc matches /cases/$caseId
 *  - Trailing-$param match: /cases/ matches /cases/$caseId (the regex
 *    captures everything before a `${...}` interpolation, so a goto
 *    like \`/cases/\${id}\` arrives as the literal "/cases/")
 *  - Prefix match: /cases matches /cases (own route)
 *  - $param matches any non-slash segment
 */
function gotoMatchesRoute(goto, route) {
  // Drop any single trailing slash on the goto -- it just means an
  // interpolation came next, which corresponds to a route $param.
  const gotoTrim = goto.length > 1 && goto.endsWith("/") ? goto.slice(0, -1) : goto;
  const gotoSegs = gotoTrim.split("/").filter(Boolean);
  const routeSegs = route.split("/").filter(Boolean);
  if (route === "/") return goto === "/";
  if (gotoSegs.length > routeSegs.length) return false;
  // gotoSegs must be a prefix of routeSegs, with $params matching anything.
  for (let i = 0; i < gotoSegs.length; i++) {
    const r = routeSegs[i];
    const g = gotoSegs[i];
    if (r.startsWith("$")) continue;
    if (r !== g) return false;
  }
  // Any remaining route segments must all be $params (else the goto
  // does not actually navigate to this specific route depth).
  for (let i = gotoSegs.length; i < routeSegs.length; i++) {
    if (!routeSegs[i].startsWith("$")) return false;
  }
  return true;
}

function main() {
  const routeFiles = listFiles(ROUTES_DIR, ".tsx");
  const specFiles = listFiles(SPECS_DIR, ".spec.ts");

  // Build the set of {route, mutations} for every route that calls one
  // or more mutation functions.
  const mutationRoutes = [];
  for (const f of routeFiles) {
    const route = routePathFromFilename(f);
    if (!route) continue;
    const src = readFileSync(f, "utf8");
    const matches = new Set();
    let m;
    MUTATION_NAME_PATTERN.lastIndex = 0;
    while ((m = MUTATION_NAME_PATTERN.exec(src)) !== null) {
      matches.add(m[1]);
    }
    if (matches.size > 0) {
      mutationRoutes.push({ route, file: f, mutations: [...matches] });
    }
  }

  // For every spec file, collect its goto'd routes.
  const specGotos = [];
  for (const f of specFiles) {
    const src = readFileSync(f, "utf8");
    const gotos = gotoRoutes(src);
    if (gotos.size > 0) specGotos.push({ file: f, gotos: [...gotos] });
  }

  // Cross-reference: every mutation route must have >= 1 spec gotoing it.
  let failures = 0;
  const lines = [];
  lines.push("Journey coverage gate -- mutation-route -> spec map");
  lines.push("=".repeat(70));
  for (const r of mutationRoutes) {
    const covering = specGotos.filter((s) => s.gotos.some((g) => gotoMatchesRoute(g, r.route)));
    const status = covering.length > 0 ? "OK" : "MISSING";
    if (covering.length === 0) failures += 1;
    lines.push(`[${status}] ${r.route}`);
    lines.push(`        mutations: ${r.mutations.join(", ")}`);
    if (covering.length > 0) {
      lines.push(`        covered by: ${covering.map((c) => basename(c.file)).join(", ")}`);
    } else {
      lines.push(`        no E2E spec navigates to this route`);
    }
  }
  lines.push("");
  lines.push(`Routes with mutations: ${mutationRoutes.length}`);
  lines.push(`Uncovered:             ${failures}`);
  console.log(lines.join("\n"));

  if (failures > 0) {
    console.error(`\nFAIL: ${failures} mutation route(s) without an E2E spec.`);
    console.error(
      "Add a spec under web/e2e/journeys/ that calls page.goto('<route>') and drives the mutation.",
    );
    process.exit(1);
  }
}

main();
