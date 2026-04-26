import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROUTES_DIR = resolve(__dirname, "../routes");

/**
 * Every TanStack file-router parent (e.g. `cases.tsx`) that has child files
 * (e.g. `cases.$caseId.tsx`) MUST exist on disk AND render an <Outlet /> so
 * the children actually appear. This test catches the regressions we hit
 * after renaming routes to `*.index.tsx`.
 */

function listRouteFiles(): string[] {
  return readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".tsx") && f !== "__root.tsx");
}

function basesWithChildren(files: string[]): string[] {
  // `config.draft.tsx` → segments: ["config", "draft"]; base: "config"
  // A "parent with children" is any base for which more than one file shares it.
  const bySegment = new Map<string, Set<string>>();
  for (const f of files) {
    const name = f.replace(/\.tsx$/, "");
    const parts = name.split(".");
    if (parts.length === 1) continue;
    const base = parts[0];
    if (!bySegment.has(base)) bySegment.set(base, new Set());
    bySegment.get(base)!.add(name);
  }
  return Array.from(bySegment.entries())
    .filter(([, set]) => set.size >= 2)
    .map(([base]) => base);
}

describe("TanStack file routes", () => {
  const files = listRouteFiles();

  it("contains the expected top-level route files", () => {
    const expected = [
      "index.tsx",
      "about.tsx",
      "admin.tsx",
      "authority.tsx",
      "cases.tsx",
      "config.tsx",
      "encode.tsx",
      "policies.tsx",
    ];
    for (const name of expected) {
      expect(files, `expected ${name} to exist in src/routes`).toContain(name);
    }
  });

  it("every parent route with children has a sibling parent file", () => {
    // e.g. cases.$caseId.tsx requires cases.tsx
    for (const base of basesWithChildren(files)) {
      const parentFile = `${base}.tsx`;
      expect(
        existsSync(resolve(ROUTES_DIR, parentFile)),
        `parent file ${parentFile} must exist for nested child routes`,
      ).toBe(true);
    }
  });

  it("every parent route with children renders <Outlet />", () => {
    for (const base of basesWithChildren(files)) {
      const parentPath = resolve(ROUTES_DIR, `${base}.tsx`);
      if (!existsSync(parentPath)) continue;
      const src = readFileSync(parentPath, "utf8");
      const importsOutlet = /from\s+["']@tanstack\/react-router["']/.test(src) &&
        /\bOutlet\b/.test(src);
      const rendersOutlet = /<\s*Outlet\b/.test(src);
      expect(
        importsOutlet && rendersOutlet,
        `${base}.tsx must import and render <Outlet /> so child routes (${base}.*.tsx) render`,
      ).toBe(true);
    }
  });
});