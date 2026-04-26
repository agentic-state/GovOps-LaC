#!/usr/bin/env node
/**
 * Verifies that every translation key referenced in source via
 *   intl.formatMessage({ id: "..." })
 *   <FormattedMessage id="..." />
 * exists in every locale file under src/messages/*.json.
 *
 * Exits with code 1 if any key is missing in any locale.
 *
 * Usage:  node scripts/check-i18n-keys.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");
const MSG_DIR = join(SRC, "messages");

const locales = {};
for (const file of readdirSync(MSG_DIR)) {
  if (!file.endsWith(".json")) continue;
  const name = file.replace(/\.json$/, "");
  locales[name] = JSON.parse(readFileSync(join(MSG_DIR, file), "utf8"));
}

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

// Match formatMessage({ id: "x.y[.z]" }) — require a dot to avoid matching
// data object ids like { id: "p-001" }.
const FM_CALL_RE = /formatMessage\(\s*\{\s*id:\s*["'`]([a-zA-Z0-9_.\-]+\.[a-zA-Z0-9_.\-]+)["'`]/g;
const FM_TAG_RE = /<FormattedMessage[^>]*\bid=["'`]([a-zA-Z0-9_.\-]+\.[a-zA-Z0-9_.\-]+)["'`]/g;

const used = new Set();
for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(FM_CALL_RE)) used.add(m[1]);
  for (const m of text.matchAll(FM_TAG_RE)) used.add(m[1]);
}

let failures = 0;
for (const [loc, msgs] of Object.entries(locales)) {
  const missing = [];
  for (const id of used) {
    if (!(id in msgs)) missing.push(id);
  }
  if (missing.length) {
    failures += missing.length;
    console.error(`\n[i18n] Locale "${loc}" missing ${missing.length} key(s):`);
    for (const k of missing.sort()) console.error(`  - ${k}`);
  }
}

if (failures > 0) {
  console.error(`\n✗ i18n check failed: ${failures} missing key reference(s).`);
  process.exit(1);
}
console.log(`✓ i18n check passed: ${used.size} keys present in all ${Object.keys(locales).length} locales.`);