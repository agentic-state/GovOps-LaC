# Runbook: Rollback — recovering from a broken state

## When to use

Reach for this when something is wrong with what's deployed and you need to get back to a known-good state quickly. Three scenarios:

1. **HF Space deploy is broken** — visitors hitting errors, the bench reports a regression that didn't exist in the prior baseline, the Space crashed.
2. **A merged commit on `main` introduced a bad change** — bug found post-merge, needs to be undone.
3. **A ConfigValue was approved that shouldn't have been** — wrong value in the substrate; needs to be superseded out (NOT deleted — the record is part of the audit trail).

If the issue is "this change was OK but we've changed our minds," that's a forward-fix (new commit / new ConfigValue), not a rollback. Rollback is for "this is broken and people are seeing it."

## Pre-flight

Before rolling back, capture context so you don't lose information:

| Check | Command | Why |
|---|---|---|
| What's currently deployed on HF? | `git log hf/main --oneline -3` | The "thing being rolled back from" |
| What's the recovery target? | `git tag -l 'pre-deploy-*' | tail -3` | The "thing being rolled back to"; `deploy-to-hf.md` step 1 creates these |
| What changed between them? | `git log <recovery-tag>..hf/main --oneline` | What you're undoing — useful for the post-mortem |
| Capture a bench snapshot of the broken state | `npm run bench:hf && git add docs/test-bench/runs/*` | Documents the failure pattern; helps verify the rollback worked |

If a recovery tag doesn't exist, see [Common gotchas → No recovery tag](#common-gotchas) — recovery is harder but doable.

## Steps

### Scenario 1: rolling back the HF deploy

This is the standard case. Time-to-recovery is one push + the HF rebuild window (~5-10 min).

```bash
# 1. Identify the recovery tag from before the bad deploy
RECOVERY=pre-deploy-2026-05-02   # whichever tag corresponds to the last good state
git fetch origin --tags

# 2. Force-push the recovery state to HF
git push hf "$RECOVERY":main --force

# 3. Watch HF rebuild
until curl -s "https://huggingface.co/api/spaces/agentic-state/govops-lac" \
  | python -c "import sys, json; d=json.load(sys.stdin); print(d['runtime']['sha'])" \
  | grep -q "$(git rev-parse "$RECOVERY")"; do
  echo "[$(date +%H:%M:%S)] waiting for HF to flip..."
  sleep 30
done

# 4. Confirm the rollback by re-running the bench against HF
cd web && TEST_BENCH_TARGET=https://agentic-state-govops-lac.hf.space npm run bench:hf
```

The new bench record should match the pre-deploy baseline. Diff it explicitly:

```bash
diff -u docs/test-bench/runs/<pre-bad-deploy-baseline>.md \
        docs/test-bench/runs/<post-rollback>.md
# expected: minor delta (timestamps + durations); same pass/fail/skip set
```

### Scenario 2: reverting a bad commit on `main`

```bash
# 1. Identify the commit to undo
BAD=<sha of the bad commit>

# 2. Create a revert commit (not a hard reset — preserves history)
git revert "$BAD"
# editor opens; refine the message to explain WHY
git push origin main
```

If the bad commit is also on HF, follow Scenario 1 next. Origin and HF are independent — fixing one does not fix the other.

If the bad commit was a merge commit and you need to revert the entire merge:

```bash
git revert -m 1 "$MERGE_SHA"
```

### Scenario 3: reverting a bad ConfigValue approval

ConfigValue records are append-only. You don't delete them — you supersede them.

