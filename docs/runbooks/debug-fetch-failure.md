# Runbook: Debug a "page renders but action silently fails" failure

## When to use

When a user (or a journey test) reports any of:

- "I clicked submit and nothing happened"
- "The form is there but nothing comes back"
- An alert that says "Failed to fetch", "Could not load", "Network error" with the page itself rendering fine
- A button that visibly does something (loading state) but the result never arrives
- A SPA route loader that returns 200 with the page shell but the page-specific data never populates

This is the failure class where smoke tests pass (the page rendered) but the actual user flow is broken. It's the class that bit us 2026-04-29 → 2026-05-02 and stayed silent for 3 days.

If the page itself fails to render (500 / blank screen / error boundary) — that's a different runbook (server-side or SSR debugging).

## Pre-flight

Before you start chasing, capture the failure context. If the failure was a Playwright test, you already have everything; otherwise:

- Open browser devtools → **Network tab** → reproduce the failure → screenshot the failed request(s) and their response
- Open browser devtools → **Console tab** → screenshot any errors
- Note the deployed URL the action was firing against (visible in the Network tab's request URL)

## Steps

### Step 1 — Localize the failure: client or server?

The first cut is whether the **server** is failing or the **client's request** is malformed / misrouted. Two parallel probes:

```bash
BASE=<the URL the page is actually deployed at>

# (A) Direct API probe — is the server side OK?
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$BASE/api/health"

# (B) Reproduce the failing API call directly (use the request URL + body
# the browser was firing)
curl -s -X POST "$BASE/api/check" \
  -H "Content-Type: application/json" \
  -d '<the same body the browser was sending>' \
  -w "\nHTTP %{http_code}\n"
```

| Result | Interpretation | Next |
|---|---|---|
| Both succeed (200) | The server is fine; the bug is in the client's request construction or the client's interpretation of the response | Step 2 |
| (A) succeeds, (B) fails | The server is up but rejecting this specific call shape — wrong content-type, missing required field, validation error | Inspect the response body for the validation error; align the client request to match |
| Both fail | The server itself is broken | Different runbook (`debug-server-failure.md`, when written) |

### Step 2 — Inspect the deployed bundle

If the server is fine but the client is broken, the most common cause is that **the client's bundle baked in the wrong configuration at build time** (env vars, API base URLs, feature flags).

Get the deployed bundle hash:

```bash
curl -s "$BASE/<the failing route>" | tr -d '\0' \
  | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' \
  | head -3
```

Inspect the bundle for known anti-patterns:

```bash
HASH=$(curl -s "$BASE/<the failing route>" | tr -d '\0' \
  | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)

# Anti-pattern 1: localhost / 127.0.0.1 baked into a production bundle
curl -s "$BASE/assets/$HASH" | grep -c "127.0.0.1\|localhost:8000"
# expected: 0; non-zero is a smoking gun

# Anti-pattern 2: development / staging URLs in production
curl -s "$BASE/assets/$HASH" | grep -c "staging\|dev\.\|local\."

# Anti-pattern 3: API endpoints that no longer exist (renamed but client not rebuilt)
curl -s "$BASE/assets/$HASH" | grep -oE '/api/[a-zA-Z0-9_/-]+' | sort -u | head -20
# scan the list for endpoints that don't exist in src/govops/api.py
```

If anti-pattern 1 hits: this is almost certainly the same regression as 2026-05-02. The fix is to ensure `VITE_API_BASE_URL=""` is set on the build step in the Dockerfile (or wherever the build runs). See [`feedback_build_pattern_pivot_audit`](../../../eva-foundation/.claude-memory/feedback_build_pattern_pivot_audit.md).

### Step 3 — If the failure is from a Playwright test, read the trace

Playwright captures everything on failure. The richest signal is `error-context.md`:

```bash
# The failure dirs are named after the spec + test
ls web/test-results-deploy/<spec>-<test>-chromium/
cat web/test-results-deploy/<spec>-<test>-chromium/error-context.md
```

The `error-context.md` includes:

- The exact assertion that failed
- A YAML page snapshot at failure time — read this carefully; the page content tells you what state the user was actually in
- The test source code

The page snapshot frequently reveals exactly what the bug is. Example from 2026-05-02:

```yaml
- main:
    - region "What am I entitled to?"
    - form "Citizen self-check form"
        - <form rendered correctly>
    - alert:
        - "Could not run the check."
        - "Failed to fetch"
```

That alert text + the form being rendered = "client side fetch failed" = step 2.

Also look at the trace.zip — open with `npx playwright show-trace web/test-results-deploy/<dir>/trace.zip`. The Network panel shows the failed request and the exact response.

### Step 4 — Diff the deployed bundle against a local build

If steps 1-3 didn't pin the bug, build locally and compare. Either:

```bash
# Local build
cd web && npm run build && cd ..

# Compare a specific chunk
diff <(curl -s "$BASE/assets/<chunk>") web/dist/client/assets/<same-chunk>
```

Differences point at the gap between deploy and source. Common findings: env-var-driven content baked differently, version constants out of sync, build-time feature flags.

### Step 5 — Audit the deploy pipeline

Once you suspect a build-time mismatch, audit:

- Dockerfile RUN lines that perform the build — are env vars set? are flags right?
- CI build job env vars vs Dockerfile env vars (they should match)
- Any supervisor / wrapper scripts that previously set these vars (memory entry: build-pattern pivots are where these regress)
- The `vite.config.ts` (or webpack/etc.) — any `define()` or `process.env` references — and whether their inputs match expected values

### Step 6 — Fix at the source, redeploy, verify

Apply the fix in the BUILD step. Don't patch over it at runtime (e.g. don't add a `try/catch` in the client; fix the URL). Then deploy via [`deploy-to-hf.md`](deploy-to-hf.md), and confirm the bench's relevant journey now passes.

