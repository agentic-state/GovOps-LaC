#!/usr/bin/env node
/**
 * Translation parity check — flags non-EN locale values that are byte-identical
 * to the EN source for substantive strings (>1 char with at least 2 alphabetic
 * chars). Catches the silent-copy-paste failure mode that key-parity and ICU
 * checks cannot catch: a translator (or Lovable) duplicates en.json into
 * fr.json verbatim and ships untranslated copy.
 *
 * Allowlist: `web/scripts/i18n-translation-allowlist.json`. Two scopes:
 *
 *   - `global_keys`  — keys allowed to match EN in every non-EN locale (brand
 *                       tokens, dev-only strings, ICU-only placeholders, etc.).
 *   - `per_locale_keys[locale]` — keys allowed to match EN in that specific
 *                                  locale (legitimate cognates / loanwords;
 *                                  e.g. `Status` in DE is a valid loan, but in
 *                                  UK it would need translation).
 *
 * Adding new copy-paste-from-EN cases requires a deliberate edit to the
 * allowlist. See docs/i18n-rounds/README.md §"Legitimate copy-paste residue"
 * for the canonical taxonomy of what belongs in which scope.
 *
 * Exits with code 1 on any unallowed match.
 *
 * Wired into `prebuild` so a regression cannot reach SSR.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MSG_DIR = resolve(process.cwd(), "src/messages");
const ALLOWLIST_PATH = resolve(process.cwd(), "scripts/i18n-translation-allowlist.json");

const LOCALES = ["fr", "de", "es-MX", "pt-BR", "uk"];

function isSubstantive(s) {
  // Trigger the check only for strings that look like prose / words.
  // Short symbols, sigils, ICU-only placeholders are not "untranslated copy"
  // even when byte-identical across locales.
  if (typeof s !== "string") return false;
  if (s.length <= 1) return false;
  if (!/[a-zA-Z]{2,}/.test(s)) return false;
  return true;
}

const en = JSON.parse(readFileSync(join(MSG_DIR, "en.json"), "utf8"));
const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));

const globalKeys = new Set(allowlist.global_keys ?? []);
const perLocaleKeys = Object.fromEntries(
  Object.entries(allowlist.per_locale_keys ?? {}).map(([loc, keys]) => [loc, new Set(keys)]),
);

let violations = 0;
const violationsByLocale = {};

for (const locale of LOCALES) {
  const path = join(MSG_DIR, `${locale}.json`);
  const cat = JSON.parse(readFileSync(path, "utf8"));
  const localAllowed = perLocaleKeys[locale] ?? new Set();
  const flagged = [];

  for (const [key, enVal] of Object.entries(en)) {
    if (typeof enVal !== "string") continue;
    if (cat[key] !== enVal) continue;
    if (!isSubstantive(enVal)) continue;
    if (globalKeys.has(key)) continue;
    if (localAllowed.has(key)) continue;
    flagged.push({ key, value: enVal });
    violations += 1;
  }

  if (flagged.length > 0) {
    violationsByLocale[locale] = flagged;
  }
}

if (violations === 0) {
  console.log(`✓ i18n translation check passed: every substantive non-EN value differs from EN (or is allowlisted).`);
  process.exit(0);
}

console.error(`\n✗ i18n translation check failed: ${violations} substantive value(s) match EN without being allowlisted.\n`);

for (const [locale, flagged] of Object.entries(violationsByLocale)) {
  console.error(`  [${locale}] ${flagged.length} unallowed match(es):`);
  for (const { key, value } of flagged) {
    const display = value.length > 60 ? value.slice(0, 57) + "…" : value;
    console.error(`    ${key}  =  ${JSON.stringify(display)}`);
  }
  console.error("");
}

console.error(
  "Resolution:\n" +
    "  • Translate the value in the offending locale catalog, OR\n" +
    "  • Add the key to web/scripts/i18n-translation-allowlist.json (global_keys for\n" +
    "    every-locale exceptions like brand tokens; per_locale_keys[<loc>] for\n" +
    "    locale-specific cognates / loanwords).\n" +
    "\n" +
    "See docs/i18n-rounds/README.md for the legitimate-residue taxonomy.\n",
);

process.exit(1);
