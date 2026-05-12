# Runbook: Running an LLM-assisted encoding batch

## When to use

When you have a chunk of legislative text (statute, regulation, policy bulletin) and you want to convert it into formalized rules + ConfigValue records that the engine can consume — without hand-typing every parameter.

The encoder is **assistance, not automation**. The LLM proposes rules; humans review them; only approved proposals get committed to lawcode YAML. The encoder's value is the first 80% of the keystrokes (extracting structure from prose); the audit and judgment stay human.

Don't use this for:
- Routine ConfigValue updates (a single threshold change). Just edit the YAML directly.
- Trivial supersessions (an existing value bumped to a new effective date). Use `/config/draft` in the UI.
- Anything that needs to ship same-day. The review path is deliberately careful.

## Pre-flight

| Check | Command | Why |
|---|---|---|
| LLM provider keys configured | `curl -s https://agentic-state-govops-lac.hf.space/api/health \| jq '.llm_providers'` | At least one of `groq`, `openrouter`, `gemini`, `mistral` must be present. The encoder uses the LLM proxy with failover. |
| Source legal text in hand | (manual) | The encoder operates on text you paste in — needs to be the actual statute, not a summary or commentary. |
| Target jurisdiction + program decided | (manual) | Each batch belongs to one program; mixing jurisdictions in one batch is a recipe for review errors. |
| Backend up | `curl -s $BASE/api/health` | The encoder is a backend feature; it can run against the local demo or a deployed instance. |

## Steps

### Step 1 — Open the encoder surface

Browse to `/encode` on whatever GovOps instance you're using. The page lists existing batches and exposes a "New extraction" link to `/encode/new`.

### Step 2 — Start a new batch

`/encode/new` exposes a form:

- **Batch label** — human-readable name (e.g. "OAS Act amendments 2026 March")
- **Jurisdiction** — which country/jurisdiction this batch is for
- **Program** — the program the rules will be assigned to (e.g. `oas`, `ei`)
- **Source text** — paste the legislative text. The encoder works best on a focused chunk (one section, one schedule, one sub-act) rather than an entire act dumped in.

Submit. The backend creates a batch record (`POST /encode/ingest`) and triggers the LLM to extract rule proposals.

### Step 3 — Wait for the LLM to propose rules

The LLM's job is to produce structured `RuleProposal` records that look like the manifest's `rules:` entries but with proposed values + citations extracted from the source text. Per `src/govops/encoder.py`, the response is parsed into `RuleProposal` objects with a `ProposalStatus` of `pending`.

This typically takes 5-30 seconds depending on the source text length and provider latency (Groq is fastest; Gemini and Mistral are fallbacks).

If the LLM proxy hits a rate limit on the primary provider, the request fails over to the next (Groq → OpenRouter → Gemini → Mistral). If all four fail, the batch surfaces an error — wait a few minutes and retry.

### Step 4 — Review each proposal

Browse to `/encode/<batch-id>`. The page lists every proposal with:

- The proposed rule type, description, citation, parameters
- The source text snippet the LLM extracted from
- An approve / modify / reject button per proposal

For each proposal, read both the LLM's extraction AND the original source text. The LLM's failure modes are well-known:

- **Hallucinated citations** — the LLM invents a section number that sounds right but doesn't exist in the source. Always confirm by ctrl-F'ing the citation text against the source.
- **Subsection scope errors** — citation says "s. 7" but the rule is actually in "s. 7(2)(b)". The narrower citation is usually correct.
- **Coefficient typos** — number in the rule doesn't match the source. Always verify numbers against source.
- **Authority chain confusion** — the LLM may attribute a rule to a regulation when statute is the actual authority. Read the source's hierarchical structure.

For each proposal: **approve**, **modify** (edit then approve), or **reject** (with comment).

### Step 5 — Approve as a second reviewer (if dual-approval required)

ADR-008 establishes dual-approval for prompts and ConfigValues. If your jurisdiction's policy requires it, a second reviewer must approve before the batch can emit YAML. This is policy-driven, not technical — the API will let one approver land everything if dual-approval isn't enforced upstream.

### Step 6 — Emit the YAML

Once all proposals in the batch are reviewed (every proposal is approved, modified-and-approved, or rejected), trigger emission:

```bash
curl -s -X POST "$BASE/api/encode/batches/<batch-id>/emit-yaml" \
  -H "Content-Type: application/json"
```

