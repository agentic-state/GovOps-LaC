# GovOps Runbooks — INDEX

> Operational runbooks for recurring tasks. Goal: nothing load-bearing lives only in someone's head.
>
> Each runbook follows the same skeleton: **When to use → Pre-flight → Steps → Post-checks → Rollback → Common gotchas → Last validated**.

## When to reach for which

| Situation | Runbook |
|---|---|
| About to deploy a new version of GovOps to the HF Space | [`deploy-to-hf.md`](deploy-to-hf.md) |
| Tagging a release / preparing v0.6.0 / v1.0 / etc. — the "am I ready?" gate | [`release-readiness.md`](release-readiness.md) |
| A page renders but an interaction silently fails ("Failed to fetch", form does nothing, etc.) | [`debug-fetch-failure.md`](debug-fetch-failure.md) |
| The deploy is bad / commit was wrong / ConfigValue approved in error | [`rollback.md`](rollback.md) |
| Drafting an architectural decision record | [`draft-adr.md`](draft-adr.md) |
| Adding a new country / region to GovOps | [`add-jurisdiction.md`](add-jurisdiction.md) |
| Verifying lawcode + ConfigValue substrate integrity | [`data-validity.md`](data-validity.md) |
| Adding a new program (same shape or new shape) | [`add-program.md`](add-program.md) |
| Running an LLM-assisted encoding batch | [`encoder-batch.md`](encoder-batch.md) |
| Publishing or consuming a federated lawcode pack | [`federation-publish.md`](federation-publish.md) |
| Validating any deploy with the journey bench | [`../test-bench/RUNBOOK.md`](../test-bench/RUNBOOK.md) |

## Coverage map (the "100% tested" gates)

The release-readiness runbook composes these. Each is its own gate.

| Dimension | Gate | Wired? |
|---|---|---|
| Backend unit + integration | `pytest -q` (640 tests) + project-level Claude pre-commit hook | yes |
| UI journeys + a11y + i18n + cross-browser | Test bench against HF (55 journeys) | yes |
| API contracts | Bench's API journeys | partial |
| Data validity (lawcode YAML schema, ConfigValue chains) | `python scripts/validate_lawcode.py` | yes (CI) |
| Build artifact sanity (no localhost / 127.0.0.1 baked into bundle) | `node scripts/check-bundle-no-localhost.mjs` | yes (Dockerfile + CI) |
| Static analysis | CodeQL | yes (CI) |
| Secrets | gitleaks | yes (CI) |

## Maintenance

- When you find yourself doing something twice and it has gotchas — add a runbook.
- Update **Last validated** every time you actually run the runbook end-to-end.
- Common gotchas should reference workspace memory entries in `eva-foundation/.claude-memory/` so the *why* doesn't rot.
- Runbooks are P61-specific for now. If a pattern proves portable, promote it to `eva-foundation/docs/runbooks/` so other projects can copy it.

## Active backlog

The initial runbook ecosystem (10 runbooks) is now complete. Additions are warranted when:

- A new recurring operation surfaces that has gotchas worth capturing
- An existing runbook's "Last validated" date is older than the operation's actual change rate (the runbook drifted from reality — refresh it)

Candidate future runbooks if the patterns prove out:

- `incident-response.md` — SEV1 / outage handling (only useful once we have a real incident to ground it against)
- `quarterly-review.md` — runbook hygiene + memory pruning + dependency refresh as a routine
- `onboard-contributor.md` — the "first PR" path for an external contributor
