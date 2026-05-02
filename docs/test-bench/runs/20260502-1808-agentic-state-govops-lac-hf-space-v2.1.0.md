# Test bench run — 20260502-1808

| Field | Value |
|---|---|
| Target | `https://agentic-state-govops-lac.hf.space` |
| Target version | `2.1.0` |
| Started at (UTC) | `2026-05-02T18:08:22.332Z` |
| Duration | 769.5s |
| Run status | `failed` |
| Journeys executed | 53 |

## Journey results (sorted by ID)

| ID | Title | Status | Tests | Duration | Browsers |
|---|---|---|---|---|---|
| J01 | renders /screen with a jurisdiction picker | PASS | 1 | 1.4s | chromium |
| J02 | /screen/ca renders the jurisdiction-specific form | PASS | 8 | 17.6s | chromium |
| J03 | renders the form with heading + jurisdiction selector | FAIL | 7 | 106.9s | chromium |
| J04 | CA + job_loss renders the bounded-benefit timeline | FAIL | 5 | 71.8s | chromium |
| J05 | no draft key in sessionStorage after filling the form | PASS | 4 | 9.8s | chromium |
| J06 | /cases lists at least the seeded demo case | FAIL | 2 | 36.7s | chromium |
| J07 | evaluating demo-case-001 returns program_evaluations with citations | FAIL | 3 | 36.9s | chromium |
| J08 | POST /review action=approve transitions the case | PASS | 1 | 0.3s | chromium |
| J09 | POST /review action=reject is accepted by the API | PASS | 1 | 0.1s | chromium |
| J10 | POST /review action=request_info is accepted | PASS | 1 | 0.1s | chromium |
| J11 | POST /review action=escalate is accepted | PASS | 1 | 0.1s | chromium |
| J12 | POST /review action=modify is accepted | PASS | 1 | 0.1s | chromium |
| J13 | GET /api/cases/{id}/audit returns the full trace | PASS | 1 | 0.1s | chromium |
| J14 | GET /api/cases/{id}/notice returns a renderable notice | FAIL | 2 | 0.4s | chromium |
| J15 | POST /events appends an event; GET /events lists it | FAIL | 2 | 0.5s | chromium |
| J16 | renders an event timeline section | PASS | 1 | 2.4s | chromium |
| J17 | renders the headline comparison table with all six active jurisdictions | FAIL | 7 | 114.7s | chromium |
| J18 | GET /api/programs/oas/compare returns rows for all 7 jurisdictions | FAIL | 3 | 34.5s | chromium |
| J19 | GET /api/impact returns a non-empty impact set | FAIL | 3 | 1.9s | chromium |
| J20 | demo-seeded approvals queue is non-empty on first load | FAIL | 2 | 32.8s | chromium |
| J21 | GET /api/config/versions returns a chain for a known seeded key | FAIL | 3 | 3.0s | chromium |
| J22 | /config/diff renders the diff route without an error boundary | PASS | 1 | 2.4s | chromium |
| J24 | draft lifecycle reflects in UI; resolve flips at the boundary | FAIL | 2 | 34.4s | chromium |
| J25 | rejected draft moves out of the queue and is marked terminal | PASS | 1 | 1.6s | chromium |
| J26 | request-changes returns a pending draft to the author | PASS | 1 | 0.1s | chromium |
| J27 | /api/screen returns pre-supersession amount for 2025-06-01 evaluation | PASS | 5 | 0.8s | chromium |
| J28 | /config/prompts renders + lists prompt-domain ConfigValues | PASS | 1 | 2.6s | chromium |
| J29 | /config/prompts/{key}/{jur}/edit renders for an existing prompt | PASS | 1 | 2.5s | chromium |
| J30 | /encode renders + lists at least one batch fixture | PASS | 1 | 2.4s | chromium |
| J31 | /encode/new renders the new-batch form | PASS | 1 | 2.6s | chromium |
| J32 | encoder: approving a proposal locks the Approve/Modify/Reject buttons; Reopen replaces Annotate | PASS | 1 | 6.1s | chromium |
| J33 | emit-yaml endpoint accepts requests for known batch ids (or 404 cleanly) | PASS | 1 | 0.0s | chromium |
| J34 | GET /api/admin/federation/registry returns a registry shape | PASS | 2 | 1.5s | chromium |
| J35 | POST /federation/fetch/{publisher} for the first registered publisher (or skip) | SKIP | 1 | 0.0s | chromium |
| J36 | POST /federation/packs/{pub}/enable for the first registered publisher (or skip) | SKIP | 1 | 0.0s | chromium |
| J37 | POST /federation/packs/{pub}/disable for the first registered publisher (or skip) | SKIP | 1 | 0.1s | chromium |
| J38 | fetch with an unknown publisher id returns 4xx (not 5xx) | FAIL | 3 | 0.4s | chromium |
| J39 | /admin renders + surfaces operator runbook | PASS | 1 | 1.5s | chromium |
| J40 | POST /api/admin/gc returns a result shape (or 401/403 if token-gated) | PASS | 1 | 0.2s | chromium |
| J41 | POST /api/llm/chat with a tiny prompt returns content (or rate-limit/4xx) | PASS | 1 | 0.3s | chromium |
| J42 | GET /api/health is healthy + reports the expected version shape | PASS | 1 | 0.0s | chromium |
| J43 | POST /api/jurisdiction/{code} flips the active jurisdiction | PASS | 1 | 0.0s | chromium |
| J44 | page renders without an error boundary | FAIL | 10 | 48.6s | chromium |
| J45 | walkthrough: 7-step paid-vacation scenario renders end to end | PASS | 1 | 1.3s | chromium |
| J46 | /policies renders + carries the privacy posture text | FAIL | 2 | 5.1s | chromium |
| J47 | /authority renders + GET /api/authority-chain returns a non-empty chain | PASS | 2 | 2.9s | chromium |
| J48 | home: modules + actors + walkthrough CTA all render | PASS | 1 | 1.3s | chromium |
| M01 | a11y: / (WCAG 2.1 AA) | PASS | 16 | 52.5s | chromium |
| M02 | SSR head: /config renders a non-empty <title> | FAIL | 10 | 0.7s | chromium |
| M03 | language selector lists all 6 GovOps locales | PASS | 2 | 3.1s | chromium |
| M04 | smoke: / renders | PASS | 22 | 25.4s | chromium |
| M05 | help drawer: Help button opens a sheet with route-aware content | PASS | 1 | 1.5s | chromium |
| M06 | breadcrumb: /walkthrough renders the layout-level breadcrumb | PASS | 15 | 30.9s | chromium |

