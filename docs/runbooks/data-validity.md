# Runbook: Data validity — verifying lawcode + ConfigValue substrate integrity

## When to use

Reach for this when:

- You suspect the substrate state is wrong — values resolving to unexpected results, supersession chains looking inconsistent, audit trails missing entries
- After a bulk YAML edit (e.g. adding a jurisdiction, encoding a new program, importing data from an external source)
- Before tagging a release — `release-readiness.md` invokes this as gate 2
- After a federation pack is merged — verify the imported records integrate cleanly with the existing substrate
- Investigating an audit-trail dispute — confirming what the substrate actually said on a given date

This runbook covers the substrate integrity. The schema-validity check (file shape) is a subset; the harder questions are chain integrity, citation presence, and date continuity.

## Pre-flight

```bash
# Backend up if you'll do live API checks
govops-demo &
DEMO_PID=$!

# Or if checking against HF:
BASE=https://agentic-state-govops-lac.hf.space
```

## Steps

### Step 1 — Schema validity (the floor)

```bash
python scripts/validate_lawcode.py
```

**Expected**: every YAML file under `lawcode/` validates against `schema/lawcode-v1.0.json` and every record satisfies `schema/configvalue-v1.0.json`. Exits 0 on success; non-zero with line numbers on failure.

This is the floor. If it fails, fix the file shape before doing anything else. CI runs this on every push, so a working tree should always pass — re-run after any bulk edit.

### Step 2 — Citation presence per rule

Every formalized rule must have a citation. A rule without a citation is a rule the engine will use to reach a decision — and the audit package won't be able to point at any statute supporting it. That's the failure mode this check exists for.

```bash
# Per-rule citation audit
python -c "
from govops.jurisdictions import JURISDICTION_REGISTRY
missing = []
for code, pack in JURISDICTION_REGISTRY.items():
    for rule in pack.rules:
        if not getattr(rule, 'citation', None):
            missing.append(f'{code}: {rule.id}')
if missing:
    print('Rules without citation:')
    for m in missing: print(f'  - {m}')
    raise SystemExit(1)
else:
    print('All rules have citations.')
"
```

### Step 3 — Supersession chain integrity

A ConfigValue's `supersedes` field points at the prior version it replaces. Chains must form a DAG (no cycles) and every active record must be reachable from a chain root.

```bash
# Check for orphan supersedes references (supersedes a value that doesn't exist)
curl -s "$BASE/api/config/values" \
  | python -c "
import sys, json
data = json.load(sys.stdin)
ids = {v['id'] for v in data['values']}
orphans = []
for v in data['values']:
    s = v.get('supersedes')
    if s and s not in ids:
        orphans.append((v['id'], s))
if orphans:
    print('Orphan supersedes references:')
    for cur, ref in orphans: print(f'  - {cur} → {ref} (target missing)')
    raise SystemExit(1)
print(f'No orphan supersedes refs across {len(data[\"values\"])} values.')
"
```

Cycle detection (heavier; only run when explicitly investigating):

```bash
curl -s "$BASE/api/config/values" \
  | python -c "
import sys, json
data = json.load(sys.stdin)
graph = {v['id']: v.get('supersedes') for v in data['values']}
cycles = []
for start in graph:
    seen, n = set(), start
    while n is not None and n in graph:
        if n in seen:
            cycles.append(start)
            break
        seen.add(n)
        n = graph.get(n)
if cycles:
    print(f'Cycles detected starting from: {cycles[:5]}')
    raise SystemExit(1)
print('No cycles in supersession graph.')
"
```

### Step 4 — Date continuity per key

For every key/jurisdiction pair, the `effective_from` dates of its versions should be monotonically increasing (newest version has the latest start date) and there shouldn't be gaps where no version is in effect.

```bash
# Per-key date audit
curl -s "$BASE/api/config/values?status=active" \
  | python -c "
import sys, json
from collections import defaultdict
data = json.load(sys.stdin)
by_key = defaultdict(list)
for v in data['values']:
    by_key[(v['key'], v.get('jurisdiction_id'))].append(v)
issues = []
for (key, jur), vs in by_key.items():
    vs.sort(key=lambda v: v.get('effective_from', ''))
    for i in range(len(vs) - 1):
        end = vs[i].get('effective_to')
        next_start = vs[i+1].get('effective_from')
        if end and next_start and end > next_start:
            issues.append(f'{key} ({jur}): version {vs[i][\"id\"]} ends {end}, next starts {next_start} (overlap)')
        if end and end < next_start:
            issues.append(f'{key} ({jur}): gap between {end} and {next_start}')
if issues:
    print('Date continuity issues:')
    for i in issues[:10]: print(f'  - {i}')
    raise SystemExit(1)
print(f'Date continuity clean across {len(by_key)} key/jurisdiction pairs.')
"
```

