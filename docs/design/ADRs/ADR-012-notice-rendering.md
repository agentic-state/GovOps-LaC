# ADR-012 — Notice rendering: derived artefact, template-as-ConfigValue

**Status**: Accepted
**Date**: 2026-04-27
**Track / Gate**: Law-as-Code v2.0 / Phase 10C (notification artefact)

## Context

Phase 10C adds the citizen-facing decision notice — the portable, audit-bearing artefact a citizen leaves a screening or case evaluation with. Two design questions need a load-bearing answer before code lands:

1. **Is a notice an entity (saved as a row, owns an id, retrieved by reference) or a derived artefact (computed on demand from the case + the dated template)?**
2. **Where does the notice template live, and what value_type does it have in the substrate?**

Both questions have natural defaults that look right and are wrong:

- *Entity-default*: "save the notice when generated; future fetches return the saved blob." Tempting because it solves byte-stability cheaply. But it duplicates audit-of-record (the case + recommendation + dated rules already hold everything needed), introduces a new write path, and breaks under template indexation (a notice saved in March looks different from the same notice re-rendered in April even when the law hasn't changed).
- *Code-template-default*: "ship Jinja templates under `src/govops/templates/`." Tempting because it matches Phase 0–6 patterns. But it shoves the notice's actual user-facing text into a deploy-required surface, exactly the anti-pattern the substrate is built to fix. A typo in a French notice should be a YAML PR, not a release.

## Decision

### A notice is a derived artefact

A notice is not an entity. There is no `Notice` row, no `notice_id`, no persistence of rendered HTML or PDF bytes. Each render is a deterministic function of:

- the **case** (or transient screen request),
- the **recommendation** (already saved on the case),
- the **template** in effect on the recommendation's evaluation date (resolved from the substrate),
- the **i18n strings** in effect on the same date (also substrate),
- the **engine version** (recorded as a metadata field on the rendered notice).

Reproducibility comes from these inputs alone. An auditor in 2030 re-runs the render against the case from 2025 with the substrate as it stood in 2025 and gets byte-identical output.

To make tampering detectable without persisting the bytes, every render emits a `notice_generated` audit event recording:

- `template_key` (e.g. `global.template.notice.ca-oas-decision`)
- `template_version` (the ConfigValue id of the record that resolved)
- `notice_sha256` (hash of the rendered HTML)
- `language`
- `rendered_at` (UTC timestamp)

The audit chain is the proof; the bytes are the demonstration. If you have the audit event and the substrate-as-it-was, you can reproduce the bytes and verify the hash. If you only have the hash, you have a tamper-detection primitive without a private store.

### Notice templates are ConfigValues with `value_type=template`

Templates live in YAML under `lawcode/<jurisdiction-or-global>/notices.yaml` (or the canonical config file for the jurisdiction), keyed under the `template` domain. Each record's `value` is a Jinja template body. We extend `schema/configvalue-v1.0.json`'s `value_type` enum with `template` (alongside the existing `prompt` / `formula`).

Why a new value_type instead of reusing `prompt`:

- **Different audit posture.** Prompts are LLM input: a bad prompt produces wrong AI output, possibly silently. Templates are user-facing output: a bad template produces wrong notices, observably. Reviewers care about different things; the value_type is the discriminator.
- **Different review shape.** Prompts often need ML-aware review (does this prompt nudge the model toward bias?). Templates need legal/comms-aware review (does this notice convey the decision accurately and in plain language?). The substrate value_type lets the approval queue route to the right reviewer pool.
- **Future divergence.** Templates may eventually grow a structured spec (sections, signatures, footer requirements). Prompts will grow constraints (max tokens, model gates). Sharing the type today freezes future divergence.

### Dual-approval applies (per ADR-008, by analogy)

Notice templates are dual-approved like prompts: `author` ≠ `approved_by`. The schema condition added in ADR-008 for `value_type=prompt` extends to `value_type=template`. Operationally, the approvals queue UI treats them as the same queue but tags them with their value_type; reviewers self-select by competence.

### Surface

`GET /api/cases/{case_id}/notice` returns the notice as `text/html`, with `?lang=<code>` for locale override (default: case jurisdiction's default). The HTML is stand-alone — no JS, no remote stylesheets, inlined CSS — so a citizen who saves the page or pipes it through their browser's "Print to PDF" gets a self-contained artefact.

A binary PDF endpoint (`GET /api/cases/{case_id}/notice.pdf`) is deferred to a follow-on commit. The HTML is the load-bearing artefact; PDF is a packaging concern that depends on a binding-dependency choice (WeasyPrint, xhtml2pdf, headless Chrome — all have trade-offs around Windows installation pain) and warrants a separate ADR if non-trivial.

## Consequences

**Positive**:

- The audit-of-record stays exactly one thing: the case + recommendation + dated substrate. The notice is a *view* over that record, not a parallel record.
- Translators and policy editors can correct a notice via a YAML PR. Same path as any other ConfigValue. Same review gate. Same audit trail.
- Reproducing a 2030 dispute about a 2025 notice means: pull the case, pull the substrate snapshot from then, render. The hash matches, or the audit shows what changed and when.
- The `notice_generated` audit event makes tampering observable (a leaked PDF whose hash doesn't match any audit event is provably not a real GovOps notice).

**Negative**:

- Re-rendering on every request costs CPU. Not a bottleneck at demo scale; if it ever becomes one, a content-addressable cache keyed by `(case_id, template_version, language)` is invisible to the contract.
- Templates as YAML are awkward to author for designers used to live editors. Mitigated by the existing prompt-edit UI (Phase 6) which already handles long-text editing with diff preview; templates ride that surface.

**Neutral**:

- The `template` value_type is a one-line schema delta (enum extension). No data migration. Existing records are unaffected.

## Cross-references

- [PLAN.md](../../../PLAN.md) §Phase 10C — entry/exit
- [ADR-006](ADR-006-per-parameter-granularity.md) — per-parameter granularity (one record per template)
- [ADR-008](ADR-008-prompt-as-config-dual-approval.md) — dual-approval pattern, extended to `value_type=template`
- [ADR-010](ADR-010-sqlite-from-phase-6.md) — substrate persistence (templates hydrate alongside other records)
- [ADR-011](ADR-011-calculation-rules-as-typed-ast.md) — calculation rules whose output the notice surfaces
- `src/govops/notices.py` (new) — rendering + audit emission
- `lawcode/global/notices.yaml` (new) — seed templates per jurisdiction
- `tests/test_notices.py` (new) — render + audit + hash determinism
