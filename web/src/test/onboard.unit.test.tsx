/**
 * Unit tests for the v3.1.x L8 Onboard wizard's pure helpers.
 *
 * Browser-level coverage of the wizard end-to-end (drive form, submit
 * drafts, navigate to approval queue) is deferred to v3.1.x followup
 * because the substrate's commit mutates the live JURISDICTION_REGISTRY
 * mid-test, racing with concurrent Playwright reads (same isolation
 * issue v3.1.0 L14 hit). This file pins the wizard's pure logic --
 * specifically the patchDisplayName helper that splices the operator's
 * input into the scaffolded YAML before submitting drafts.
 */

import { describe, it, expect } from "vitest";
import { patchDisplayName } from "@/routes/admin.onboard";

describe("patchDisplayName", () => {
  it("replaces name.en with the operator's input", () => {
    const scaffolded = {
      jurisdiction: {
        id: "jur-pl-national",
        country: "PL",
        name: { en: "TODO Jurisdiction Name (English)" },
      },
      defaults: { domain: "ui" },
    };
    const patched = patchDisplayName(scaffolded, "Poland") as {
      jurisdiction: { name: Record<string, string> };
    };
    expect(patched.jurisdiction.name.en).toBe("Poland");
  });

  it("preserves other localized name keys", () => {
    const scaffolded = {
      jurisdiction: {
        id: "jur-pl-national",
        country: "PL",
        name: { en: "TODO", pl: "Polska" },
      },
    };
    const patched = patchDisplayName(scaffolded, "Republic of Poland") as {
      jurisdiction: { name: Record<string, string> };
    };
    expect(patched.jurisdiction.name.en).toBe("Republic of Poland");
    expect(patched.jurisdiction.name.pl).toBe("Polska");
  });

  it("does not mutate the input object", () => {
    const scaffolded = {
      jurisdiction: { name: { en: "TODO" } },
    };
    const before = JSON.stringify(scaffolded);
    patchDisplayName(scaffolded, "Poland");
    expect(JSON.stringify(scaffolded)).toBe(before);
  });

  it("returns the input unchanged when there is no name block", () => {
    const scaffolded = { jurisdiction: { id: "jur-pl-national" } };
    const patched = patchDisplayName(scaffolded, "Poland") as Record<string, unknown>;
    expect(patched).toEqual(scaffolded);
  });

  it("preserves keys outside the jurisdiction block (defaults, values)", () => {
    const scaffolded = {
      jurisdiction: { name: { en: "TODO" } },
      defaults: { domain: "ui", effective_from: "1900-01-01" },
      values: [{ key: "x", value: 1 }],
    };
    const patched = patchDisplayName(scaffolded, "Poland") as Record<string, unknown>;
    expect(patched.defaults).toEqual(scaffolded.defaults);
    expect(patched.values).toEqual(scaffolded.values);
  });
});
