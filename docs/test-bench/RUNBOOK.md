# GovOps Test Bench — RUNBOOK

> Authoritative catalog of every user journey through GovOps, the executable spec that verifies it, and the runbook for executing the bench against any deploy target.
>
> **Bench goal**: every meaningful journey is named, executable, repeatable, and **comparable across runs**. A run is not "did the tests pass" — it is a structured record of what was exercised, what data flowed, and what changed. Two runs against the same target diff at the journey level.

## Status (this file)

| Field | Value |
|---|---|
| Bench version | `0.1.0` (framework + 55 journeys + first baseline run captured) |
| Local code version | `v0.5.0` (commit `8ec2645`) |
| Hosted demo version | `v2.1.0` — meaningfully behind local (Phases F/G/H/I features absent) |
| Default deploy target | `https://agentic-state-govops-lac.hf.space` |
| Default local target | `http://127.0.0.1:17081` (frontend) + `http://127.0.0.1:17765` (backend), per [`web/playwright.config.ts`](../../web/playwright.config.ts) |
| First baseline run | [`runs/20260502-1808-agentic-state-govops-lac-hf-space-v2.1.0.md`](runs/20260502-1808-agentic-state-govops-lac-hf-space-v2.1.0.md) — 34 pass / 16 fail / 3 skip; [findings triage](runs/20260502-1808-findings.md) |

---

## Journey catalog

A **journey** is a user-flow that follows data through the system. Routes are infrastructure; journeys are what users actually do. A journey verifies:

- The page renders correctly (no error boundary, expected fields present)
- Each API call along the flow returns the expected shape and data
- For mutating flows: pre-state is captured, the mutation is applied, post-state is verified, side effects are recorded
- For read-only flows: data shape, citations, and substrate-resolved values match expectations

Every journey has a stable ID (`J01`, `M01`, etc.) — these are the keys used in run records for cross-run diffs.

### Status legend

- `built` — full spec exists in [`web/e2e/`](../../web/e2e/) covering the journey
- `partial` — some assertions exist but the journey contract isn't fully covered
- `missing` — no spec; needs to be built
- `manual-only` — covered only by manual verification (e.g. the 2026-04-29 35-curl smoke), no Playwright spec

### A. Citizen surface (no PII storage, no audit row)

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J01 | Citizen self-screen — landing | `/screen` | no | `partial` | [`screen.spec.ts`](../../web/e2e/screen.spec.ts) covers privacy invariants only |
| J02 | Citizen self-screen — per jurisdiction | `/screen/{ca,br,es,fr,de,ua,jp}` × 7, `POST /api/screen` | no | `partial` | [`configure-without-deploy.spec.ts`](../../web/e2e/configure-without-deploy.spec.ts) covers CA only with dated-supersession lens |
| J03 | Citizen entry — multi-program eligibility | `/check`, `POST /api/check` | no | `built` | [`check.spec.ts`](../../web/e2e/check.spec.ts) — CA OAS+EI eligibility, EI evidence flip |
| J04 | Citizen life-event reassessment | `/check/life-event?event=job_loss`, `POST /api/check` | no | `built` | [`check.spec.ts`](../../web/e2e/check.spec.ts) — CA bounded timeline, JP no-EI control |
| J05 | Privacy invariant — no rehydration | `/screen`, sessionStorage inspection | no | `built` | [`screen.spec.ts`](../../web/e2e/screen.spec.ts) — no draft key, reload discards |

### B. Officer surface (case-bound, mutates audit trail)

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J06 | Case list browse | `/cases`, `GET /api/cases` | no | `partial` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) renders the page; no assertions on case data |
| J07 | Case detail + cross-program evaluation | `/cases/{id}`, `GET /api/cases/{id}`, `POST /api/cases/{id}/evaluate` | yes (writes recommendation + interaction warnings) | `missing` | none |
| J08 | Officer review action — approve | `POST /api/cases/{id}/review` with action=approve | yes | `missing` | none |
| J09 | Officer review action — reject | `POST /api/cases/{id}/review` with action=reject | yes | `missing` | none |
| J10 | Officer review action — request_info | `POST /api/cases/{id}/review` with action=request_info | yes | `missing` | none |
| J11 | Officer review action — escalate | `POST /api/cases/{id}/review` with action=escalate | yes | `missing` | none |
| J12 | Officer review action — modify | `POST /api/cases/{id}/review` with action=modify | yes | `missing` | none |
| J13 | Audit package retrieval | `GET /api/cases/{id}/audit` | no | `missing` | none |
| J14 | Decision notice rendering | `GET /api/cases/{id}/notice`, `POST /api/screen/notice` | no | `missing` | none |
| J15 | Life-event posted to a case | `POST /api/cases/{id}/events`, `GET /api/cases/{id}/events` | yes (appends event) | `missing` | none |
| J16 | Case event timeline UI | `/cases/{id}` event-timeline section | no | `built` | [`screen.spec.ts`](../../web/e2e/screen.spec.ts) `govops-019` block |