Or click "Commit batch" in the UI.

The endpoint:
- Generates ConfigValue records for every approved proposal's parameters
- Writes them to `lawcode/<jur>/config/<program>-rules.yaml` (appending to the existing file)
- Updates the batch's status to `committed`
- Returns the list of ConfigValue ids that were created

### Step 7 — Verify the emitted YAML

```bash
git diff lawcode/<jur>/config/<program>-rules.yaml
python scripts/validate_lawcode.py
pytest -q
```

The diff should match what was approved in the UI. The validator confirms the new YAML is schema-valid. The pytest suite catches any rules whose ConfigValue references don't resolve.

### Step 8 — Commit + PR

```bash
git add lawcode/<jur>/config/<program>-rules.yaml
git commit -m "encode(<jur>/<program>): import <description> from <source>

Source: <link to legal text>
Batch: <batch-id>
Approved by: <reviewer(s)>
Records added: <count>"
git push
gh pr create --fill
```

The encoder records its full audit trail (`EncodingAuditEntry` per `src/govops/encoder.py`), but the PR is the human-visible audit moment. Reviewers can confirm the diff matches the source text.

### Step 9 — Run the bench

After merge + deploy, the bench's J33 (`emit-yaml endpoint`) and the per-program journeys exercise the new rules in user flows. Confirm no regressions.

## Post-checks

The encoding session is complete when:

- [ ] Every proposal in the batch has been reviewed (no `pending` left)
- [ ] The batch's status is `committed`
- [ ] The new YAML in `lawcode/<jur>/config/<program>-rules.yaml` matches the approved proposals
- [ ] `validate_lawcode.py` passes
- [ ] `pytest -q` passes
- [ ] PR has landed
- [ ] If the rules introduce new behavior, demo cases were updated to exercise it

## Rollback

If a committed batch turns out to be wrong, the rollback path is supersession (per [`rollback.md` Scenario 3](rollback.md#scenario-3-reverting-a-bad-configvalue-approval)) — draft new ConfigValues that supersede the bad ones.

If the entire batch was wrong (LLM hallucinations got past review):

1. Identify all ConfigValue ids the batch created (the audit log on the batch page lists them)
2. Draft supersedence records for each — same key, correct value, `supersedes` field set
3. Approve the supersedences via the dual-approval flow
4. The original records remain in the audit trail with their `superseded_by` field populated; the substrate now resolves to the corrected values

For a batch that hasn't yet been committed, the rollback is just rejecting all proposals in the batch and abandoning it — no YAML was emitted.

## Common gotchas

- **Trusting the LLM's extraction.** The encoder is a productivity tool, not an authority. Every proposal must be verified against the source text. The bench's journey tests will eventually catch wrong values, but only after the substrate has been polluted; review at proposal time is much cheaper.

- **Mixing source documents in one batch.** A batch should correspond to ONE section / ONE schedule / ONE bulletin. Mixing two sources makes review messy because the citation context shifts mid-batch.

- **LLM proposing rules that already exist.** The encoder doesn't dedupe against existing ConfigValues. If the source text restates a rule that's already in the substrate, you'll get a duplicate proposal — reject it (or modify it to be a supersedence if the value changed).

- **Provider rate limits on long sessions.** A batch of 50+ proposals can exhaust Groq's free tier. The proxy fails over to OpenRouter / Gemini / Mistral, but those have their own limits. For large encoding sessions, break into smaller batches and pace.

- **LLM citations that mix Latin abbreviations weirdly.** The LLM sometimes produces "S. 7(2)(b)" vs "s. 7(2)(b)" vs "section 7(2)(b)". Inconsistency in citations breaks the impact-survey query (`GET /api/impact?citation=...`) because string equality matters. Modify proposals to use the canonical form (lowercase `s. <number>(<sub>)(<sub-sub>)`).

- **Forgetting `--allow-unsigned` is local-only.** When pulling federated packs from external publishers, `--allow-unsigned` exists for development. The encoder produces locally-authored records — these are signed by the local publisher key path, not by `--allow-unsigned`.

## Last validated

- **Pending end-to-end run** — this runbook documents the encoder's contract from `src/govops/encoder.py` (the data model + parsing) and `src/govops/api.py` (the routes). The encoder has shipped in v2.0 and is exercised by `tests/test_encoder.py`; the runbook will be validated the first time it's followed end-to-end against a real legislative source.
