#!/usr/bin/env node
/**
 * Build-time guard: parse src/routeTree.gen.ts and fail if any top-level
 * `const`/`interface`/`function` symbol is declared more than once. Stale
 * generated files have repeatedly produced "ScreenRoute has already been
 * declared" build failures; this check catches them before esbuild does
 * and prints a friendlier message.
 *
 * Skipped silently if the file does not exist yet (first-run / clean state).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "..", "src", "routeTree.gen.ts");

if (!existsSync(target)) {
  console.log("[check-route-tree-duplicates] no routeTree.gen.ts yet — skip");
  process.exit(0);
}

const src = readFileSync(target, "utf8");
// Track values and types in separate namespaces, since TS allows
// `interface Foo {}` + `const Foo: Foo = {}` to share a name.
const decl = /^\s*(?:export\s+)?(const|let|var|interface|type|function|class)\s+([A-Za-z_$][\w$]*)/gm;
const VALUE_KINDS = new Set(["const", "let", "var", "function", "class"]);
const TYPE_KINDS = new Set(["interface", "type"]);
const seen = new Map(); // `${ns}:${name}` -> [lineNumbers]

let m;
while ((m = decl.exec(src)) !== null) {
  const kind = m[1];
  const name = m[2];
  const ns = VALUE_KINDS.has(kind) ? "value" : TYPE_KINDS.has(kind) ? "type" : kind;
  const key = `${ns}:${name}`;
  const line = src.slice(0, m.index).split("\n").length;
  const list = seen.get(key) ?? [];
  list.push(line);
  seen.set(key, list);
}

const dups = [...seen.entries()].filter(([, lines]) => lines.length > 1);
if (dups.length === 0) {
  console.log("[check-route-tree-duplicates] OK");
  process.exit(0);
}

console.error("[check-route-tree-duplicates] Duplicate symbols in routeTree.gen.ts:");
for (const [key, lines] of dups) {
  console.error(`  - ${key}  (lines: ${lines.join(", ")})`);
}
console.error(
  "\nThis usually means the generated file is stale. Run `bun run dev` " +
    "(which clears it via predev) or delete src/routeTree.gen.ts manually.",
);
process.exit(1);