### C. Government-leader surface (cross-jurisdiction read-only)

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J17 | Compare program — EI across 6 jurisdictions | `/compare/ei`, `GET /api/programs/ei/compare` | no | `built` | [`compare.spec.ts`](../../web/e2e/compare.spec.ts) — table, JP exclusion, a11y |
| J18 | Compare program — OAS across 7 jurisdictions | `/compare/oas`, `GET /api/programs/oas/compare` | no | `missing` | none — only EI is tested |
| J19 | Citation impact across jurisdictions | `/impact`, `GET /api/impact` | no | `partial` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) renders the page only |

### D. ConfigValue admin (Law-as-Code v2.0 substrate)

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J20 | Browse + search ConfigValues | `/config`, `GET /api/config/values` | no | `partial` | [`admin-flow.spec.ts`](../../web/e2e/admin-flow.spec.ts) demo-seeded queue check |
| J21 | ConfigValue timeline (supersession chain) | `/config/{key}/{jurisdictionId}`, `GET /api/config/versions` | no | `missing` | none |
| J22 | ConfigValue diff between versions | `/config/diff`, `GET /api/config/values/{id}` | no | `missing` | none |
| J23 | Draft new ConfigValue | `/config/draft`, `POST /api/config/values` | yes | `partial` | [`admin-flow.spec.ts`](../../web/e2e/admin-flow.spec.ts) — API-level draft |
| J24 | Dual approval — APPROVE flow | `/config/approvals/{id}`, `POST /api/config/values/{id}/approve` | yes | `built` | [`admin-flow.spec.ts`](../../web/e2e/admin-flow.spec.ts) — full UI flow + resolve flip |
| J25 | Dual approval — REJECT flow (terminal) | `POST /api/config/values/{id}/reject` | yes | `built` | [`approval-actions.spec.ts`](../../web/e2e/approval-actions.spec.ts) — API driven |
| J26 | Dual approval — REQUEST-CHANGES flow | `POST /api/config/values/{id}/request-changes` | yes | `built` | [`approval-actions.spec.ts`](../../web/e2e/approval-actions.spec.ts) — API driven |
| J27 | Configure-without-deploy (dated supersession) | `/screen/ca` × 2 dates, `POST /api/screen` × 2 dates | no | `built` | [`configure-without-deploy.spec.ts`](../../web/e2e/configure-without-deploy.spec.ts) — full API + UI proof |
| J28 | Prompts management — list | `/config/prompts` | no | `missing` | none |
| J29 | Prompts management — edit | `/config/prompts/{key}/{jur}/edit`, `POST /api/config/values` | yes | `missing` | none |

### E. Encoder pipeline (LLM-assisted rule encoding)

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J30 | Encoder landing | `/encode` | no | `partial` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) renders page + runbook tabs |
| J31 | Start a new encoding batch | `/encode/new` | yes (creates batch) | `missing` | none — burns LLM tokens, sandbox-only |
| J32 | Review batch proposals (approve/modify/reject) | `/encode/{batchId}` | yes | `partial` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) — approval lock test |
| J33 | Emit YAML from approved batch | `POST /api/encode/batches/{id}/emit-yaml` | yes (writes to lawcode) | `missing` | none |

### F. Federation (Phase 8, admin-gated)

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J34 | Federation registry view | `/admin/federation`, `GET /api/admin/federation/registry` | no | `missing` | requires admin token |
| J35 | Fetch a signed pack | `POST /api/admin/federation/fetch/{pub}` | yes | `missing` | requires admin token |
| J36 | Enable a verified pack | `POST /api/admin/federation/packs/{pub}/enable` | yes | `missing` | requires admin token |
| J37 | Disable a pack | `POST /api/admin/federation/packs/{pub}/disable` | yes | `missing` | requires admin token |
| J38 | Fail-closed on unsigned pack | negative test of fetch/enable | n/a | `missing` | requires admin token |

### G. Ops + admin

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J39 | Admin landing | `/admin` | no | `partial` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) renders |
| J40 | Manual GC trigger | `POST /api/admin/gc` | yes | `missing` | requires admin token |
| J41 | LLM proxy passthrough | `POST /api/llm/chat` | yes (burns tokens) | `manual-only` | covered by 2026-04-29 35-curl smoke |
| J42 | Health endpoint | `GET /api/health` | no | `built` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) calls `api.health()` |
| J43 | Switch jurisdiction (legacy Jinja path) | `POST /api/jurisdiction/{code}` | yes (mutates session state) | `manual-only` | curl-pass only |

