import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import en from "@/messages/en.json";
import { ScreenResult } from "@/components/govops/ScreenResult";
import type { ScreenResponse } from "@/lib/types";

const baseResponse: ScreenResponse = {
  outcome: "ineligible",
  jurisdiction_label: "Government of Canada",
  evaluation_date: "2026-04-28",
  rule_results: [],
  missing_evidence: [],
  partial_ratio: null,
  benefit_amount: null,
  pension_type: null,
  _preview: false,
} as unknown as ScreenResponse;

function renderResult(props: Partial<Parameters<typeof ScreenResult>[0]> = {}) {
  return render(
    <IntlProvider locale="en" messages={en as Record<string, string>}>
      <ScreenResult
        data={baseResponse}
        stale={false}
        jurisdictionId="ca"
        onRerun={() => {}}
        {...props}
      />
    </IntlProvider>,
  );
}

describe("ScreenResult — howto_url substrate prop (govops-022)", () => {
  it("uses backend-supplied howto_url verbatim when provided", () => {
    const url = "https://example.gov.ca/oas-substrate-test";
    renderResult({ howto_url: url });
    const link = screen
      .getAllByRole("link")
      .find((a) => (a as HTMLAnchorElement).href.includes("oas-substrate-test"));
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toBe(url);
  });

  it("falls back to the compiled-in HOWTO_URLS_FALLBACK when howto_url is null", () => {
    renderResult({ howto_url: null });
    const link = screen
      .getAllByRole("link")
      .find((a) => (a as HTMLAnchorElement).href.includes("canada.ca"));
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain(
      "canada.ca/en/services/benefits/publicpensions/cpp/old-age-security.html",
    );
  });
});
