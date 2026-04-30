# Contributing to `lawcode/`

This directory holds the **dated, citable rules** that GovOps resolves against. You can contribute without writing Python — every record is a YAML entry with a stable shape, validated by CI.

> Field reference, resolution semantics, and how to extend the schema live in [`schema/README.md`](../schema/README.md). This file covers the **workflow** for editing or adding records.

## Who edits what

| If you are… | You will likely edit… |
| --- | --- |
| A domain expert encoding a new rule | A new entry in `lawcode/<jurisdiction>/config/rules.yaml` |
| A translator | A `ui.label.*.<lang>` row in `lawcode/global/ui-labels.yaml` |
| A maintainer adjusting an LLM prompt | An entry in `lawcode/global/prompts.yaml` (requires dual approval per [ADR-008](../docs/design/ADRs/ADR-008-prompt-as-config-dual-approval.md)) |
| An engineer changing engine defaults | An entry in `lawcode/global/engine.yaml` |
| A program leader adding a program (v3) | A new manifest at `lawcode/<jurisdiction>/programs/<program-id>.yaml` (per [ADR-014](../docs/design/ADRs/ADR-014-program-as-primitive.md)); pick a shape from [`schema/shapes/`](../schema/shapes/README.md) |

If your change spans multiple files, that is normal — rule parameters often need new UI labels and may need new accepted-evidence types. Keep all of them in **one PR** so the reviewer sees the full picture.

## Transitional RACI

Roles in an open-source public-good project don't formalise the way they do in a state agency. This table is a **working sketch** — it tells you, for each kind of change, who **does** the work, who **owns** the merge, who must be **consulted**, and who's **informed** by the result. Override per-PR if the situation warrants; just say so in the PR description.

> R = Responsible (does the work) · A = Accountable (signs off, owns the merge — at most one per row) · C = Consulted (input needed before merge) · I = Informed (sees the change after merge, no veto)

| Activity | Domain expert | Translator | Encoder agent | Reviewer (peer) | Maintainer | CI gate | Citizen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Draft a rule parameter (human-encoded) | **R** | – | – | C | **A** | C | I |
| Draft a rule parameter (agent-proposed via encoder pipeline) | C | – | **R** | C | **A** | C | I |
| Ratify a rule parameter | – | – | – | **R** | **A** | C | I |
| Draft a translation (`ui.label.*.<lang>`) | – | **R** | – | – | **A** | C | I |
| Ratify a translation | – | – | – | **R** | **A** | C | I |
| Draft a prompt change (`value_type=prompt`) | C | – | C | – | **R** | **A** | I |
| Ratify a prompt change (per [ADR-008](../docs/design/ADRs/ADR-008-prompt-as-config-dual-approval.md), reviewer ≠ author) | – | – | – | **R** | **A** | C | I |
| Modify the JSON Schema (`schema/*.json`) | C | – | – | C | **R/A** | C | I |
| Onboard a new jurisdiction | **R** | C | – | C | **A** | C | I |
| Add a program manifest (v3, ADR-014) | **R** | C | – | C | **A** | C | I |
| Run validators + tests on every PR | – | – | – | – | – | **R/A** | I |

**Read it like this**: to draft a rule parameter, a domain expert does the work (R) and writes the YAML; the maintainer is accountable (A) for whether it merges; a peer reviewer is consulted (C); the CI gate is consulted (it must pass); and citizens are informed because the merged record is on the public registry.

A few specific notes:

- **The maintainer is Accountable on every row** — they own the merge button. Different from R: an agent can be R for a draft, but a human is always A.
- **Per ADR-008**, prompt changes require a peer reviewer who is not the author. This is enforced editorially (reviewers should refuse if they are the author) and surfaced by the approvals queue UI.
- **Citizens always show as Informed**, because every approved record is on the public registry and queryable by citation.
- **CI gate is "Consulted"** for content changes (must pass before merge) and "R/A" for the act of running gates itself. Don't merge a red CI build.
- **Encoder agents are R**, never A. Agents can do work; only humans can sign for it. This is the core "agent-drafted, human-ratified" posture made explicit.

### When the RACI doesn't fit

The transitional table covers the common cases. When it doesn't fit (e.g., a cross-jurisdiction federation pull, an emergency rule rollback, a legal-team-driven change), state the deviation explicitly in the PR. The reviewer's job is to confirm the deviation is reasonable; the maintainer's job is to merge or block based on that.

## The workflow

1. **Open the YAML file** for the area you are touching. Your editor (VS Code with the Red Hat YAML extension recommended) reads the `yaml-language-server: $schema=…` pragma at the top and gives you autocomplete + inline validation.

2. **Add or edit the record.** Use the templates below. Match the indentation; do not introduce tabs (YAML is space-only). Keep the file alphabetically ordered by `key` where the existing file is — it keeps diffs small and review fast.