### H. About / framing / static content

| ID | Journey | Routes / APIs touched | Mutates? | Status | Existing coverage |
|---|---|---|---|---|---|
| J44 | About page — disclaimer + references | `/about` | no | `built` | [`about.spec.ts`](../../web/e2e/about.spec.ts) — full coverage incl. 5-author SPRIND citation, masthead CTAs |
| J45 | Walkthrough — 7-step paid-vacation scenario | `/walkthrough` | no | `built` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) — full 7-step |
| J46 | Policies (privacy notice) | `/policies` | no | `partial` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) renders |
| J47 | Authority chain browse | `/authority`, `GET /api/authority-chain`, `GET /api/legal-documents`, `GET /api/rules` | no | `partial` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) renders |
| J48 | Index/landing — modules + actors + walkthrough CTA | `/` | no | `built` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) — full coverage |

### I. Cross-cutting (matrix-style — run across many or all routes)

| ID | Matrix | Coverage | Status | Existing coverage |
|---|---|---|---|---|
| M01 | a11y — axe WCAG 2.1 AA | every public route | `partial` | [`a11y.spec.ts`](../../web/e2e/a11y.spec.ts) — covers some routes; needs to be route-table-driven |
| M02 | SSR head — non-empty `<title>` per route | every route | `partial` | [`ssr-head.spec.ts`](../../web/e2e/ssr-head.spec.ts) — partial; needs full route table |
| M03 | i18n locale matrix | every public route × 6 locales | `partial` | [`i18n.spec.ts`](../../web/e2e/i18n.spec.ts) — selector + EN→FR only; needs full matrix |
| M04 | Cross-browser smoke | every public route × {chromium, firefox, webkit} | `partial` | [`playwright.config.ts`](../../web/playwright.config.ts) — 3 projects configured; not all specs run on all 3 |
| M05 | Help drawer — route-aware content | every route | `built` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) |
| M06 | Breadcrumb behavior — sticky, present/absent | every route | `built` | [`smoke.spec.ts`](../../web/e2e/smoke.spec.ts) |
| M07 | Masthead CTAs — GitHub + Pages | global | `built` | [`about.spec.ts`](../../web/e2e/about.spec.ts) `govops-016a` |

---

## Summary — what's built and what isn't

| Status | Count | % of catalog |
|---|---|---|
| `built` | 14 | 25% |
| `partial` | 17 | 30% |
| `missing` | 21 | 38% |
| `manual-only` | 3 | 5% |
| **Total journeys** | **55** (J01–J48 + M01–M07) | |

### The 21 `missing` journeys (priority order for build)

**Officer surface gap — the entire B section** (J07–J15 except J16): no E2E covers the case-evaluate → review-action → audit cycle, even though it's the load-bearing demo flow. **9 missing journeys.**

**Federation gap — the entire F section** (J34–J38): admin-token-gated, never wired into Playwright. **5 missing journeys.**

**ConfigValue surfaces** (J21, J22, J28, J29): timeline, diff, prompts list/edit. **4 missing.**

**Encoder pipeline tail** (J31, J33): new-batch creation + emit-YAML. **2 missing** (J32 partial covers proposal review).

**Compare OAS** (J18): only EI is tested. **1 missing.**

### The 17 `partial` journeys — what's missing on each

Most are "page renders" smoke without assertions on the data flowing through. Promoting these to `built` is mostly adding the field-level + API-call assertions, not net-new specs.

### The 3 `manual-only`

