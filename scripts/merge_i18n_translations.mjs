#!/usr/bin/env node
// One-shot merge of i18n-translations.json into web/src/messages/{locale}.json.
//
// Reads `i18n-translations.json` (303 keys × needed-locales, shape `{key: {locale: "..."}}`)
// and applies each translation to the corresponding locale catalog, preserving
// original key ordering (`fs.writeFile` writes the original JSON file with its
// values overwritten in place — no key reordering, no key additions, no key
// drops). Reports per-locale counts (touched / unchanged / missing-from-catalog).
//
// Pass the deliverable path as the first arg; otherwise the script auto-resolves
// to the most recent round under `docs/i18n-rounds/<YYYY-MM-DD>/i18n-translations.json`.
//
//   node scripts/merge_i18n_translations.mjs                                  # latest round
//   node scripts/merge_i18n_translations.mjs docs/i18n-rounds/2026-04-29/i18n-translations.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const messagesDir = path.join(repoRoot, "web", "src", "messages");
const LOCALES = ["fr", "de", "es-MX", "pt-BR", "uk"];

function resolveTranslationsPath() {
  const fromArg = process.argv[2];
  if (fromArg) return path.resolve(fromArg);
  const roundsDir = path.join(repoRoot, "docs", "i18n-rounds");
  if (!fs.existsSync(roundsDir)) {
    throw new Error(`no docs/i18n-rounds/ directory; pass the deliverable path explicitly`);
  }
  const dateDirs = fs
    .readdirSync(roundsDir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const d of dateDirs) {
    const candidate = path.join(roundsDir, d, "i18n-translations.json");
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`no i18n-translations.json found under any docs/i18n-rounds/<date>/ folder`);
}

const translationsPath = resolveTranslationsPath();
console.log("reading translations from " + path.relative(repoRoot, translationsPath) + "\n");

const translations = JSON.parse(fs.readFileSync(translationsPath, "utf8"));

const summary = {};

for (const locale of LOCALES) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  const catalog = JSON.parse(raw);
  const original = { ...catalog };

  let touched = 0;
  let unchanged = 0; // value already matches the proposed translation
  let missingFromCatalog = 0; // translation provided for a key the catalog doesn't have
  const dropped = [];

  for (const [key, byLocale] of Object.entries(translations)) {
    if (!(locale in byLocale)) continue;
    const proposed = byLocale[locale];
    if (!(key in catalog)) {
      missingFromCatalog++;
      dropped.push(key);
      continue;
    }
    if (catalog[key] === proposed) {
      unchanged++;
    } else {
      catalog[key] = proposed;
      touched++;
    }
  }

  // Preserve original key ordering by re-emitting via a fresh object that
  // walks `original` (which already has insertion-order = on-disk order).
  const ordered = {};
  for (const k of Object.keys(original)) ordered[k] = catalog[k];

  // Match the on-disk style: 1-space indent, trailing newline.
  const out = JSON.stringify(ordered, null, 1) + "\n";
  fs.writeFileSync(filePath, out, "utf8");

  summary[locale] = { touched, unchanged, missingFromCatalog, dropped };
}

console.log("merge complete\n");
console.log("locale  | touched | unchanged | missing-from-catalog");
console.log("--------|--------:|----------:|--------------------:");
for (const locale of LOCALES) {
  const s = summary[locale];
  console.log(
    `${locale.padEnd(8)}| ${String(s.touched).padStart(7)} | ${String(s.unchanged).padStart(9)} | ${String(s.missingFromCatalog).padStart(20)}`,
  );
}

const allDropped = new Set();
for (const locale of LOCALES) for (const k of summary[locale].dropped) allDropped.add(k);
if (allDropped.size > 0) {
  console.log(`\nKeys in translations but missing from at least one catalog (${allDropped.size}):`);
  for (const k of [...allDropped].sort()) console.log("  - " + k);
}