3. **Validate locally.** From the repo root:
   ```bash
   python scripts/validate_lawcode.py --file lawcode/<your-file>.yaml
   ```
   Errors print with the offending key and a preview of the offending value. Fix the message; re-run.

4. **Run the full validator** before committing:
   ```bash
   python scripts/validate_lawcode.py --summary
   ```
   The summary table prints record counts per domain × jurisdiction so you can sanity-check that you added records under the right domain.

5. **Open a PR.** CI runs the same validator (`.github/workflows/ci.yml`), the no-hardcoded-constants regression guard, and the full Python test suite in both lenient and strict modes.

6. **Review.** A maintainer (different from you, where ADRs require it) reviews the diff. Changes that touch `value_type=prompt` records require a separate `approved_by` per ADR-008. Changes that touch a citation field should reference the statute by its full canonical form.

7. **Merge.** On merge, the YAML is the source-of-truth. Runtime substrate (per [ADR-010](../docs/design/ADRs/ADR-010-sqlite-from-phase-6.md)) hydrates from these files on next startup; old runtime edits are preserved alongside.

## Templates

Copy, paste into the file under your jurisdiction or domain, edit the values.

### Rule parameter (per-jurisdiction)

```yaml
- key: ca.rule.age-65.min_age            # lowercase, dotted, jurisdiction-prefixed
  value: 65                              # match the value_type
  value_type: number
  effective_from: "1985-01-01"           # ISO-8601, quoted (avoids the YAML 1.1 norway bug)
  citation: "OAS Act, R.S.C. 1985, c. O-9, s. 3(1)"
  author: <your-handle>
  approved_by: <reviewer-handle>          # optional for non-prompt records, but encouraged
  rationale: "Original statutory minimum age."
```

### UI label (per-language)

One record per language. The same key with a different `.<lang>` suffix exists per locale. Translators usually duplicate the EN row and change `value` + the `.<lang>` suffix.

```yaml
- key: ui.label.case.applicant_profile.fr
  value: "Profil du demandeur"
  value_type: string
  language: fr
  effective_from: "1900-01-01"
```

### Prompt (dual-approval required)

Per [ADR-008](../docs/design/ADRs/ADR-008-prompt-as-config-dual-approval.md), `value_type=prompt` records require both `author` and `approved_by`, and they must be distinct people.

```yaml
- key: global.prompt.encoder.<purpose>
  citation: "GovOps encoder v0.2"
  rationale: "Why this prompt; what it instructs the LLM to do."
  author: <author-handle>
  approved_by: <reviewer-handle>          # MUST differ from author
  effective_from: "1900-01-01"
  value: |-
    You are a legal rule extraction engine for GovOps.
    ...
```

### Engine threshold

Engine defaults that span jurisdictions — accepted evidence types, fallbacks, etc.

```yaml
- key: global.engine.evidence.dob_types
  value:
    - birth_certificate
    - passport
    - id_card
  value_type: list
  effective_from: "1900-01-01"
  rationale: "Accepted evidence for date-of-birth verification across all programs."
```

### Global config

Application-wide constants (default language, supported locales).

```yaml
- key: global.config.default_language
  value: en
  value_type: string
  effective_from: "1900-01-01"
```

## Common gotchas

- **The Norway bug**: bare `no` parses as boolean `false` in YAML 1.1. Always quote ISO country/language codes (`"no"`, not `no`). The validator catches this; quote pre-emptively to avoid surprise.
- **Effective dates** are ISO-8601, quoted strings. `'1900-01-01'` is the convention for "always in effect"; `'2027-01-01'` for a future-dated change.
- **Defaults merge field-by-field**, so a `defaults.value_type` is overridden by a per-record `value_type`. Use defaults for what's *common*; override per-record for what differs.
- **One record per language for UI labels** — do not put a mapping of language → string into one `value`. The substrate's resolver expects per-language keys.
- **Citations are mandatory** for `domain=rule` records (editorial convention, not schema). Without a citation, a reviewer cannot verify the change.
- **Don't supersede destructively**. To change a value going forward, add a NEW record with the new `effective_from`; do not edit the existing record's `value`. The substrate keeps both, and old evaluations remain reproducible.

## Pre-flight checklist

Before opening the PR, run through this once:

- [ ] `python scripts/validate_lawcode.py --summary` exits 0
- [ ] `python scripts/validate_lawcode.py --file <your-file>` exits 0
- [ ] Citations point at exact section / paragraph numbers, not just the act
- [ ] Effective dates are quoted ISO-8601
- [ ] If a `value_type=prompt` record changed, `author` and `approved_by` are different people
- [ ] If a UI label was added, the same key exists for every supported locale (or a follow-up issue is filed for missing translations)
- [ ] The PR description references the statute / regulation that motivated the change
