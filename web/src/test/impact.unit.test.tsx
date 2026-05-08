import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MOCK_IMPACT_RESPONSE, DEFAULT_IMPACT_LIMIT } from "@/lib/mock-impact";
import { CitationHighlight } from "@/components/govops/CitationHighlight";

describe("MOCK_IMPACT_RESPONSE", () => {
  it("normalizes the query (trim + collapse whitespace)", () => {
    const r = MOCK_IMPACT_RESPONSE("   OAS   Act  ");
    expect(r.query).toBe("OAS Act");
  });

  it("returns deterministic, case-insensitive matches", () => {
    const a = MOCK_IMPACT_RESPONSE("oas act");
    const b = MOCK_IMPACT_RESPONSE("OAS ACT");
    expect(a.total).toBeGreaterThan(0);
    expect(b.total).toBe(a.total);
  });

  it("groups results by jurisdiction with the global section first", () => {
    const r = MOCK_IMPACT_RESPONSE("Internal");
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results[0].jurisdiction_id).toBeNull();
    // remainder sorted by jurisdiction_label asc
    const tail = r.results.slice(1);
    const labels = tail.map((s) => s.jurisdiction_label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("respects custom limit + page (paginates jurisdiction sections)", () => {
    const all = MOCK_IMPACT_RESPONSE("a"); // broad match across many jurisdictions
    const sectionCount = all.jurisdiction_count;
    const limited = MOCK_IMPACT_RESPONSE("a", { limit: 1, page: 1 });
    expect(limited.results.length).toBe(1);
    expect(limited.limit).toBe(1);
    expect(limited.page).toBe(1);
    expect(limited.page_count).toBe(sectionCount);

    const page2 = MOCK_IMPACT_RESPONSE("a", { limit: 1, page: 2 });
    if (sectionCount >= 2) {
      expect(page2.results[0].jurisdiction_id).not.toBe(limited.results[0].jurisdiction_id);
    }
  });

  it("returns an empty result set for an unmatched query", () => {
    const r = MOCK_IMPACT_RESPONSE("xyz-zzz-no-match-zzz");
    expect(r.total).toBe(0);
    expect(r.results).toEqual([]);
    expect(r.jurisdiction_count).toBe(0);
  });

  it("clamps limit to a sane range and defaults when not provided", () => {
    const def = MOCK_IMPACT_RESPONSE("a");
    expect(def.limit).toBe(DEFAULT_IMPACT_LIMIT);
    const clampedHigh = MOCK_IMPACT_RESPONSE("a", { limit: 9999 });
    expect(clampedHigh.limit).toBeLessThanOrEqual(200);
    const clampedLow = MOCK_IMPACT_RESPONSE("a", { limit: 0 });
    expect(clampedLow.limit).toBeGreaterThanOrEqual(1);
  });
});

describe("impactByCitation()", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("short-circuits without a network call for an empty query", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const { impactByCitation } = await import("@/lib/api");
    const r = await impactByCitation("   ");
    expect(r.total).toBe(0);
    expect(r.results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to mock data when the network fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const { impactByCitation } = await import("@/lib/api");
    const r = await impactByCitation("OAS");
    expect(r.total).toBeGreaterThan(0);
    expect(r.query).toBe("OAS");
    expect(r.results[0]).toHaveProperty("jurisdiction_label");
  });

  it("forwards limit + page in the query string when fetch succeeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          query: "OAS",
          total: 0,
          jurisdiction_count: 0,
          results: [],
          limit: 10,
          page: 2,
          page_count: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { impactByCitation } = await import("@/lib/api");
    await impactByCitation("OAS", { limit: 10, page: 2 });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("citation=OAS");
    expect(url).toContain("limit=10");
    expect(url).toContain("page=2");
  });
});

describe("CitationHighlight", () => {
  it("renders plain text when query is empty", () => {
    const { container } = render(<CitationHighlight text="OAS Act, s. 3(1)" query="" />);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("OAS Act, s. 3(1)");
  });

  it("renders plain text when no match", () => {
    const { container } = render(<CitationHighlight text="OAS Act, s. 3(1)" query="zzz" />);
    expect(container.querySelector("mark")).toBeNull();
  });

  it("highlights the first match case-insensitively", () => {
    const { container } = render(<CitationHighlight text="OAS Act, s. 3(1)" query="act" />);
    const mark = container.querySelector("mark")!;
    expect(mark).not.toBeNull();
    expect(mark.textContent).toBe("Act"); // preserves original casing
    expect(mark.getAttribute("aria-label")).toContain("act");
  });

  it("supports a custom matchLabel for accessibility", () => {
    const { container } = render(
      <CitationHighlight text="OAS Act" query="act" matchLabel="search match: act" />,
    );
    expect(container.querySelector("mark")?.getAttribute("aria-label")).toBe("search match: act");
  });

  it("preserves the prefix and suffix around the match", () => {
    const { container } = render(<CitationHighlight text="abc-NEEDLE-xyz" query="needle" />);
    expect(container.textContent).toBe("abc-NEEDLE-xyz");
    expect(container.querySelector("mark")?.textContent).toBe("NEEDLE");
  });

  it("trims whitespace in the query before matching", () => {
    const { container } = render(<CitationHighlight text="OAS Act" query="  oas  " />);
    // only the trimmed needle "oas" is matched, not the spaces
    expect(container.querySelector("mark")?.textContent).toBe("OAS");
  });
});
