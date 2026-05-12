/**
 * Unit tests for the v3.1.x L11 demo cases editor's pure helpers.
 *
 * Browser-level coverage of the editor end-to-end is deferred to the
 * same worker-scoped-lawcode-roots followup L9 + L10 are waiting on.
 * These tests pin the helpers (cleanCase / validateCases) plus the
 * cross-array integrity rule on residency.evidence_ids referencing
 * existing evidence_items[].id, which is the closest thing the v3.1.x
 * editor set has to relational validation.
 */

import { describe, it, expect } from "vitest";
import {
  cleanCase,
  cleanEvidence,
  cleanResidency,
  validateCases,
  type DemoCase,
} from "@/lib/demo-case-entry";

function wellFormed(): DemoCase {
  return {
    id: "demo-1",
    applicant: {
      id: "app-1",
      legal_name: "Test Person",
      date_of_birth: "1955-03-15",
      legal_status: "citizen",
      country_of_birth: "CA",
    },
    residency_periods: [
      {
        country: "Canada",
        start_date: "1955-03-15",
        verified: true,
        evidence_ids: ["ev-1"],
      },
    ],
    evidence_items: [
      {
        id: "ev-1",
        type: "birth_certificate",
        description: "Birth cert",
        provided: true,
        verified: true,
      },
    ],
  };
}

describe("cleanEvidence", () => {
  it("trims and coerces booleans", () => {
    expect(
      cleanEvidence({
        id: " ev-1 ",
        type: "passport",
        description: " Passport ",
        provided: true,
        verified: false,
      }),
    ).toEqual({
      id: "ev-1",
      type: "passport",
      description: "Passport",
      provided: true,
      verified: false,
    });
  });
});

describe("cleanResidency", () => {
  it("drops empty end_date and trims evidence_ids", () => {
    const out = cleanResidency({
      country: " Canada ",
      start_date: " 1990-01-01 ",
      end_date: "",
      verified: true,
      evidence_ids: [" ev-1 ", "", "  ev-2"],
    });
    expect(out).toEqual({
      country: "Canada",
      start_date: "1990-01-01",
      verified: true,
      evidence_ids: ["ev-1", "ev-2"],
    });
    expect(out.end_date).toBeUndefined();
  });

  it("preserves end_date when set", () => {
    const out = cleanResidency({
      country: "DE",
      start_date: "1990-01-01",
      end_date: " 1995-12-31 ",
      verified: false,
      evidence_ids: [],
    });
    expect(out.end_date).toBe("1995-12-31");
  });
});

describe("cleanCase", () => {
  it("trims top-level id and propagates through nested arrays", () => {
    const out = cleanCase({
      id: " demo-1 ",
      applicant: {
        id: " app-1 ",
        legal_name: " A B ",
        date_of_birth: "1955-03-15",
        legal_status: "citizen",
        country_of_birth: " CA ",
      },
      residency_periods: [],
      evidence_items: [],
    });
    expect(out.id).toBe("demo-1");
    expect(out.applicant.id).toBe("app-1");
    expect(out.applicant.country_of_birth).toBe("CA");
  });
});

describe("validateCases", () => {
  it("returns no issues for a well-formed case", () => {
    expect(validateCases([wellFormed()])).toEqual([]);
  });

  it("flags missing required applicant fields", () => {
    const c = wellFormed();
    c.applicant.id = "";
    c.applicant.legal_name = "";
    c.applicant.date_of_birth = "";
    const msgs = validateCases([c]).map((i) => i.message);
    expect(msgs).toContain("case 1: applicant.id required");
    expect(msgs).toContain("case 1: applicant.legal_name required");
    expect(msgs).toContain("case 1: applicant.date_of_birth required");
  });

  it("flags duplicate case ids and duplicate evidence ids within a case", () => {
    const a = wellFormed();
    const b = wellFormed();
    b.evidence_items = [
      ...b.evidence_items,
      {
        id: "ev-1",
        type: "passport",
        description: "duplicate",
        provided: true,
        verified: false,
      },
    ];
    const msgs = validateCases([a, b]).map((i) => i.message);
    expect(msgs).toContain('case 2: duplicate id "demo-1"');
    expect(msgs).toContain('case 2 evidence 2: duplicate id "ev-1"');
  });

  it("flags residency.evidence_ids that do not match any evidence item in the same case", () => {
    const c = wellFormed();
    c.residency_periods[0].evidence_ids = ["ev-1", "ev-MISSING"];
    const msgs = validateCases([c]).map((i) => i.message);
    expect(
      msgs.some((m) => m.includes('"ev-MISSING" does not match any evidence item id')),
    ).toBe(true);
  });

  it("flags missing country and start_date on residency", () => {
    const c = wellFormed();
    c.residency_periods[0].country = "";
    c.residency_periods[0].start_date = "";
    const msgs = validateCases([c]).map((i) => i.message);
    expect(msgs).toContain("case 1 residency 1: country required");
    expect(msgs).toContain("case 1 residency 1: start_date required");
  });
});
