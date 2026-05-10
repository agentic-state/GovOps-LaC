/**
 * ConfigValue admin surfaces (Law-as-Code v2.0 substrate).
 *
 * J21 — supersession chain (timeline)
 * J22 — diff between two versions
 * J28 — prompts management list
 * J29 — prompts management edit
 *
 * Existing specs already cover the approve/reject/request-changes flows
 * (J24/J25/J26) and the configure-without-deploy citizen-side proof (J27).
 * This file fills the "browse / inspect / edit prompt" gap.
 */

import { test, expect } from "@playwright/test";
import { backend } from "../fixtures/api";

test.describe("[J21] ConfigValue supersession chain (timeline)", () => {
  test("GET /api/config/versions returns a valid shape for any seeded key", async ({ request }) => {
    const api = await backend(request);
    // Pick the first key from the live values list — guarantees the key
    // exists on the target. The contract under test is shape, not which
    // specific key is multi-version (that depends on the deploy's lawcode).
    const list = await api.listValues();
    const first = list.values[0] as { key?: string; jurisdiction_id?: string } | undefined;
    test.skip(!first?.key, "no ConfigValues on target");
    const r = await api.versions(first!.key!, first!.jurisdiction_id);
    expect(r).toBeTruthy();
    const versions = (r as { versions?: unknown[] }).versions ?? (Array.isArray(r) ? r : []);
    expect(Array.isArray(versions), "versions is an array").toBe(true);
  });

  test("/config/{key}/{jur} timeline UI renders for an arbitrary live key", async ({ page, request }) => {
    const api = await backend(request);
    const list = await api.listValues();
    const first = list.values[0] as { key?: string; jurisdiction_id?: string } | undefined;
    test.skip(!first?.key, "no ConfigValues on target");
    const r = await page.goto(`/config/${encodeURIComponent(first!.key!)}/${first!.jurisdiction_id ?? "global"}`);
    expect(r?.status(), "config timeline HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("[J22] ConfigValue diff between versions", () => {
  test("/config/diff renders the diff route without an error boundary", async ({ page }) => {
    const r = await page.goto("/config/diff");
    expect(r?.status(), "/config/diff HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("[J28] Prompts management — list", () => {
  test("/config/prompts renders + lists prompt-domain ConfigValues", async ({ page, request }) => {
    const api = await backend(request);
    const list = await api.listValues({ domain: "prompt" });
    // Prompts are seeded; expect at least one in a healthy deploy.
    expect(list.values.length, "prompt-domain values present").toBeGreaterThan(0);

    const r = await page.goto("/config/prompts");
    expect(r?.status(), "/config/prompts HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("[J29] Prompts management — edit route", () => {
  test("/config/prompts/{key}/{jur}/edit renders for an existing prompt", async ({ page, request }) => {
    const api = await backend(request);
    const list = await api.listValues({ domain: "prompt" });
    const first = list.values[0] as { key?: string; jurisdiction_id?: string } | undefined;
    test.skip(!first?.key, "no prompt-domain ConfigValue available to drive the edit route");
    const key = first!.key!;
    const jur = first!.jurisdiction_id ?? "global";
    const r = await page.goto(`/config/prompts/${encodeURIComponent(key)}/${jur}/edit`);
    expect(r?.status(), "prompts edit HTTP status").toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