## Aggregate

- passed: 34
- failed: 16
- flaky: 0
- skipped: 3

## Failures (full detail)

### J03 — renders the form with heading + jurisdiction selector

- **chromium** — submitting baseline CA facts surfaces both OAS and EI program cards
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('check-results')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — submitting baseline CA facts surfaces both OAS and EI program cards
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('check-results')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — EI insufficient_evidence card surfaces the life-event CTA
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('life-event-cta-ei')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — EI insufficient_evidence card surfaces the life-event CTA
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('life-event-cta-ei')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — checking 'I just lost my job' flips EI to eligible
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('program-outcome-ei')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — checking 'I just lost my job' flips EI to eligible
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('program-outcome-ei')
Expected: visible
Timeout: 15000ms
  ```

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

### J06 — /cases lists at least the seeded demo case

- **chromium** — /cases lists at least the seeded demo case
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/Margaret Chen|demo-case-001/i).first()
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — /cases lists at least the seeded demo case
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/Margaret Chen|demo-case-001/i).first()
Expected: visible
Timeout: 15000ms
  ```

### J07 — evaluating demo-case-001 returns program_evaluations with citations

- **chromium** — /cases/{id} renders the case + evaluation UI
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/event timeline|recommendation|chronologie|recommandation/i).first()
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — /cases/{id} renders the case + evaluation UI
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText(/event timeline|recommendation|chronologie|recommandation/i).first()
Expected: visible
Timeout: 15000ms
  ```

### J14 — GET /api/cases/{id}/notice returns a renderable notice

- **chromium** — GET /api/cases/{id}/notice returns a renderable notice
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeTruthy[2m()[22m

Received: [31mnull[39m
  ```