If you didn't have a journey test for this surface — **add one to the bench catalog** (`docs/test-bench/RUNBOOK.md`) so this class of failure can never go silent again. That's the difference between fixing one bug and fixing the class.

## Post-checks

- [ ] The original failing scenario reproduces FIX (manual or via Playwright)
- [ ] The bench's journey for this surface, if it exists, now passes; if it didn't exist, it does now
- [ ] If the root cause was a build-time misconfiguration, a build-time gate was added (see [`check-bundle-no-localhost.mjs`](../../web/scripts/check-bundle-no-localhost.mjs) for the pattern)
- [ ] Findings recorded — either in a test-bench findings doc or in a memory entry, with the *why*

## Rollback

If the fix made things worse: revert the fix commit (`git revert <sha>`), redeploy, return to debugging. The recovery tag from the deploy runbook is your safety net.

## Common gotchas

- **Trusting `curl` as a proxy for "the SPA works."** Curl is server-to-server. The browser bundle goes through a different code path (env-var inlining, bundler tree-shaking, runtime DOM events). A curl smoke can be 100% green while every browser interaction silently fails. Always reproduce in a real browser too.
- **Page-rendered = "it works."** The 2026-05-02 bug rendered the form perfectly. Filling and submitting was where it broke. Smoke tests miss this every time. Journey tests catch it.
- **Assuming HF rebuilt because the runtime SHA changed.** HF can flip the SHA pointer while still serving the old container, or rebuild stage 2 (Python) while reusing a cached stage 1 (web-builder). Always probe BOTH the runtime SHA AND the served bundle hash.
- **Looking at local source instead of the deployed bundle.** Local source is right; deployed bundle may be wrong. The bug lives in the build artifact, not in the source. Inspect the artifact.

## Last validated

- **2026-05-02** by Claude — used end-to-end on the v0.5.0 → v2.1 SPA regression. Steps 1, 2, 3, and 6 directly applicable; the protocol caught the `VITE_API_BASE_URL` build-time bug in ~30 minutes from "bench-4 still failing on /check" to "Dockerfile fix committed."
