# Test bench run — 20260502-2210

| Field | Value |
|---|---|
| Target | `https://agentic-state-govops-lac.hf.space` |
| Target version | `2.1.0` |
| Started at (UTC) | `2026-05-02T22:10:42.724Z` |
| Duration | 311.5s |
| Run status | `failed` |
| Journeys executed | 53 |

## Journey results (sorted by ID)

| ID | Title | Status | Tests | Duration | Browsers |
|---|---|---|---|---|---|
| J01 | renders /screen with a jurisdiction picker | PASS | 1 | 1.4s | chromium |
| J02 | /screen/ca renders the jurisdiction-specific form | PASS | 8 | 10.2s | chromium |
| J03 | renders the form with heading + jurisdiction selector | PASS | 4 | 6.7s | chromium |
| J04 | CA + job_loss renders the bounded-benefit timeline | FAIL | 5 | 70.2s | chromium |
| J05 | no draft key in sessionStorage after filling the form | PASS | 4 | 6.9s | chromium |
| J06 | /cases lists at least the seeded demo case | PASS | 1 | 1.5s | chromium |
| J07 | evaluating demo-case-001 returns program_evaluations with citations | PASS | 2 | 1.6s | chromium |
| J08 | POST /review action=approve transitions the case | PASS | 1 | 0.1s | chromium |
| J09 | POST /review action=reject is accepted by the API | PASS | 1 | 0.1s | chromium |
| J10 | POST /review action=request_info is accepted | PASS | 1 | 0.1s | chromium |
| J11 | POST /review action=escalate is accepted | PASS | 1 | 0.1s | chromium |
| J12 | POST /review action=modify is accepted | PASS | 1 | 0.1s | chromium |
| J13 | GET /api/cases/{id}/audit returns the full trace | PASS | 1 | 0.1s | chromium |
| J14 | GET /api/cases/{id}/notice returns a renderable notice | PASS | 1 | 0.1s | chromium |
| J15 | POST /events appends an event; GET /events lists it | PASS | 1 | 0.1s | chromium |
| J16 | renders an event timeline section | PASS | 1 | 1.4s | chromium |
| J17 | renders the headline comparison table with all six active jurisdictions | PASS | 4 | 8.7s | chromium |
| J18 | GET /api/programs/oas/compare returns rows for all 7 jurisdictions | PASS | 2 | 1.7s | chromium |
| J19 | GET /api/impact?citation=... returns an impact set | PASS | 3 | 1.5s | chromium |
| J20 | demo-seeded approvals queue is non-empty on first load | PASS | 1 | 1.4s | chromium |
| J21 | GET /api/config/versions returns a valid shape for any seeded key | PASS | 2 | 1.9s | chromium |
| J22 | /config/diff renders the diff route without an error boundary | PASS | 1 | 1.5s | chromium |
| J24 | draft lifecycle reflects in UI; resolve flips at the boundary | PASS | 1 | 3.4s | chromium |
| J25 | rejected draft moves out of the queue and is marked terminal | PASS | 1 | 1.0s | chromium |
| J26 | request-changes returns a pending draft to the author | PASS | 1 | 0.1s | chromium |
| J27 | /api/screen returns pre-supersession amount for 2025-06-01 evaluation | PASS | 5 | 0.7s | chromium |
| J28 | /config/prompts renders + lists prompt-domain ConfigValues | PASS | 1 | 1.6s | chromium |
| J29 | /config/prompts/{key}/{jur}/edit renders for an existing prompt | PASS | 1 | 1.6s | chromium |
| J30 | /encode renders + lists at least one batch fixture | PASS | 1 | 1.5s | chromium |
| J31 | /encode/new renders the new-batch form | PASS | 1 | 1.4s | chromium |
| J32 | encoder: approving a proposal locks the Approve/Modify/Reject buttons; Reopen replaces Annotate | PASS | 1 | 1.8s | chromium |
| J33 | emit-yaml endpoint accepts requests for known batch ids (or 404 cleanly) | PASS | 1 | 0.0s | chromium |
| J34 | GET /api/admin/federation/registry returns a registry shape | PASS | 2 | 1.6s | chromium |
| J35 | POST /federation/fetch/{publisher} for the first registered publisher (or skip) | SKIP | 1 | 0.1s | chromium |
| J36 | POST /federation/packs/{pub}/enable for the first registered publisher (or skip) | SKIP | 1 | 0.0s | chromium |
| J37 | POST /federation/packs/{pub}/disable for the first registered publisher (or skip) | SKIP | 1 | 0.0s | chromium |
| J38 | fetch with an unknown publisher id returns 4xx (not 5xx) | FAIL | 3 | 0.4s | chromium |
| J39 | /admin renders + surfaces operator runbook | PASS | 1 | 1.5s | chromium |
| J40 | POST /api/admin/gc returns a result shape (or 401/403 if token-gated) | PASS | 1 | 0.0s | chromium |
| J41 | POST /api/llm/chat with a tiny prompt returns content (or rate-limit/4xx) | PASS | 1 | 0.3s | chromium |
| J42 | GET /api/health is healthy + reports the expected version shape | PASS | 1 | 0.0s | chromium |
| J43 | POST /api/jurisdiction/{code} flips the active jurisdiction | PASS | 1 | 0.0s | chromium |
| J44 | page renders without an error boundary | FAIL | 10 | 47.6s | chromium |
| J45 | walkthrough: 7-step paid-vacation scenario renders end to end | PASS | 1 | 1.4s | chromium |
| J46 | /policies renders the live registry with verdicts + provenance | PASS | 1 | 1.4s | chromium |
| J47 | /authority renders + GET /api/authority-chain returns a non-empty chain | PASS | 2 | 1.6s | chromium |
| J48 | home: modules + actors + walkthrough CTA all render | PASS | 1 | 1.3s | chromium |
| M01 | a11y: / (WCAG 2.1 AA) | PASS | 16 | 59.6s | chromium |
| M02 | SSR head: /config renders a non-empty <title> | FAIL | 10 | 0.6s | chromium |
| M03 | language selector lists all 6 GovOps locales | PASS | 2 | 3.0s | chromium |
| M04 | smoke: / renders | PASS | 22 | 19.7s | chromium |
| M05 | help drawer: Help button opens a sheet with route-aware content | PASS | 1 | 1.4s | chromium |
| M06 | breadcrumb: /walkthrough renders the layout-level breadcrumb | PASS | 15 | 21.5s | chromium |

