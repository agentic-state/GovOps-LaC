# Test bench run — 20260514-1300

| Field | Value |
|---|---|
| Target | `https://agentic-state-govops-lac.hf.space` |
| Target version | `3.2.0` |
| Started at (UTC) | `2026-05-14T13:00:26.381Z` |
| Duration | 1211.1s |
| Run status | `failed` |
| Journeys executed | 64 |
| Unattributed tests | 70 |

## Journey results (sorted by ID)

| ID | Title | Status | Tests | Duration | Browsers |
|---|---|---|---|---|---|
| J01 | renders /screen with a jurisdiction picker | PASS | 1 | 3.1s | chromium |
| J02 | /screen/ca renders the jurisdiction-specific form | PASS | 8 | 22.5s | chromium |
| J03 | renders the form with heading + jurisdiction selector | PASS | 4 | 14.3s | chromium |
| J04 | CA + job_loss renders the bounded-benefit timeline | PASS | 3 | 13.5s | chromium |
| J05 | no draft key in sessionStorage after filling the form | PASS | 4 | 14.3s | chromium |
| J06 | /cases lists at least the seeded demo case | PASS | 1 | 3.3s | chromium |
| J07 | evaluating demo-case-001 returns program_evaluations with citations | PASS | 2 | 3.4s | chromium |
| J08 | POST /review action=approve transitions the case | PASS | 1 | 0.1s | chromium |
| J09 | POST /review action=reject is accepted by the API | PASS | 1 | 0.1s | chromium |
| J10 | POST /review action=request_info is accepted | PASS | 1 | 0.2s | chromium |
| J11 | POST /review action=escalate is accepted | PASS | 1 | 0.1s | chromium |
| J12 | POST /review action=modify is accepted | PASS | 1 | 0.1s | chromium |
| J13 | GET /api/cases/{id}/audit returns the full trace | PASS | 1 | 0.1s | chromium |
| J14 | GET /api/cases/{id}/notice returns a renderable notice | PASS | 1 | 0.1s | chromium |
| J15 | POST /events appends an event; GET /events lists it | PASS | 1 | 0.1s | chromium |
| J16 | renders an event timeline section | PASS | 1 | 3.2s | chromium |
| J17 | renders the headline comparison table with all six active jurisdictions | PASS | 4 | 16.6s | chromium |
| J18 | GET /api/programs/oas/compare returns rows for all 7 jurisdictions | PASS | 2 | 3.3s | chromium |
| J19 | GET /api/impact?citation=... returns an impact set | PASS | 3 | 3.4s | chromium |
| J20 | demo-seeded approvals queue is non-empty on first load | PASS | 1 | 3.2s | chromium |
| J21 | GET /api/config/versions returns a valid shape for any seeded key | PASS | 2 | 3.6s | chromium |
| J22 | /config/diff renders the diff route without an error boundary | PASS | 1 | 3.2s | chromium |
| J24 | draft lifecycle reflects in UI; resolve flips at the boundary | PASS | 1 | 5.3s | chromium |
| J25 | rejected draft moves out of the queue and is marked terminal | PASS | 1 | 2.5s | chromium |
| J26 | request-changes returns a pending draft to the author | PASS | 1 | 0.1s | chromium |
| J27 | /api/screen returns pre-supersession amount for 2025-06-01 evaluation | PASS | 5 | 2.3s | chromium |
| J28 | /config/prompts renders + lists prompt-domain ConfigValues | PASS | 1 | 3.2s | chromium |
| J29 | /config/prompts/{key}/{jur}/edit renders for an existing prompt | PASS | 1 | 3.3s | chromium |
| J30 | /encode renders + lists at least one batch fixture | PASS | 1 | 3.2s | chromium |
| J31 | /encode/new renders the new-batch form | PASS | 1 | 3.2s | chromium |
| J32 | encoder: approving a proposal locks the Approve/Modify/Reject buttons; Reopen replaces Annotate | PASS | 1 | 5.1s | chromium |
| J33 | emit-yaml endpoint accepts requests for known batch ids (or 404 cleanly) | PASS | 1 | 0.1s | chromium |
| J34 | GET /api/admin/federation/registry returns a registry shape | PASS | 2 | 7.0s | chromium |
| J35 | POST /federation/fetch/{publisher} for the first registered publisher (or skip) | SKIP | 1 | 0.0s | chromium |
| J36 | POST /federation/packs/{pub}/enable for the first registered publisher (or skip) | SKIP | 1 | 0.0s | chromium |
| J37 | POST /federation/packs/{pub}/disable for the first registered publisher (or skip) | SKIP | 1 | 0.1s | chromium |
| J38 | fetch with an unknown publisher id returns 4xx (not 5xx) | PASS | 2 | 0.1s | chromium |
| J39 | /admin renders + surfaces operator runbook | PASS | 1 | 3.1s | chromium |
| J40 | POST /api/admin/gc returns a result shape (or 401/403 if token-gated) | PASS | 1 | 0.0s | chromium |
| J41 | POST /api/llm/chat with a tiny prompt returns content (or rate-limit/4xx) | SKIP | 1 | 0.0s | chromium |
| J42 | GET /api/health is healthy + reports the expected version shape | PASS | 1 | 0.0s | chromium |
| J43 | POST /api/jurisdiction/{code} flips the active jurisdiction | PASS | 1 | 0.0s | chromium |
| J44 | page renders without an error boundary | PASS | 9 | 32.5s | chromium |
| J45 | walkthrough: 7-step paid-vacation scenario renders end to end | PASS | 1 | 3.3s | chromium |
| J46 | /policies renders the live registry with verdicts + provenance | PASS | 1 | 3.2s | chromium |
| J47 | approving via the UI removes the record from the queue without a hard reload | PASS | 3 | 10.9s | chromium |
| J48 | visiting /config/approvals/{id} for an already-approved record shows the resolved notice, not action buttons | PASS | 2 | 6.3s | chromium |
| M01 | a11y: / (WCAG 2.1 AA) | PASS | 16 | 126.3s | chromium |
| M02 | SSR head: /config renders a non-empty <title> | PASS | 9 | 0.4s | chromium |
| M03 | language selector lists all 6 GovOps locales | PASS | 3 | 14.1s | chromium |
| M04 | request-changes returns the draft to the author + record stays in queue with status=draft | PASS | 23 | 64.9s | chromium |
| M05 | when the current user authored the draft, the action panel is disabled + shows the blocked alert | PASS | 2 | 7.1s | chromium |
| M06 | typing the shortcut while the panel is focused opens the approve dialog | PASS | 16 | 52.2s | chromium |
| M07 | filling the form and clicking Submit creates a draft, redirects to the timeline, and the new draft is visible on /config/approvals | PASS | 1 | 5.6s | chromium |
| M08 | typing in the form and clicking 'Save as draft (URL)' updates the search params + persists across reload | PASS | 1 | 4.4s | chromium |
| M09 | typing into CodeMirror + clicking Save creates a draft on /config/approvals | PASS | 1 | 4.2s | chromium |
| M10 | typing a change then clicking Reset puts the original value back | PASS | 1 | 4.9s | chromium |
| M11 | clicking 'Show diff' reveals the Diff section; clicking 'Hide diff' hides it | PASS | 1 | 3.9s | chromium |
| M12 | deferred -- FixtureTestPanel requires an LLM provider key; not in this batch | SKIP | 1 | 0.0s | chromium |
| M13 | selecting 'pending' hides draft-only records and selecting 'all' restores them | PASS | 1 | 3.9s | chromium |
| M14 | typing the unique key in the search box hides every other row and leaves only the match | PASS | 1 | 3.4s | chromium |
| M15 | Load-more advances visible window by page-size; deferred until at least 11 drafts exist on target | SKIP | 1 | 0.0s | chromium |
| M16 | renders the timeline for a live seeded key with a Current Version section | PASS | 1 | 3.4s | chromium |
| M17 | when given two valid version ids the diff pane renders both sides | PASS | 1 | 3.4s | chromium |