J41 (LLM proxy), J43 (legacy switch-jurisdiction), and the implicit "every API endpoint returns 200" coverage from the 2026-04-29 curl smoke. Acceptable to leave manual-only if we always re-run the 35-curl smoke as part of the bench (it's fast and the runbook can wrap it).

---

## Run mechanics

### Targets

| Target | URL | When to use |
|---|---|---|
| `local` | localhost via existing [`web/playwright.config.ts`](../../web/playwright.config.ts) | development of bench specs themselves (spins up its own backend + frontend) |
| `hf` | `https://agentic-state-govops-lac.hf.space` | the canonical bench target |
| `custom` | any URL via `TEST_BENCH_TARGET=https://...` | future deploys (staging, alt jurisdictions, partner forks) |

### Invocation

```bash
# Full bench against HF (then auto-build run record)
cd web && npm run bench:hf

# Full bench against local (a `govops-demo` must be running on :8000)
cd web && npm run bench:local

# Bench against any custom target
cd web && TEST_BENCH_TARGET=https://your-deploy.example npm run bench:custom

# Single journey or set of journeys (regex against test title)
cd web && TEST_BENCH_TARGET=https://agentic-state-govops-lac.hf.space \
  npx playwright test --config=playwright.deploy.config.ts -g "\[J24\]"

# Re-build the run record from the last bench's JSON output (no test re-run)
cd web && npm run bench:record

# Cross-browser run (default is chromium-only; opt in to firefox/webkit)
cd web && TEST_BENCH_TARGET=https://agentic-state-govops-lac.hf.space \
  TEST_BENCH_BROWSERS=chromium,firefox,webkit npm run bench:custom

# Federation tests against a target with admin token (token bypasses on HF demo)
cd web && GOVOPS_ADMIN_TOKEN=secret TEST_BENCH_TARGET=https://my-deploy npm run bench:custom
```

### Run record format

Every run produces:

1. **Playwright HTML report** at `web/playwright-report-deploy/` (standard artifact, with traces + screenshots + videos on failure)
2. **Per-journey JSON** at `web/test-results-deploy/journey-records/{Jxx,Mxx}.json` — structured per-journey record, written by [`web/e2e/reporters/journey-reporter.ts`](../../web/e2e/reporters/journey-reporter.ts)
3. **Aggregated run record** at `docs/test-bench/runs/YYYYMMDD-HHMM-{target-slug}-v{version}.md` — diff-able markdown built by [`web/scripts/build-run-record.mjs`](../../web/scripts/build-run-record.mjs)
4. **Findings triage** (manual, optional) at `docs/test-bench/runs/YYYYMMDD-HHMM-findings.md` — human commentary categorizing failures (deploy-lag vs test-bug vs real-bug)

### Comparing two runs

```bash
diff -u docs/test-bench/runs/20260502-1808-agentic-state-govops-lac-hf-space-v2.1.0.md \
        docs/test-bench/runs/20260515-1400-agentic-state-govops-lac-hf-space-v0.5.0.md
```

A clean diff = no behavioral regression. The structured record is intentionally not free-form prose.

### Tagging discipline

Every test must carry a `[Jxx]` or `[Mxx]` tag in either its `test.describe()` or its `test()` title. The tag is the join key for the run record. Untagged tests fall into the "unattributed" bucket and emit a console warning at run end. See the journey catalog above for IDs.

---

## Maintenance discipline

When adding a new route or API endpoint:

1. Add a new journey row to the catalog above with status `missing`
2. Build the spec under [`web/e2e/`](../../web/e2e/) with the journey ID in the test title
3. Update the row to `built`
4. Re-run the bench against HF; the new run record proves the journey is real

When changing an existing journey's behavior:

1. Update the spec
2. Re-run the bench against the deploy that has the change
3. Compare run records pre/post — the diff should match the intended behavior change exactly

When a journey is deprecated:

1. Move the row to a `## Retired journeys` section at the bottom (don't delete — provenance matters)
2. Remove the spec
3. Re-run the bench; the journey's absence from the new record is the proof of retirement

---

## Bench framework — shipped components

| Component | Path | Purpose |
|---|---|---|
| Deploy config | [`web/playwright.deploy.config.ts`](../../web/playwright.deploy.config.ts) | Target-agnostic Playwright config; reads `TEST_BENCH_TARGET` |
| Journey reporter | [`web/e2e/reporters/journey-reporter.ts`](../../web/e2e/reporters/journey-reporter.ts) | Extracts `[Jxx]`/`[Mxx]` tags, writes per-journey JSON |
| Run-record aggregator | [`web/scripts/build-run-record.mjs`](../../web/scripts/build-run-record.mjs) | Folds JSON into the diff-able markdown record |
| Target-aware API fixture | [`web/e2e/fixtures/api.ts`](../../web/e2e/fixtures/api.ts) | Resolves backend URL from `TEST_BENCH_TARGET` / `E2E_BACKEND_URL` |
| `npm run bench:hf` | [`web/package.json`](../../web/package.json) | One-command invocation against the HF demo |
| `npm run bench:local` | same | One-command invocation against local `govops-demo` |
| `npm run bench:custom` | same | Any-URL target via `TEST_BENCH_TARGET` |
| `npm run bench:record` | same | Rebuild markdown record without re-running tests |

## Maintenance backlog (after first baseline)

- Promote remaining `partial` journeys to `built` by adding data-flow assertions (current count: 17 partial)
- Refactor `J20` (admin-flow demo seed) to assert "queue has any draft" rather than specific seed keys
- Refactor `J24` to look up draft visibility via API (more deterministic than the SPA route loader)
- File the J38 federation 500-on-unknown-publisher defect, leave the failing test in place as the regression detector
- Add cross-browser tier (currently chromium-only by default; opt-in via `TEST_BENCH_BROWSERS`)
- Wire a CI workflow that runs the bench against HF on a schedule + posts a diff between consecutive runs
