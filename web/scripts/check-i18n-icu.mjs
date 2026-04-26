#!/usr/bin/env node
/**
 * Parses every ICU message string in src/messages/*.json and fails fast on
 * syntax errors (UNCLOSED_TAG, malformed plural/select, mismatched braces, …).
 *
 * Runs before `vite build` via the `prebuild` script, so a malformed message
 * cannot reach SSR.
 *
 * Exits with code 1 on any parse error.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";

const MSG_DIR = resolve(process.cwd(), "src/messages");

let errorCount = 0;
const files = readdirSync(MSG_DIR).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const locale = file.replace(/\.json$/, "");
  const raw = readFileSync(join(MSG_DIR, file), "utf8");
  let messages;
  try {
    messages = JSON.parse(raw);
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON — ${e.message}`);
    errorCount += 1;
    continue;
  }

  for (const [key, value] of Object.entries(messages)) {
    if (typeof value !== "string") {
      console.error(`✗ [${locale}] ${key}: value is not a string (${typeof value})`);
      errorCount += 1;
      continue;
    }
    try {
      parse(value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`✗ [${locale}] ${key}: ${msg}`);
      console.error(`    value: ${JSON.stringify(value)}`);
      errorCount += 1;
    }
  }
}

if (errorCount > 0) {
  console.error(`\n${errorCount} ICU syntax error(s) found.`);
  process.exit(1);
}

console.log(`✓ ICU syntax OK across ${files.length} locale file(s).`);