/**
 * Unit tests for the v3.1.x L10 legal documents editor's pure helpers.
 *
 * Same deferral as L9: browser-level E2E waits on worker-scoped lawcode
 * roots so concurrent Playwright reads stop racing live registry
 * mutations. These tests pin the helpers cleanDocument /
 * cleanSection / validateDocuments that the route saves through.
 */

import { describe, it, expect } from "vitest";
import {
  cleanDocument,
  cleanSection,
  validateDocuments,
} from "@/lib/legal-document-entry";

describe("cleanSection", () => {
  it("trims every field", () => {
    expect(
      cleanSection({
        id: "  sec-1  ",
        ref: "  s. 3(1) ",
        heading: "  Payment ",
        text: " body  ",
      }),
    ).toEqual({ id: "sec-1", ref: "s. 3(1)", heading: "Payment", text: "body" });
  });
});

describe("cleanDocument", () => {
  it("trims required fields, preserves type, drops empty optionals", () => {
    const out = cleanDocument({
      id: " doc-1 ",
      type: "statute",
      title: " Old Age Security Act ",
      citation: " R.S.C. 1985 ",
      effective_date: "",
      url: "   ",
      sections: [],
    });
    expect(out).toEqual({
      id: "doc-1",
      type: "statute",
      title: "Old Age Security Act",
      citation: "R.S.C. 1985",
      sections: [],
    });
    expect(out.effective_date).toBeUndefined();
    expect(out.url).toBeUndefined();
  });

  it("keeps populated optionals trimmed and cleans nested sections", () => {
    const out = cleanDocument({
      id: "doc-1",
      type: "regulation",
      title: "OAS Regs",
      citation: "C.R.C. c. 1246",
      effective_date: "  1985-01-01  ",
      url: " https://example.org/r ",
      sections: [
        { id: " sec-21 ", ref: "s. 21(1)", heading: " Evidence of age ", text: " body " },
      ],
    });
    expect(out.effective_date).toBe("1985-01-01");
    expect(out.url).toBe("https://example.org/r");
    expect(out.sections[0]).toEqual({
      id: "sec-21",
      ref: "s. 21(1)",
      heading: "Evidence of age",
      text: "body",
    });
  });
});

describe("validateDocuments", () => {
  it("returns no issues for a well-formed list", () => {
    expect(
      validateDocuments([
        {
          id: "doc-1",
          type: "statute",
          title: "T",
          citation: "C",
          sections: [{ id: "sec-1", ref: "s. 1", heading: "H", text: "B" }],
        },
      ]),
    ).toEqual([]);
  });

  it("flags missing id / title / type", () => {
    const issues = validateDocuments([
      { id: "", type: "", title: "", citation: "", sections: [] },
    ]);
    const messages = issues.map((i) => i.message);
    expect(messages).toContain("doc 1: id required");
    expect(messages).toContain("doc 1: title required");
    expect(messages).toContain("doc 1: type required");
  });

  it("flags duplicate document ids and duplicate section ids", () => {
    const issues = validateDocuments([
      {
        id: "doc-1",
        type: "statute",
        title: "T",
        citation: "C",
        sections: [
          { id: "sec-1", ref: "", heading: "", text: "" },
          { id: "sec-1", ref: "", heading: "", text: "" },
        ],
      },
      {
        id: "doc-1",
        type: "statute",
        title: "T",
        citation: "C",
        sections: [],
      },
    ]);
    const messages = issues.map((i) => i.message);
    expect(messages).toContain('doc 2: duplicate id "doc-1"');
    expect(messages).toContain('doc 1 section 2: duplicate id "sec-1"');
  });
});