## Aggregate

- passed: 58
- failed: 0
- flaky: 0
- skipped: 6

## Unattributed tests (no [Jxx]/[Mxx] tag)

-  > chromium > journeys\adoption.spec.ts > [A01] Onboard wizard -- adopt zztest end-to-end > walks identity -> review -> submit -> approve -> commit -> live
-  > chromium > journeys\citizen-ui.spec.ts > [C03] Fill /screen form and submit > checking eligibility for CA with valid DOB + Citizen + residency surfaces a result outcome
-  > chromium > journeys\citizen-ui.spec.ts > [C04] Download decision from screen result > submitting the screen form then clicking Download decision opens a new tab carrying the notice
-  > chromium > journeys\citizen-ui.spec.ts > [C06] Fill /check multi-program form and submit > submitting baseline CA citizen facts surfaces program result cards
-  > chromium > journeys\encoder-pipeline.spec.ts > [E02 + E10] New batch via UI + source-text toggle > manual-mode submit redirects to /encode/$batchId; the source-text disclosure opens and closes
-  > chromium > journeys\encoder-pipeline.spec.ts > [E04] Approve a single proposal via UI ProposalCard > submit a manual batch, approve the first proposal, verify status pill flips
-  > chromium > journeys\encoder-pipeline.spec.ts > [E03] LLM-mode ingest > deferred -- requires LLM provider key on test target (PLAN section 11)
-  > chromium > journeys\encoder-pipeline.spec.ts > [E05] Reject a single proposal via UI > submit a manual batch, reject the first proposal, verify status pill flips
-  > chromium > journeys\encoder-pipeline.spec.ts > [E06] Modify a proposal via UI > submit a manual batch, modify the first proposal, verify it lands as Modified
-  > chromium > journeys\encoder-pipeline.spec.ts > [E07] Bulk-approve via BulkActionBar > select 2 proposals -> click 'Approve all' -> both flip to Approved
-  > chromium > journeys\encoder-pipeline.spec.ts > [E08] Bulk-reject via BulkActionBar > select 2 proposals -> click 'Reject all' -> both flip to Rejected
-  > chromium > journeys\encoder-pipeline.spec.ts > [E09] Filter proposals by status chip > approving one proposal then toggling the 'Pending' chip narrows to 2 cards
-  > chromium > journeys\encoder-pipeline.spec.ts > [E11] Commit a batch -- approved proposals land on /authority > approve a proposal, commit, and verify the redirect lands on /authority
-  > chromium > journeys\federation-ui.spec.ts > [F02] /admin/federation -- seeded form structure > page renders the heading + section landmarks + publisher Select with seeded entry
-  > chromium > journeys\federation-ui.spec.ts > [F02] /admin/federation -- seeded form structure > page renders the heading + section landmarks + publisher Select with seeded entry
-  > chromium > journeys\federation-ui.spec.ts > [F03] dry-run + allow-unsigned checkbox toggles > checking and unchecking the two toggles updates their checked state
-  > chromium > journeys\federation-ui.spec.ts > [F04] Enable a pack via row action > disabled pack -> click Enable in row menu -> status flips to Active
-  > chromium > journeys\federation-ui.spec.ts > [F04] Enable a pack via row action > disabled pack -> click Enable in row menu -> status flips to Active
-  > chromium > journeys\federation-ui.spec.ts > [F05] Disable a pack via row action > enabled pack -> click Disable in row menu -> status flips to Disabled
-  > chromium > journeys\federation-ui.spec.ts > [F05] Disable a pack via row action > enabled pack -> click Disable in row menu -> status flips to Disabled
-  > chromium > journeys\federation-ui.spec.ts > [F06] Re-fetch a pack from row action > Re-fetch menuitem fires the action and the row stays mounted
-  > chromium > journeys\federation-ui.spec.ts > [F06] Re-fetch a pack from row action > Re-fetch menuitem fires the action and the row stays mounted
-  > chromium > journeys\federation-ui.spec.ts > [F07] Fail-closed on unknown publisher (UI path) > deferred -- with non-empty registry the publisher field is a Select bound to known IDs; there is no typed-text path to a fail-closed error. Backend fail-closed is covered by J38.
-  > chromium > journeys\leader-visitor-ui.spec.ts > [L01/L02] /compare/oas -- multi-jurisdiction comparison data flow > SummaryStrip shows program + coverage summary, table renders rule rows
-  > chromium > journeys\leader-visitor-ui.spec.ts > [L01/L02] /compare/oas -- multi-jurisdiction comparison data flow > /compare/ei -- coverage summary + ExclusionPanel surface unavailable jurisdictions
-  > chromium > journeys\leader-visitor-ui.spec.ts > [V03] Walkthrough CTA clicks > clicking the step-2 'View encoder' CTA navigates to /encode
-  > chromium > journeys\leader-visitor-ui.spec.ts > [L03] Switch jurisdiction filter on /compare > toggling a jurisdiction chip narrows the comparison table to the selection
-  > chromium > journeys\leader-visitor-ui.spec.ts > [L04] View program-interaction warnings > the /compare page renders an Interactions section with at least an empty-state notice
-  > chromium > journeys\leader-visitor-ui.spec.ts > [V05] Switch jurisdiction via header selector > the global header jurisdiction selector renders, accepts a change, and persists
-  > chromium > journeys\officer-ui.spec.ts > [O02 + O05] Case detail page + audit drawer > /cases/$caseId renders + clicking 'View audit package' opens the drawer
-  > chromium > journeys\officer-ui.spec.ts > [O03 + O04] Evaluate + submit a review action > clicking Run evaluation produces a recommendation; the review form submits an Approve action
-  > chromium > journeys\officer-ui.spec.ts > [O06] Download decision notice button > clicking Download decision opens a new tab carrying the rendered HTML notice
-  > chromium > journeys\officer-ui.spec.ts > [O07] Post a new life event via NewEventForm > clicking 'Record event', filling the form, and submitting closes the dialog and updates the timeline
-  > chromium > journeys\post-mutation-a11y.spec.ts > [a11y/post-mutation] approve-draft flow > approving a draft leaves the post-redirect page with zero critical axe violations
-  > chromium > journeys\post-mutation-a11y.spec.ts > [a11y/post-mutation] page-load axe scan on mutation surfaces > /config/approvals -- zero critical axe violations on idle load
-  > chromium > journeys\post-mutation-a11y.spec.ts > [a11y/post-mutation] page-load axe scan on mutation surfaces > /config/draft -- zero critical axe violations on idle load
-  > chromium > journeys\post-mutation-a11y.spec.ts > [a11y/post-mutation] page-load axe scan on mutation surfaces > /admin/federation -- zero critical axe violations on idle load
-  > chromium > visual.spec.ts > [visual] index -- en
-  > chromium > visual.spec.ts > [visual] index -- fr
-  > chromium > visual.spec.ts > [visual] index -- fr
-  > chromium > visual.spec.ts > [visual] screen -- en
-  > chromium > visual.spec.ts > [visual] screen -- fr
-  > chromium > visual.spec.ts > [visual] screen -- fr
-  > chromium > visual.spec.ts > [visual] cases -- en
-  > chromium > visual.spec.ts > [visual] cases -- fr
-  > chromium > visual.spec.ts > [visual] authority -- en
-  > chromium > visual.spec.ts > [visual] authority -- en
-  > chromium > visual.spec.ts > [visual] authority -- fr
-  > chromium > visual.spec.ts > [visual] authority -- fr
-  > chromium > visual.spec.ts > [visual] encode -- en
-  > chromium > visual.spec.ts > [visual] encode -- en
-  > chromium > visual.spec.ts > [visual] encode -- fr
-  > chromium > visual.spec.ts > [visual] encode -- fr
-  > chromium > visual.spec.ts > [visual] admin-federation -- en
-  > chromium > visual.spec.ts > [visual] admin-federation -- en
-  > chromium > visual.spec.ts > [visual] admin-federation -- fr
-  > chromium > visual.spec.ts > [visual] admin-federation -- fr
-  > chromium > visual.spec.ts > [visual] compare-oas -- en
-  > chromium > visual.spec.ts > [visual] compare-oas -- en
-  > chromium > visual.spec.ts > [visual] compare-oas -- fr
-  > chromium > visual.spec.ts > [visual] compare-oas -- fr
-  > chromium > visual.spec.ts > [visual] walkthrough -- en
-  > chromium > visual.spec.ts > [visual] walkthrough -- fr
-  > chromium > visual.spec.ts > [visual] walkthrough -- fr
-  > chromium > visual.spec.ts > [visual] config -- en
-  > chromium > visual.spec.ts > [visual] config -- fr
-  > chromium > visual.spec.ts > [visual] config -- fr
-  > chromium > visual.spec.ts > [visual] check -- en
-  > chromium > visual.spec.ts > [visual] check -- fr
-  > chromium > visual.spec.ts > [visual] check -- fr