## Aggregate

- passed: 46
- failed: 4
- flaky: 0
- skipped: 3

## Failures (full detail)

### J04 — CA + job_loss renders the bounded-benefit timeline

- **chromium** — CA + job_loss renders the bounded-benefit timeline
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('life-event-ei-result')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — CA + job_loss renders the bounded-benefit timeline
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('life-event-ei-result')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — JP + job_loss surfaces the no-EI message (architectural control)
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('life-event-no-ei')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — JP + job_loss surfaces the no-EI message (architectural control)
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('life-event-no-ei')
Expected: visible
Timeout: 15000ms
  ```

### J38 — fetch with an unknown publisher id returns 4xx (not 5xx)

- **chromium** — enable with an unknown publisher id returns 4xx (not 5xx)
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeLessThan[2m([22m[32mexpected[39m[2m)[22m

Expected: < [32m500[39m
Received:   [31m500[39m
  ```
- **chromium** — enable with an unknown publisher id returns 4xx (not 5xx)
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeLessThan[2m([22m[32mexpected[39m[2m)[22m

Expected: < [32m500[39m
Received:   [31m500[39m
  ```

### J44 — page renders without an error boundary

- **chromium** — page renders FR strings in chrome but keeps verbatim SPRIND quote
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveAttribute[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('html')
Expected pattern: [32m/fr/i[39m
Received string:  [31m"en"[39m
  ```
- **chromium** — page renders FR strings in chrome but keeps verbatim SPRIND quote
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveAttribute[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('html')
Expected pattern: [32m/fr/i[39m
Received string:  [31m"en"[39m
  ```

### M02 — SSR head: /config renders a non-empty <title>

- **chromium** — SSR head: <title> reflects govops-locale cookie at SSR time, not after hydration
  ```
  Error: SSR <title> for /about did not localize to fr (cookie ignored on server)

[2mexpect([22m[31mreceived[39m[2m).[22mtoMatch[2m([22m[32mexpected[39m[2m)[22m

Expected pattern: [32m/propos/i[39m
  ```
- **chromium** — SSR head: <title> reflects govops-locale cookie at SSR time, not after hydration
  ```
  Error: SSR <title> for /about did not localize to fr (cookie ignored on server)

[2mexpect([22m[31mreceived[39m[2m).[22mtoMatch[2m([22m[32mexpected[39m[2m)[22m

Expected pattern: [32m/propos/i[39m
  ```