- **chromium** — GET /api/cases/{id}/notice returns a renderable notice
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBeTruthy[2m()[22m

Received: [31mnull[39m
  ```

### J15 — POST /events appends an event; GET /events lists it

- **chromium** — POST /events appends an event; GET /events lists it
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoContain[2m([22m[32mexpected[39m[2m) // indexOf[22m

Expected value: [32m422[39m
Received array: [31m[200, 201, 202][39m
  ```
- **chromium** — POST /events appends an event; GET /events lists it
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoContain[2m([22m[32mexpected[39m[2m) // indexOf[22m

Expected value: [32m422[39m
Received array: [31m[200, 201, 202][39m
  ```

### J17 — renders the headline comparison table with all six active jurisdictions

- **chromium** — renders the headline comparison table with all six active jurisdictions
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-summary')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — renders the headline comparison table with all six active jurisdictions
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-summary')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — surfaces the canonical EI rules as table rows
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-table').getByText('rule-ei-contribution').first()
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — surfaces the canonical EI rules as table rows
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-table').getByText('rule-ei-contribution').first()
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — excludes JP and explains why on the same page
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-exclusion-jp')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — excludes JP and explains why on the same page
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-exclusion-jp')
Expected: visible
Timeout: 15000ms
  ```

### J18 — GET /api/programs/oas/compare returns rows for all 7 jurisdictions

- **chromium** — /compare/oas renders the comparison table
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-table')
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — /compare/oas renders the comparison table
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByTestId('compare-table')
Expected: visible
Timeout: 15000ms
  ```

### J19 — GET /api/impact returns a non-empty impact set

- **chromium** — GET /api/impact returns a non-empty impact set
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

Expected: [32m200[39m
Received: [31m400[39m
  ```
- **chromium** — GET /api/impact returns a non-empty impact set
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

Expected: [32m200[39m
Received: [31m400[39m
  ```

### J20 — demo-seeded approvals queue is non-empty on first load

- **chromium** — demo-seeded approvals queue is non-empty on first load
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText('demo.draft.ca-oas.age-67-amendment').or(getByText('demo.draft.fr-cnav.indexation-2026')).first()
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — demo-seeded approvals queue is non-empty on first load
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText('demo.draft.ca-oas.age-67-amendment').or(getByText('demo.draft.fr-cnav.indexation-2026')).first()
Expected: visible
Timeout: 15000ms
  ```

### J21 — GET /api/config/versions returns a chain for a known seeded key

- **chromium** — GET /api/config/versions returns a chain for a known seeded key
  ```
  Error: supersession chain has at least 2 entries

[2mexpect([22m[31mreceived[39m[2m).[22mtoBeGreaterThanOrEqual[2m([22m[32mexpected[39m[2m)[22m

Expected: >= [32m2[39m
  ```
- **chromium** — GET /api/config/versions returns a chain for a known seeded key
  ```
  Error: supersession chain has at least 2 entries

[2mexpect([22m[31mreceived[39m[2m).[22mtoBeGreaterThanOrEqual[2m([22m[32mexpected[39m[2m)[22m

Expected: >= [32m2[39m
  ```

### J24 — draft lifecycle reflects in UI; resolve flips at the boundary

- **chromium** — draft lifecycle reflects in UI; resolve flips at the boundary
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText('e2e.admin-flow.ca-oas.age-65.min_age').first()
Expected: visible
Timeout: 15000ms
  ```
- **chromium** — draft lifecycle reflects in UI; resolve flips at the boundary
  ```
  Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

Locator: getByText('e2e.admin-flow.ca-oas.age-65.min_age').first()
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

### J46 — /policies renders + carries the privacy posture text

- **chromium** — /policies renders + carries the privacy posture text
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoMatch[2m([22m[32mexpected[39m[2m)[22m

Expected pattern: [32m/privacy|priv|datenschutz|confidentialité|privacidad|privacidade|конфіденц/[39m
Received string:  [31m"import(\"/assets/index-c3l8nyw9.js\")skip to contentgov0pshomewalkthroughauthorityaboutconsolelanguageenglishlighthomepoliciesregistry · v1policieslive registry of statutes and proposals. each row carries its provenance and current verdict.titleverdictlast updatedord-2025-014open data publication standardenactedsep 12, 2025prop-2026-007algorithmic transparency for public servicespendingmar 18, 2026draft-2026-021citizen participation in spatial planningdraftapr 9, 2026prop-2025-099mandatory facial recognition in transitrejecteddec 4, 2025ord-2026-003ai usage disclosure in administrative decisionsenactedfeb 21, 2026sys-2026-011automated tax-credit eligibility checkpendingapr 22, 2026govops · spec govops-008"[39m
  ```
- **chromium** — /policies renders + carries the privacy posture text
  ```
  Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoMatch[2m([22m[32mexpected[39m[2m)[22m

Expected pattern: [32m/privacy|priv|datenschutz|confidentialité|privacidad|privacidade|конфіденц/[39m
Received string:  [31m"import(\"/assets/index-c3l8nyw9.js\")skip to contentgov0pshomewalkthroughauthorityaboutconsolelanguageenglishlighthomepoliciesregistry · v1policieslive registry of statutes and proposals. each row carries its provenance and current verdict.titleverdictlast updatedord-2025-014open data publication standardenactedsep 12, 2025prop-2026-007algorithmic transparency for public servicespendingmar 18, 2026draft-2026-021citizen participation in spatial planningdraftapr 9, 2026prop-2025-099mandatory facial recognition in transitrejecteddec 4, 2025ord-2026-003ai usage disclosure in administrative decisionsenactedfeb 21, 2026sys-2026-011automated tax-credit eligibility checkpendingapr 22, 2026govops · spec govops-008"[39m
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
