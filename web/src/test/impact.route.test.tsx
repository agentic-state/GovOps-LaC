import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import en from "@/messages/en.json";
import { Route as ImpactFileRoute } from "@/routes/impact";

function renderImpactAt(initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <IntlProvider locale="en" messages={en as Record<string, string>}>
        <Outlet />
      </IntlProvider>
    ),
  });
  // Re-host the file-based /impact route under our test root.
  const impactRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/impact",
    component: ImpactFileRoute.options.component!,
    validateSearch: ImpactFileRoute.options.validateSearch!,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([impactRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

// Provide a stable api mock so retry / pagination behaviour is deterministic.
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    impactByCitation: vi.fn(),
  };
});
import { impactByCitation } from "@/lib/api";
import { MOCK_IMPACT_RESPONSE } from "@/lib/mock-impact";

const impactSpy = impactByCitation as unknown as ReturnType<typeof vi.fn>;

describe("/impact route integration", () => {
  beforeEach(() => {
    impactSpy.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pre-fills the input from ?citation= and runs the query immediately", async () => {
    impactSpy.mockResolvedValue(MOCK_IMPACT_RESPONSE("OAS"));
    renderImpactAt("/impact?citation=OAS");
    const input = await screen.findByTestId<HTMLInputElement>("impact-search");
    expect(input.value).toBe("OAS");
    await waitFor(() => {
      expect(screen.getByText(/referencing/i)).toBeInTheDocument();
    });
  });

  it("debounces typed input and pushes ?citation= to the URL", async () => {
    impactSpy.mockResolvedValue(MOCK_IMPACT_RESPONSE(""));
    const { router } = renderImpactAt("/impact");
    const input = await screen.findByTestId<HTMLInputElement>("impact-search");

    fireEvent.change(input, { target: { value: "OAS" } });
    expect(router.state.location.search).not.toMatchObject({ citation: "OAS" });

    await act(async () => {
      vi.advanceTimersByTime(260);
    });
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ citation: "OAS" });
    });
  });

  it("renders the empty state when the query has no matches", async () => {
    impactSpy.mockResolvedValue({
      query: "zzz",
      total: 0,
      jurisdiction_count: 0,
      results: [],
      limit: 25,
      page: 1,
      page_count: 0,
    });
    renderImpactAt("/impact?citation=zzz-no-match-zzz");
    await waitFor(() => {
      expect(screen.getByTestId("impact-empty")).toBeInTheDocument();
    });
  });

  it("shows an error banner and recovers via Retry", async () => {
    impactSpy.mockRejectedValueOnce(new Error("backend exploded"));
    renderImpactAt("/impact?citation=OAS");
    const banner = await screen.findByTestId("impact-error");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("backend exploded");

    impactSpy.mockResolvedValueOnce(MOCK_IMPACT_RESPONSE("OAS"));
    fireEvent.click(screen.getByTestId("impact-retry"));
    await waitFor(() => {
      expect(screen.queryByTestId("impact-error")).toBeNull();
    });
  });

  it("paginates results when limit is set in the URL", async () => {
    vi.useRealTimers();
    impactSpy.mockResolvedValue(MOCK_IMPACT_RESPONSE("a", { limit: 10, page: 1 }));
    renderImpactAt("/impact?citation=a&limit=10");
    await waitFor(() => {
      // The page renders one pagination bar above and one below the results.
      expect(screen.getAllByTestId("impact-page-status").length).toBeGreaterThan(0);
    });
    const limitSelect = screen.getAllByTestId<HTMLSelectElement>("impact-limit")[0];
    expect(limitSelect.value).toBe("10");
    // The api was called with the URL's limit forwarded.
    expect(impactSpy).toHaveBeenCalledWith("a", expect.objectContaining({ limit: 10 }));
  });
});
