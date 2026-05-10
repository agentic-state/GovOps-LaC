# Runbook: Deploy GovOps to the HF Space

## When to use

Any time you want the public demo at `https://agentic-state-govops-lac.hf.space` to reflect a newer version than what's currently running. Trigger events:

- Tagging a release (`v0.5.0`, `v0.6.0`, etc.)
- Hotfixing a production-visible bug
- Onboarding a new contributor and wanting them to see the same demo as the README screenshots

If you're just wanting CI / GitHub to be in sync with local — that's a regular `git push origin main`, not this runbook.

## Pre-flight

Run these checks before you even open this runbook in earnest. If any fail, fix the failure first.

| Check | Command | Expected |
|---|---|---|
| You are on `main`, in sync with `origin/main` | `git status -sb` | `## main...origin/main` (no `[ahead/behind]`) |
| Backend tests pass | `pytest -q` | `640 passed` (or current count) |
| Local build succeeds | `cd web && npm run build && cd ..` | exits 0; `web/dist/client/` populated |
| Build-artifact sanity | `cd web && node scripts/check-bundle-no-localhost.mjs` | exits 0 (no localhost / 127.0.0.1 in bundle) |
| Local bench passes | (optional but recommended; needs `govops-demo` running on `:8000`) | bench-local matches the most recent baseline |
| HF currently healthy | `curl -s https://agentic-state-govops-lac.hf.space/api/health` | `{"status":"healthy"...}` |

If any of these surfaces something unexpected, **stop**. Fix the underlying issue or open a PR; do not bypass.

## Steps

### 1. Tag the recovery anchor

The current state on HF is your only quick-revert target if the deploy breaks. Always tag it before pushing. The tag name embeds today's date so you can grep for it later.

```bash
git fetch hf
git tag -a "pre-deploy-$(date -u +%Y-%m-%d)" hf/main \
  -m "HF state at $(git rev-parse --short hf/main) before $(git rev-parse --short main) deploy"
git push origin "pre-deploy-$(date -u +%Y-%m-%d)"
```

### 2. (If web/ or Dockerfile changed) bump web/package.json version

HF reuses Docker layer caches aggressively. The stage-1 web-builder layer is keyed on `web/package.json` + `web/package-lock.json` content — if neither changed, vite build won't re-run, and you'll deploy a stale SPA.

When in doubt, bump the patch version:

```bash
# Edit web/package.json: "version": "0.5.0" → "0.5.1"
git add web/package.json
git commit -m "chore(web): bump web/package.json to align deploy build"
git push origin main
```

This is also the safety net against an exact-content match between two builds — it guarantees stage-1 invalidates.

### 3. Build the orphan branch

HF Spaces can't store binary files in git history (Xet storage required for things like `web/brand/govops-wordmark.png` and `web/bun.lockb`). The standard pattern is to push an **orphan branch** — a single squash commit with the current tree, no history.

```bash
git checkout --orphan hf-deploy-tmp
# Verify the orphan has all of main's files staged:
git status --short | wc -l   # expect ~520+
git commit -m "$(git describe --tags --abbrev=0 2>/dev/null || git rev-parse --short main) snapshot"
```

### 4. Force-push to HF

```bash
git push --force hf hf-deploy-tmp:main
```

You'll see `+ <old>...<new> hf-deploy-tmp -> main (forced update)`. That's correct.

If you see `Please use https://huggingface.co/docs/hub/xet to store binary files` — the orphan didn't strip history. Check `git log hf-deploy-tmp` — should show **one** commit only.

### 5. Clean up the orphan

```bash
git checkout main
git branch -D hf-deploy-tmp
```

### 6. Wait for HF to rebuild

Free-tier rebuild on `cpu-basic` is **5–15 minutes** depending on cache state. Two signals to watch:

```bash
# (A) Runtime SHA matches the new push
curl -s "https://huggingface.co/api/spaces/agentic-state/govops-lac" \
  | python -c "import sys, json; d=json.load(sys.stdin); print(d['runtime']['sha'], d['runtime']['stage'])"

# (B) The new SPA is being served — bundle hash changed
curl -s "https://agentic-state-govops-lac.hf.space/check" 2>&1 \
  | tr -d '\0' \
  | grep -oE 'index-[A-Za-z0-9_-]+\.js' \
  | head -1
```

The runtime SHA will flip first (build successful), then the served SPA flips (container restarted). Both must be in the desired state before proceeding.

### 7. Post-deploy probes

Run these against the live HF Space immediately after rebuild:

