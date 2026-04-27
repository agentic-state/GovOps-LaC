#!/usr/bin/env node
/**
 * Stricter, focused check for govops-014: every `impact.*` translation key
 * referenced in source must:
 *   1. exist in every locale file
 *   2. parse as valid ICU
 *   3. interpolate the same placeholder set across all locales
 *
 * Run via `prebuild` so a missing/malformed impact translation cannot reach
 * SSR. Exits with code 1 on any failure.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");
const MSG_DIR = join(SRC, "messages");

const locales = {};
for (const file of readdirSync(MSG_DIR)) {
  if (!file.endsWith(".json")) continue;
  locales[file.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(MSG_DIR, file), "utf8"));
}

// Collect referenced impact.* keys from source.
const sourceFiles = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "messages") continue;
      walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      sourceFiles.push(full);
    }
  }
}
walk(SRC);

const FM_RE = /(?:formatMessage\(\s*\{\s*id:\s*|<FormattedMessage[^>]*\bid=)["'`](impact\.[a-zA-Z0-9_.\-]+)["'`]/g;
const used = new Set();
for (const file of sourceFiles) {
  for (const m of readFileSync(file, "utf8").matchAll(FM_RE)) used.add(m[1]);
}

let failures = 0;
function fail(msg) {
  console.error(`✗ ${msg}`);
  failures += 1;
}

// Extract placeholders ({foo}, {n, plural,...}, etc.) by parsing.
function placeholdersOf(text) {
  const ast = parse(text);
  const set = new Set();
  function visit(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== "object") return;
    if ("value" in node && typeof node.value === "string" && node.type === 1 /* argument */)
      set.add(node.value);
    if (node.type === 6 /* plural */ || node.type === 5 /* select */) set.add(node.value);
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (k === "options" && v && typeof v === "object") {
        for (const opt of Object.values(v)) visit(opt.value);
      } else if (typeof v === "object") {
        visit(v);
      }
    }
  }
  visit(ast);
  return set;
}

for (const id of [...used].sort()) {
  const perLocale = {};
  for (const [loc, msgs] of Object.entries(locales)) {
    if (!(id in msgs)) {
      fail(`[${loc}] missing key: ${id}`);
      continue;
    }
    const value = msgs[id];
    if (typeof value !== "string") {
      fail(`[${loc}] ${id}: value is not a string`);
      continue;
    }
    try {
      perLocale[loc] = placeholdersOf(value);
    } catch (e) {
      fail(`[${loc}] ${id}: malformed ICU — ${e.message}`);
    }
  }
  // cross-locale placeholder set must match the English baseline
  const base = perLocale.en;
  if (!base) continue;
  for (const [loc, set] of Object.entries(perLocale)) {
    if (loc === "en") continue;
    const missing = [...base].filter((p) => !set.has(p));
    const extra = [...set].filter((p) => !base.has(p));
    if (missing.length || extra.length) {
      fail(
        `[${loc}] ${id}: placeholder mismatch (missing: [${missing.join(",")}], extra: [${extra.join(",")}])`,
      );
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} impact i18n problem(s) found.`);
  process.exit(1);
}
console.log(`✓ impact.* i18n OK across ${Object.keys(locales).length} locale(s) (${used.size} keys).`);
