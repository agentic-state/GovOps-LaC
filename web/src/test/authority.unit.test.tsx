/**
 * Unit tests for the v3.1.x L9 authority chain editor's pure helpers.
 *
 * Browser-level coverage of the editor end-to-end (load draft, edit
 * rows, PATCH the substrate) is deferred to the same v3.1.x browser-E2E
 * follow-up that L8 + L14 are waiting on (worker-scoped lawcode roots).
 * This file pins the small pure logic that is non-obvious from
 * inspection: cleanEntry trims whitespace, drops optional fields when
 * empty, and preserves the layer enum.
 */

import { describe, it, expect } from "vitest";
import { cleanEntry } from "@/lib/authority-entry";

describe("cleanEntry", () => {
  it("trims required fields and preserves layer", () => {
    const out = cleanEntry({
      id: "  auth-x  ",
      layer: "act",
      title: "  Pension Act  ",
      citation: "  R.S.C. 1985 ",
    });
    expect(out).toEqual({
      id: "auth-x",
      layer: "act",
      title: "Pension Act",
      citation: "R.S.C. 1985",
    });
  });

  it("drops empty optional fields", () => {
    const out = cleanEntry({
      id: "auth-x",
      layer: "act",
      title: "T",
      citation: "C",
      effective_date: "",
      url: "",
      parent: "   ",
    });
    expect(out.effective_date).toBeUndefined();
    expect(out.url).toBeUndefined();
    expect(out.parent).toBeUndefined();
  });

  it("keeps populated optional fields trimmed", () => {
    const out = cleanEntry({
      id: "auth-x",
      layer: "regulation",
      title: "T",
      citation: "C",
      effective_date: "  1985-01-01  ",
      url: "  https://example.org/r  ",
      parent: "  auth-y  ",
    });
    expect(out.effective_date).toBe("1985-01-01");
    expect(out.url).toBe("https://example.org/r");
    expect(out.parent).toBe("auth-y");
  });
});