```bash
BASE=https://agentic-state-govops-lac.hf.space

# Sanity: service is up
curl -s "$BASE/api/health"

# Sanity: v3 endpoints respond (if deploying v3 or later)
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/programs/oas/compare"
curl -s -X POST "$BASE/api/check" \
  -H "Content-Type: application/json" \
  -d '{"jurisdiction_id":"ca","date_of_birth":"1958-01-01","legal_status":"citizen"}' \
  -o /dev/null -w "%{http_code}\n"

# Sanity: NO 127.0.0.1 baked into the deployed bundle (this catches the regression
# class documented in feedback_build_pattern_pivot_audit.md)
HASH=$(curl -s "$BASE/check" | tr -d '\0' | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "$BASE/assets/$HASH" | grep -c "127.0.0.1\|localhost:8000"
# expected: 0
```

### 8. Run the bench against HF

```bash
cd web
TEST_BENCH_TARGET=https://agentic-state-govops-lac.hf.space \
  npm run bench:hf
# After ~13 min, the run record lands at docs/test-bench/runs/YYYYMMDD-HHMM-...md
```

Compare the run record against the most recent canonical baseline:

```bash
diff -u docs/test-bench/runs/<previous-baseline>.md \
        docs/test-bench/runs/<this-run>.md
```

Expected: every previously-passing journey still passes. New failures should be triaged via the bench's findings-doc protocol.

## Post-checks

The deploy is done when **all** of these hold:

- [ ] HF API reports `runtime.sha == <local main sha or orphan sha>` AND `runtime.stage == "RUNNING"`
- [ ] `curl /api/health` returns the expected jurisdictions + LLM providers
- [ ] Build-artifact sanity grep returns 0 (no localhost/127.0.0.1 in bundle)
- [ ] Bench-hf produces a run record with no NEW failures vs the prior baseline
- [ ] Manual click-through on `/check`: fill form, submit, see results render (the journey bench covers this but a manual confirmation is cheap insurance)
- [ ] Run record committed under `docs/test-bench/runs/`
- [ ] Recovery tag `pre-deploy-YYYY-MM-DD` pushed to origin

## Rollback

If the deploy is bad and you need to restore HF:

```bash
git push hf "pre-deploy-YYYY-MM-DD":main --force
```

That's it. The recovery tag from step 1 is the single source of recovery truth. HF will rebuild from the tagged tree within ~10 min.

If the recovery tag wasn't created (you skipped step 1 — don't), you can find the previous HF state from the HF API:

```bash
curl -s "https://huggingface.co/api/spaces/agentic-state/govops-lac/main/tree" | head
```

…but this is harder. Just don't skip step 1.

## Common gotchas

These bit us before. References point at memory entries with the *why*.

- **Stage-1 docker cache hit serving stale SPA.** If `web/package.json` + `web/package-lock.json` haven't changed, HF will reuse the cached web-builder image and re-deploy the OLD `dist/client/`. Symptom: HF runtime SHA matches new push, but the served `/assets/index-*.js` is the previous hash. **Fix**: bump `web/package.json` version (step 2). See [project memory: HF v2.1 hosted demo plan](../../../eva-foundation/.claude-memory/p61_v2_1_hosted_demo_plan.md).

- **Bundle hardcodes `127.0.0.1:8000`.** Vite inlines `import.meta.env.VITE_API_BASE_URL` at build time. If the Dockerfile RUN step doesn't set it, api.ts's fallback (`http://127.0.0.1:8000`) gets baked in — and every visitor's browser tries to fetch from THEIR localhost. Page renders, smoke passes, every action silently fails. **Fix is now in the Dockerfile** (commit `6aa3a47`). The `node scripts/check-bundle-no-localhost.mjs` build-time gate now catches any future regression. See [feedback_build_pattern_pivot_audit](../../../eva-foundation/.claude-memory/feedback_build_pattern_pivot_audit.md).

- **Binary files block normal git push.** `web/brand/govops-wordmark.png` + `web/bun.lockb` exceed HF's git-storage policy. Always use the orphan-branch pattern (step 3). A regular `git push hf main` will be rejected.

- **`/api/health` reports stale version string.** `src/govops/api.py` hardcodes `"version": "2.1.0"`. The bench's run record will label v0.5.0 deploys as `v2.1.0` because it reads this field. This is a known minor inaccuracy; doesn't affect deploy correctness. Fix tracked in maintenance backlog.

- **`/check/life-event`, `/about` FR locale, `/config` SSR title** — known cookie-based SSR locale issues that survive across deploys. Documented in `docs/test-bench/runs/20260502-2210-findings.md` as pending root-cause. Don't treat their failure as a deploy regression.

## Last validated

- **2026-05-02** by Claude (this session) — bench-5 confirmed clean v0.5.0 deploy; 7 journey deltas matched expectations; runbook captures the playbook proven in this run.