```bash
# 1. Find the bad value's id
curl -s "https://agentic-state-govops-lac.hf.space/api/config/values?status=active&key=<the.bad.key>" | jq

# 2. Identify what the value SHOULD be (the value before the bad one was approved)
curl -s "https://agentic-state-govops-lac.hf.space/api/config/versions?key=<the.bad.key>&jurisdiction_id=<jur>" | jq

# 3. Draft a new ConfigValue that supersedes the bad one
#    — same key, the correct value, an effective_from date that takes effect immediately,
#    — `supersedes` field set to the bad value's id
curl -s -X POST "https://agentic-state-govops-lac.hf.space/api/config/values" \
  -H "Content-Type: application/json" \
  -d '{
        "domain": "rule",
        "key": "<the.bad.key>",
        "jurisdiction_id": "<jur>",
        "value": <correct value>,
        "value_type": "<type>",
        "effective_from": "<now ISO8601>",
        "citation": "Rollback of approved-in-error config",
        "author": "<you>",
        "rationale": "Rollback rationale here",
        "supersedes": "<bad-value-id>"
      }'

# 4. Approve via the dual-approval flow (or via the UI at /config/approvals)
```

The audit trail now shows: bad value approved at T1, superseded by correct value at T2. Both records remain — auditors can see the full sequence.

### Scenario 4: rolling back a tag

If a tag was pushed but the release was bad and nobody-public has consumed it yet:

```bash
TAG=v0.5.1
git tag -d "$TAG"
git push origin ":$TAG"
```

If the tag has been observed (consumed by GitHub Releases, anyone has cloned it, etc.), DO NOT delete. Roll forward instead — fix the issue and tag `v0.5.2`. Deleted tags that someone has fetched create messy local-vs-remote state for them.

## Post-checks

The rollback is done when:

- [ ] The state on HF (or origin, or the substrate) matches the intended recovery target
- [ ] Re-run of the bench / pytest / smoke test confirms the broken behavior is gone
- [ ] A post-mortem note is captured — at minimum a one-line memory entry or runbook annotation explaining why the rollback happened, so the same trap can be avoided next time
- [ ] If the rollback was on HF, a new recovery tag has been created for the post-rollback state (so the next deploy attempt has its own anchor)

## Rollback (of the rollback)

Yes, even rollbacks have rollbacks. If the rollback itself made things worse:

- HF: push the previous (broken) state back. The recovery tag from pre-flight is still valid.
- Origin: `git revert` the revert.
- ConfigValue: draft another supersession.

Append-only history means everything is recoverable as long as you don't `git push --force` over a SHA nobody has tagged. Tag aggressively before any destructive action.

## Common gotchas

- **No recovery tag.** `deploy-to-hf.md` step 1 creates one every deploy. If you skipped it, you can still find the previous HF state from `git log hf/main` (the orphan-snapshot SHA before today's push). Push that SHA to HF directly: `git push hf <previous-orphan-sha>:main --force`. After recovery, immediately tag it — every state needs an anchor.

- **HF "doesn't roll back."** It does — but the rebuild takes the same 5-10 min as the original deploy, AND the asset hashes will change (vite produces hashes from content). Don't expect the post-rollback bundle path to match what was there before the bad deploy. The behavior is what matters.

- **Reverting a merge commit incorrectly.** `git revert` on a merge commit needs `-m 1` (keep mainline). Without `-m`, git refuses; with `-m 2`, it reverts the wrong side.

- **Force-pushing main on origin without coordination.** Don't. P61 has branch-protection disabled (per memory), but force-pushing `origin main` rewrites everyone's local clone next pull. Use `git revert` on origin; reserve force-push for the HF orphan-snapshot pattern.

- **Trying to `delete` a ConfigValue.** The API doesn't expose deletion (by design — ADR-008 dual-approval + audit trail integrity). Supersede it; that's the only correct path.

- **Treating "things look weird" as a rollback trigger.** If the bench is green and pytest passes and the substrate is sane, the issue might be perception, not regression. Reproduce the failure in a journey first; rollback only when the failure is real and reproducible.

## Last validated

- **2026-05-02** by Claude (this session) — partial: scenario 1 (HF rollback) is the canonical pattern that emerged from the 5-bench deploy sequence; the recovery tag `pre-v0.5-deploy-2026-05-02` was created and is in place. Scenarios 2-4 are documented from existing P61 patterns (git revert, ConfigValue supersession via dual-approval, tag deletion) — proven in code but not yet exercised end-to-end via this runbook.