### Step 5 — Resolve-roundtrip on a sample of keys

A spot-check that the engine actually uses what the substrate has stored. Pick a representative key and confirm `resolve()` returns the expected value at known dates:

```bash
# Sample check: ca.calc.oas.base_monthly_amount has a 727.67 → 735.45 supersession
# at 2026-01-01. Both pre and post dates should resolve correctly.
for date in 2025-06-01 2026-06-01; do
  echo -n "$date: "
  curl -s "$BASE/api/config/resolve?key=ca.calc.oas.base_monthly_amount&jurisdiction_id=ca&evaluation_date=$date" \
    | python -c "import sys, json; r = json.load(sys.stdin); print(r.get('value'))"
done
# expected: 727.67 then 735.45
```

If the resolve returns null where it should return a value, one of these is true:
- The substrate doesn't have an `active` record covering that date (check Step 4)
- The key/jurisdiction combination was misnamed in the request (typo)
- The record exists but is in `draft` or `rejected` state (check `status` filter)

### Step 6 — Audit trail completeness on a sample case

Pick a case that has been evaluated and reviewed. Confirm the audit package reflects every step:

```bash
CASE=demo-case-001
curl -s "$BASE/api/cases/$CASE/audit" | python -m json.tool | head -50
```

Verify the audit contains:
- The case's input (applicant facts, evidence, evaluation date)
- The rule-by-rule trace (every rule the engine evaluated, its outcome, its citation)
- The resolved substrate values (every ConfigValue that fed into the decision, with its `id` and `effective_from`)
- The recommendation (the engine's output — eligible/ineligible/partial/insufficient_evidence)
- Any review actions taken (approve/reject/request_info/escalate, with reviewer + comment + timestamp)

Missing any of these = the audit-first invariant is broken; investigate.

### Step 7 — Citation impact survey (optional cross-cutting view)

How many places in the substrate cite a given statute? Useful for impact analysis when a statute is amended.

```bash
curl -s "$BASE/api/impact?citation=Old%20Age%20Security%20Act" | python -m json.tool | head -30
```

The response groups affected records by jurisdiction and key. Use this when planning a bulk supersession.

## Post-checks

Substrate validity is verified when:

- [ ] Step 1 (schema) passes — exits 0
- [ ] Step 2 (citations) passes — every rule cites a statute
- [ ] Step 3 (chain integrity) passes — no orphans, no cycles
- [ ] Step 4 (date continuity) passes — no gaps, no overlaps in active timelines
- [ ] Step 5 (resolve roundtrip) passes — the engine reads what the substrate stored
- [ ] Step 6 (audit completeness) passes for a representative case
- [ ] If any step failed, the failure is documented (in a memory entry, a run record, or a defect filing) before proceeding

## Rollback

Data-validity issues are recovered via the substrate's append-only model. See [`rollback.md` Scenario 3](rollback.md#scenario-3-reverting-a-bad-configvalue-approval) — supersede, don't delete.

For schema-level violations (Step 1), fix the YAML in a regular commit. The validator runs in CI; PRs with schema violations don't merge.

## Common gotchas

- **"Active" vs "all" in API queries.** `/api/config/values` defaults to all statuses; `?status=active` is what you usually want for runtime checks. Steps 3-4 use `active` because draft/rejected records aren't in effect.

- **Date strings as ISO-8601 with timezones.** `2026-01-01` (date-only) and `2026-01-01T00:00:00+00:00` (ISO-8601 UTC) are NOT the same string and won't sort or compare correctly. The substrate uses ISO-8601 with timezones — when constructing queries, match the format.

- **Citations that look right but reference the wrong subsection.** The schema validator can't catch this; only a domain-expert review can. For load-bearing values (calculation coefficients, age thresholds), have a second pair of eyes confirm the citation precision.

- **Resolving against the wrong jurisdiction id.** `ca` (just country) vs `ca-oas` (country+program — used for some legacy keys) is a frequent typo. If resolve returns null when you expect a value, double-check the jurisdiction_id you're passing.

- **Federation packs creating duplicate keys.** When a federated pack defines a key the local substrate also has, the merge isn't conflict-free. ADR-009's trust model treats the local substrate as authoritative; federation imports go in as a separate publisher namespace. Verify after federation merges that no duplicate-key collisions slipped through.

## Last validated

- **2026-05-02** by Claude — Steps 1, 5, and 7 confirmed against the live HF deploy during the v0.5.0 deploy validation. Steps 2, 3, 4, 6 documented from the schemas + API contracts but not yet exercised end-to-end via this runbook.
