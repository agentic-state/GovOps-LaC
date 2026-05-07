# Runbook: Release readiness — the pre-tag gate

## When to use

Before you tag a release (`git tag v0.6.0`, etc.) or before you deploy a milestone version to HF. The composite gate that asks: **am I ready to ship?**

Not for hotfixes (use a stripped version of this — only the relevant gates). Not for routine WIP commits.

## Pre-flight

Two preconditions before this runbook is even applicable:

- You're on `main` with a clean working tree
- The change set you're about to release is logically complete (no half-shipped features behind feature flags that aren't documented)

If either fails, finish the work first.

## Steps

The release readiness gate is **every dimension of "tested"**. Each step is one gate. Don't skip any.

### Gate 1 — Backend correctness

```bash
pytest -q
```

**Expected**: every test passes (current baseline: 640). The pre-commit Claude hook also enforces this on every commit, so this should always be clean — but always re-run before tagging.

If any test fails, **stop**. Fix the test or fix the code. Tagging with red tests is forbidden.

### Gate 2 — Data validity

```bash
python scripts/validate_lawcode.py
```

**Expected**: all `lawcode/**/*.yaml` validate against `schema/lawcode-v1.0.json` and `schema/configvalue-v1.0.json`. CI also runs this, but a local pre-tag run catches issues before they hit a release branch.

If any fail, the YAML doesn't conform — fix the file before proceeding.

### Gate 3 — Build artifact sanity

```bash
cd web
npm run build
node scripts/check-bundle-no-localhost.mjs
cd ..
```

**Expected**: build succeeds; the localhost-grep returns no hits in `dist/client/assets/*.js`. This catches the class of bug where a misconfigured build inlines a developer-only URL into the production bundle (the bug that bit us 2026-04-29 → 2026-05-02; see [`feedback_build_pattern_pivot_audit`](../../../eva-foundation/.claude-memory/feedback_build_pattern_pivot_audit.md)).

### Gate 4 — Local journey bench (optional but recommended)

If you have a `govops-demo` running on `:8000`:

```bash
# In one terminal: the local backend
govops-demo

# In another:
cd web
TEST_BENCH_TARGET=http://127.0.0.1:8000 npm run bench:custom
```

**Expected**: same pass count as your most recent canonical bench-local baseline. Promote any unexpected failure to a fix before tagging.

This gate is "optional" because the HF bench (gate 7) covers most of the same ground; but local-bench is faster feedback and catches issues that may be deploy-environment-independent.

### Gate 5 — Version bump alignment

Three places need to agree on the version:

| File | Field | Authoritative? |
|---|---|---|
| `pyproject.toml` | `version = "X.Y.Z"` | yes — this is the canonical version |
| `web/package.json` | `"version": "X.Y.Z"` | should match `pyproject.toml` |
| `src/govops/api.py:321` | `"version": "X.Y.Z"` in the health endpoint | currently hardcoded; should match (known maintenance item) |

Bump all three to the new version in a single commit:

```bash
# Edit the three files
git diff pyproject.toml web/package.json src/govops/api.py
git add pyproject.toml web/package.json src/govops/api.py
git commit -m "chore(release): bump version to X.Y.Z"
```

### Gate 6 — Documentation truth-check

The README describes what's IMPLEMENTED. The PLAN (in workspace memory) describes what's COMING.

- Does the README claim anything that doesn't exist yet? Fix it.
- Does the README omit a load-bearing feature that just shipped? Add a row.
- Are screenshots in `docs/screenshots/v2/` representative of the current UI? If a feature changed, refresh the screenshot.
- Does CLAUDE.md's "Active Track" section reflect the new release scope? Update it.

(There's no automated check for this — it's eyes-on. Spend 5 minutes.)

### Gate 7 — Tag and push origin

```bash
git tag -a vX.Y.Z -m "release: vX.Y.Z — <one-line summary>"
git push origin main
git push origin vX.Y.Z
```

GitHub Actions runs CI (CodeQL, gitleaks, the lawcode validator). Wait for green.

### Gate 8 — Deploy to HF

Hand off to [`deploy-to-hf.md`](deploy-to-hf.md). Run that runbook end-to-end.

### Gate 9 — Post-deploy bench

Inside the deploy runbook (step 8). The HF bench's run record is the **canonical proof of release**. Compare to the previous release's run record:

```bash
diff -u docs/test-bench/runs/<previous-release-baseline>.md \
        docs/test-bench/runs/<this-release-baseline>.md
```

A clean diff = no regression. Any new failure must be triaged before declaring the release shipped.

## Post-checks

The release is shipped when:

- [ ] Tag `vX.Y.Z` pushed to origin
- [ ] CI green on the tagged commit
- [ ] HF deploy runbook completed without rollback
- [ ] HF bench run record committed and diffs cleanly against prior baseline
- [ ] Recovery tag `pre-deploy-YYYY-MM-DD` exists on origin

## Rollback

This runbook is composite. Rollback at the level where the failure occurred:

- Backend test failure (gate 1) → fix the code, retry. No rollback needed; the tag wasn't created yet.
- Data validity failure (gate 2) → fix the YAML, retry.
- Build-artifact sanity failure (gate 3) → audit the build pipeline (Dockerfile env vars, vite config). Use [`debug-fetch-failure.md`](debug-fetch-failure.md) if the symptom is "page rendered but action fails."
- Bench failure (gate 4 or 9) → triage per `docs/test-bench/RUNBOOK.md`'s findings-doc protocol.
- HF deploy failure (gate 8) → use the rollback section in [`deploy-to-hf.md`](deploy-to-hf.md). The recovery tag from gate 7 is your anchor.
- After tag is pushed but before deploy → you can rewrite history (`git tag -d vX.Y.Z; git push origin :vX.Y.Z`). Acceptable as long as the tag wasn't observed by anyone else yet.
- After deploy is observed by users → roll forward (vX.Y.Z+1) rather than retract; rolling back a tag people have seen is anti-pattern.

## Common gotchas

- **You ran pytest yesterday and it was green; today it's red because of a dependency change.** Always re-run pytest at gate 1, never assume.
- **Version bumps drift across the three files.** The trio in gate 5 is easy to forget. Bump all three, every release.
- **Forgetting the recovery tag.** Gate 7's tag is the rollback anchor. Without it, HF rollback is harder.
- **Skipping the bench because "it'll just pass."** That's exactly when bugs hide. The 2026-05-02 regression hid through smoke-only verification; the bench was the first thing that exercised the actual user flow. Run the bench every release.

## Last validated

- **Pending first formal release** — this runbook was written 2026-05-02 with the v0.5.0 deploy as its grounding example. First real-world run will be the next tagged release.
