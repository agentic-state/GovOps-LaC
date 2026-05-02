# Runbook: Adding a new jurisdiction

## When to use

When adding a country / region to GovOps's coverage. Adds full execution support for one or more programs in a new legal context. Currently supported jurisdictions: CA, BR, ES, FR, DE, UA, JP.

This is the canonical onboarding path for a new contributor or a partner government wanting their jurisdiction represented.

If the goal is just running an existing jurisdiction in a federated/external repo (publishing a signed pack to be consumed by a GovOps instance you don't control) — that's `federation-publish.md` (backlog), not this.

## Pre-flight

| Check | Command | Why |
|---|---|---|
| Source statutes available | (manual) gather links to authoritative legal text | Every rule needs a citation; without statute access, you can't author rules honestly |
| Backend tests pass on `main` | `pytest -q` | Establishes the baseline before any change |
| The PLAN allows new jurisdictions in this phase | grep current PLAN file in `eva-foundation/plans/` for "freeze" or "v3 architectural control" | Some phases freeze new jurisdictions to limit migration cost |
| Locale for translations | check `src/govops/i18n.py` for the language code; if new, plan to add it | All UI strings must localize |

## Steps

### Step 1 — Use the v3 scaffolder

GovOps v3 ships a `govops init` command that produces a complete schema-valid skeleton:

```bash
govops init pl --shapes oas,ei
```

This writes:

```
lawcode/pl/
├── jurisdiction.yaml
├── programs/
│   ├── oas.yaml          # program manifest (ADR-014)
│   ├── oas.md            # plain-language sidecar for non-coder review
│   ├── ei.yaml
│   └── ei.md
└── config/
    ├── oas-rules.yaml    # substrate values (per-parameter, dated)
    └── ei-rules.yaml
```

Every TODO marker in those files is a hand-fill point. The skeleton is schema-valid the moment it lands; `pytest` confirms structure before you edit a single citation.

### Step 2 — Fill the jurisdiction.yaml

Authoritative metadata about the jurisdiction itself: country code, official languages, currency, authority chain (constitution → acts → regulations → policies). Each authority reference must include a citation a reader can look up.

Common authorship traps:
- **Don't paste another country's structure.** Each country's authority chain is genuinely different (federal vs. unitary, codified constitution vs. unwritten, etc.). Encode what THIS country actually has.
- **Citations should be statutory, not editorial.** Cite "Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(1)" — not "the OAS rules from the government website."

### Step 3 — Encode each program's manifest + rules

For every program in `--shapes`, the scaffolder created `programs/<id>.yaml` and `config/<id>-rules.yaml`. Edit these:

**`programs/<id>.yaml`** — declares the program's shape (`old_age_pension`, `unemployment_insurance`, etc.), its name in each official language, the legal authority (which Act / Code), and the rule_ids the engine will dispatch to.

**`config/<id>-rules.yaml`** — the dated `ConfigValue` records that supply each parameter the engine touches. Age thresholds, residency minima, calculation coefficients, accepted legal statuses, evidence requirements. Each record has:
- `key` — the parameter name (matches what the engine resolves)
- `value` — the parameter's value at the effective date
- `effective_from` — when this value takes effect
- `citation` — where in statute this value comes from (load-bearing)
- `author`, `rationale` — who encoded it and why

The plain-language sidecar `programs/<id>.md` is generated alongside the YAML so a non-coder program leader can review without reading YAML. Regenerate any time:

```bash
govops docs lawcode/pl/programs/oas.yaml
```

### Step 4 — Add demo cases

Demo cases live in `src/govops/jurisdictions.py` per the existing pattern (see `_brazil_demo_cases`, `_spain_demo_cases`, etc. for examples).

Required: **4 demo cases per program**, covering the canonical outcome quartet:

1. **Eligible-full** — applicant qualifies, full benefit
2. **Ineligible** — applicant fails a hard rule (age, status, etc.)
3. **Partial** — applicant qualifies for partial benefit (e.g. 25/40 years residency for OAS)
4. **Insufficient evidence** — applicant might qualify but is missing a required document

Cases are realistic — fictional names, plausible biographies, evidence that exercises the engine paths. They are public-facing demos; treat them with the care you'd put into onboarding documentation.

### Step 5 — Register in JURISDICTION_REGISTRY

In `src/govops/jurisdictions.py`, add an entry to the registry at the bottom of the file:

```python
JURISDICTION_REGISTRY: dict[str, JurisdictionPack] = {
    # ... existing entries ...
    "pl": JurisdictionPack(
        jurisdiction=POLAND,
        authority_chain=POLAND_AUTHORITY_CHAIN,
        legal_documents=POLAND_LEGAL_DOCS,
        rules=POLAND_RULES,
        cases_factory=_poland_demo_cases,
        default_language="pl",
        program_name="<canonical pension name in Polish>",
    ),
}
```

The constants `POLAND`, `POLAND_AUTHORITY_CHAIN`, etc. are defined earlier in the same file alongside the demo-case factory.

### Step 6 — Add UI surfaces

Two frontend changes:

**`web/src/lib/types.ts`** — add the jurisdiction code to the screen allowlist:

```ts
export const SCREEN_JURISDICTIONS = ["ca", "br", "es", "fr", "de", "ua", "jp", "pl"] as const;
```

The route loader for `/screen/$jurisdictionId` calls `notFound()` if the param isn't in this allowlist. **Forgetting this is a known gotcha** — see the v2.1 smoke-test memory entry for the JP allowlist case that bit us 2026-04-29.

**`web/src/routes/screen.tsx`** — add the jurisdiction's display label:

```ts
const JURISDICTION_LABELS = {
  ca: "Canada",
  // ...
  pl: "Polska",   // display in the jurisdiction's own language
};
```

**`web/src/routes/screen.$jurisdictionId.tsx`** — add the program-name fallback (the network-failure fallback map).

### Step 7 — Add translations

Add the new jurisdiction's localized strings to `web/src/messages/<locale>.json` for every supported locale. The ICU + key-parity validators (`web/scripts/check-i18n-icu.mjs`, `web/scripts/check-i18n-keys.mjs`) run as `prebuild`; missing keys break the build.

If introducing a new language (the new jurisdiction's locale isn't already supported):
- Add a new `web/src/messages/<locale>.json` with full key coverage
- Update the language selector in `web/src/components/govops/LanguageSelector.tsx`
- Add the locale to `src/govops/i18n.py` for backend strings

### Step 8 — Run the tests

```bash
pytest -q                                    # backend
python scripts/validate_lawcode.py            # YAML schema validity
cd web && npm run check:i18n                  # frontend i18n key parity
cd web && npm run build                       # full build incl. prebuild gates
cd .. && cd web && node scripts/check-bundle-no-localhost.mjs   # build-artifact sanity
```

All five must pass. The pytest suite includes per-jurisdiction tests that use the demo cases to confirm the engine produces the right outcomes — those are your acceptance criteria.

### Step 9 — Add a journey test (optional but strongly recommended)

For each new jurisdiction, the `web/e2e/journeys/citizen.spec.ts` per-jurisdiction screen test (J02) is a parameterized loop — adding the jurisdiction to the loop's input is one line. The bench will then exercise the new jurisdiction on every run.

If the new program has cross-program interactions (e.g. EI + OAS in CA), add an interaction warning entry to `src/govops/program_interactions.py` and a journey test in `web/e2e/journeys/officer.spec.ts`.

### Step 10 — Land via PR

ADR optional unless the new jurisdiction introduces a new shape, a new rule type, or a new pattern of interactions. If it just adds another country using the existing shape library, no ADR — the registration is the documentation.

## Post-checks

Jurisdiction is properly added when:

- [ ] `govops-demo` boots and `/screen/<new-jur>` renders the form
- [ ] `POST /api/screen` for the new jurisdiction returns a recommendation
- [ ] All 4 demo cases produce the expected outcomes (per-jurisdiction pytest)
- [ ] `validate_lawcode.py` passes — YAML conforms to schema
- [ ] All 6 locales render the jurisdiction's display name without missing keys
- [ ] The bench's J02 (citizen self-screen per-jurisdiction) passes for the new code
- [ ] If the jurisdiction has a different official-language family (RTL, non-Latin script), a screenshot pass confirms the UI handles it
- [ ] Authority chain in `/authority` for the new jurisdiction renders the full constitution → act → regulation → policy chain

## Rollback

Removing a jurisdiction is rare but valid — e.g. statutory change made the encoding obsolete and a re-encode is needed.

```bash
# Remove from registry
git rm src/govops/jurisdictions.py        # then edit to drop the entry; commit
git rm -r lawcode/<jur>/
git rm web/src/messages/<locale-only-for-this-jur>.json    # if applicable
# Update web/src/lib/types.ts SCREEN_JURISDICTIONS
# Update web/src/routes/screen.tsx JURISDICTION_LABELS
git commit -m "chore: remove <jur> jurisdiction (encoding obsolete; will re-add post-statute-update)"
```

The git history preserves the prior encoding — re-adding later starts from the diff.

## Common gotchas

- **Forgetting the screen allowlist (web/src/lib/types.ts).** This is the single most common bug when adding a jurisdiction — the engine works, the API works, but the UI 404s on `/screen/<new-jur>`. The 2026-04-29 v2.1 smoke test caught exactly this for JP. Always update the allowlist when registering a new jurisdiction.

- **Pasting another country's authority chain.** Tempting because the existing structure is right there in the code; wrong because each country's legal hierarchy is genuinely different. Encode what the new jurisdiction's statute actually says.

- **Citations that aren't statutes.** A citation like "Wikipedia article on Polish pensions" is editorial, not authoritative. The engine treats every citation as a statutory reference an auditor can chase. Government website URLs are OK as supplementary `howto_url` references on the program manifest, but the rule's `citation` field must be the statute itself.

- **Forgetting to bump the test counts in CLAUDE.md or PLAN files.** When new jurisdiction tests land, the canonical test counts in CLAUDE.md ("640 backend tests") drift. Update them in the same PR.

- **i18n debt.** The translation validator (`check-i18n-translation.mjs`) catches strings that look untranslated (e.g. "Welcome" appearing in `pl.json`). If you can't translate everything, add the key to `web/scripts/i18n-translation-allowlist.json` with a comment explaining why (proper noun, brand token, etc.).

- **Using `govops init` and then editing the routeTree.gen.ts manually.** Don't — that file is regenerated on every build. Edit only the files `govops init` produced under `lawcode/<jur>/`, plus the registration in `jurisdictions.py`.

## Last validated

- **Pending** — this runbook documents the conventions visible across CA/BR/ES/FR/DE/UA/JP. The next jurisdiction added will be the first end-to-end run.
