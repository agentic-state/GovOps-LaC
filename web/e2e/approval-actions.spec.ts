/**
 * Phase 6 approval-flow alternate paths: REJECT and REQUEST_CHANGES.
 * Each spec creates its own draft, exercises the action, and verifies
 * the queue + detail UI reflect the new state.
 */

import { test, expect } from "@playwright/test";
import { backend } from "./fixtures/api";

test.describe("Phase 6 approval actions — reject + request-changes", () => {
  test("[J25] rejected draft moves out of the queue and is marked terminal", async ({
    page,
    request,
  }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: "e2e.approval-actions.reject-target",
      jurisdiction_id: "ca-oas",
      value: 999,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "Reject scenario",
    });

    // Sanity: the draft is in the queue
    let queue = await api.listValues({ status: "draft" });
    expect(queue.values.some((v) => v.id === draft.id)).toBe(true);

    // Reject via API (UI button selector deferred to a separate spec)
    const rejected = await api.reject(draft.id, "e2e-reviewer", "out of scope");
    expect(rejected.status).toBe("rejected");

    // No longer in draft queue
    queue = await api.listValues({ status: "draft" });
    expect(queue.values.some((v) => v.id === draft.id)).toBe(false);

    // Detail page still renders (rejected records remain auditable)
    await page.goto(`/config/approvals/${draft.id}`);
    await page.screenshot({
      path: "test-results/screenshots/reject-detail.png",
      fullPage: true,
    });
    // Approving a rejected record returns 409
    const r = await request.post(
      `${process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:17765"}/api/config/values/${draft.id}/approve`,
      { data: { approved_by: "e2e-reviewer", comment: "" } },
    );
    expect(r.status()).toBe(409);
  });

  test("[J26] request-changes returns a pending draft to the author", async ({ request }) => {
    const api = await backend(request);
    const draft = await api.createDraft({
      domain: "rule",
      key: "e2e.approval-actions.request-changes-target",
      jurisdiction_id: "ca-oas",
      value: 1,
      value_type: "number",
      effective_from: "2030-01-01T00:00:00+00:00",
      author: "e2e-author",
      rationale: "request-changes scenario",
    });

    const after = await api.requestChanges(draft.id, "e2e-reviewer", "needs more citation context");
    expect(after.status).toBe("draft"); // back to author for further edits
  });
});
