# Runbook: Adding a new jurisdiction

## When to use

When adding a country / region to GovOps's coverage. Adds full execution support for one or more programs in a new legal context. Currently supported jurisdictions: CA, BR, ES, FR, DE, UA, JP.

This is the canonical onboarding path for a new contributor or a partner government wanting their jurisdiction represented.

Since v3.1 (ADR-020), the `JURISDICTION_REGISTRY` is built at startup by walking `lawcode/` — **adding a jurisdiction no longer requires a Python edit**. Drop the right YAML in the right place, restart (or hit the registry-reload endpoint), and the new jurisdiction appears.

If the goal is just running an existing jurisdiction in a federated/external repo (publishing a signed pack to be consumed by a GovOps instance you don't control) — that's `federation-publish.md` (backlog), not this.

## Pre-flight

| Check | Command | Why |
|---|---|---|
| Source statutes available | (manual) gather links to authoritative legal text | Every rule needs a citation; without statute access, you can't author rules honestly |
| Backend tests pass on `main` | `pytest -q` | Establishes the baseline before any change |
| The current release phase accepts new jurisdictions | confirm with the maintainer or check the README's "Current state" / CHANGELOG for a freeze marker | Some phases freeze new jurisdictions during structural work to limit migration cost (e.g. the v2.0 YAML externalization phase) |
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
├── config/
│   ├── jurisdiction.yaml    # ADR-019 metadata block + ConfigValue defaults
│   ├── oas-rules.yaml       # substrate values (per-parameter, dated)
│   └── ei-rules.yaml
└── programs/
    ├── oas.yaml             # program manifest (ADR-014)
    ├── oas.md               # plain-language sidecar for non-coder review
    ├── ei.yaml
    └── ei.md
```

Every TODO marker in those files is a hand-fill point. The skeleton is schema-valid the moment it lands; `pytest` confirms structure before you edit a single citation.

The metadata block at the top of `config/jurisdiction.yaml` is what the v3.1 loader reads to register the jurisdiction. The scaffolder + loader paths are pinned together by `tests/test_cli_init.py::TestInitLoaderRoundTrip` — if you change one, the test will tell you the other drifted.

### Step 2 — Fill the metadata block in `config/jurisdiction.yaml`

The top-level `jurisdiction:` block (per ADR-019) carries identity the loader needs: country code, level, parent_id, localized names, legal tradition, language regime, default language. Replace the TODO markers with values specific to the jurisdiction.

The `defaults:` and `values:` blocks beneath it remain the ConfigValue substrate for citizen-facing surfaces (e.g. the `howto_url` link from `/screen`).

Common authorship traps:
- **Don't paste another country's structure.** Each country's authority chain is genuinely different (federal vs. unitary, codified constitution vs. unwritten, etc.). Encode what THIS country actually has.
- **Citations should be statutory, not editorial.** Cite "Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(1)" — not "the OAS rules from the government website."

### Step 3 — Encode each program's manifest + rules

For every program in `--shapes`, the scaffolder created `programs/<id>.yaml` and `config/<id>-rules.yaml`. Edit these:

**`programs/<id>.yaml`** — declares the program's shape (`old_age_pension`, `unemployment_insurance`, etc.), its localized name (`name: { en: ..., fr: ..., ... }`), the authority chain, the legal documents, and the rules. The authority chain inside this file is what `/authority` will render when the jurisdiction is selected in the picker (ADR-020).

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

### Step 4 — Add demo cases (in the manifest, not in Python)

Since v3.1 L2b, demo cases live in `lawcode/<code>/programs/<id>.yaml` under a top-level `demo_cases:` key — **not** in `src/govops/jurisdictions.py`. See `lawcode/ca/programs/oas.yaml` for the canonical example, or any of the 6 jurisdictions migrated by L2b (`lawcode/{br,es,fr,de,ua,jp}/programs/oas.yaml`).

Required: **4 demo cases per program**, covering the canonical outcome quartet:

1. **Eligible-full** — applicant qualifies, full benefit
2. **Ineligible** — applicant fails a hard rule (age, status, etc.)
3. **Partial** — applicant qualifies for partial benefit (e.g. 25/40 years residency for OAS)
4. **Insufficient evidence** — applicant might qualify but is missing a required document

Cases are realistic — fictional names, plausible biographies, evidence that exercises the engine paths. They are public-facing demos; treat them with the care you'd put into onboarding documentation.

### Step 5 — Reload the registry (no Python edit, no restart for tests)

Since v3.1 L3 (ADR-020), the `JURISDICTION_REGISTRY` dict is built at module import by `build_registry_from_lawcode()`. A new `lawcode/<code>/` directory is picked up automatically on the next process start.

For an already-running instance, call:

```python
from govops.jurisdictions import reload_registry
reload_registry()
```

This rebuilds the dict in place; existing references stay valid because the dict object is mutated, not replaced.

There is no `JURISDICTION_REGISTRY = { ... }` literal to edit. If you find yourself adding entries to that file, you're working from a pre-v3.1 runbook — stop and re-check.

### Step 6 — Add UI surfaces (`/screen` is still hardcoded)

Two frontend changes — `/authority` and `/compare` are registry-driven and need no UI edit, but `/screen` still carries a static allowlist.

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

Migrating these to the same registry-driven path as `/authority` is a v3.2 candidate; for now the static allowlist is the contract.

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

All five must pass. The pytest suite includes per-jurisdiction tests that use the demo cases to confirm the engine produces the right outcomes — those are your acceptance criteria. `TestInitLoaderRoundTrip` will also catch any drift between the scaffolder and the loader.

### Step 9 — Add a journey test (optional but strongly recommended)

For each new jurisdiction, the `web/e2e/journeys/citizen.spec.ts` per-jurisdiction screen test (J02) is a parameterized loop — adding the jurisdiction to the loop's input is one line. The bench will then exercise the new jurisdiction on every run.

If the new program has cross-program interactions (e.g. EI + OAS in CA), add an interaction warning entry to `src/govops/program_interactions.py` and a journey test in `web/e2e/journeys/officer.spec.ts`.

### Step 10 — Land via PR

ADR optional unless the new jurisdiction introduces a new shape, a new rule type, or a new pattern of interactions. If it just adds another country using the existing shape library, no ADR — the manifest plus its demo cases is the documentation.

## Post-checks

Jurisdiction is properly added when:

- [ ] `govops-demo` boots and `/screen/<new-jur>` renders the form
- [ ] `POST /api/screen` for the new jurisdiction returns a recommendation
- [ ] `/authority?jurisdiction=<new-jur>` renders the authority chain
- [ ] All 4 demo cases produce the expected outcomes (per-jurisdiction pytest)
- [ ] `validate_lawcode.py` passes — YAML conforms to schema
- [ ] All 6 locales render the jurisdiction's display name without missing keys
- [ ] The bench's J02 (citizen self-screen per-jurisdiction) passes for the new code
- [ ] If the jurisdiction has a different official-language family (RTL, non-Latin script), a screenshot pass confirms the UI handles it

## Rollback

Removing a jurisdiction is rare but valid — e.g. statutory change made the encoding obsolete and a re-encode is needed.

```bash
git rm -r lawcode/<jur>/
git rm web/src/messages/<locale-only-for-this-jur>.json    # if applicable
# Update web/src/lib/types.ts SCREEN_JURISDICTIONS to drop the code
# Update web/src/routes/screen.tsx JURISDICTION_LABELS
git commit -m "chore: remove <jur> jurisdiction (encoding obsolete; will re-add post-statute-update)"
```

The loader will skip the missing directory on next startup; no Python edit needed. The git history preserves the prior encoding — re-adding later starts from the diff.

## Common gotchas

- **Forgetting the screen allowlist (web/src/lib/types.ts).** This is the single most common bug when adding a jurisdiction — the engine works, the API works, but the UI 404s on `/screen/<new-jur>`. The 2026-04-29 v2.1 smoke test caught exactly this for JP. Always update the allowlist when registering a new jurisdiction.

- **Pasting another country's authority chain.** Tempting because the existing structure is right there in the manifests; wrong because each country's legal hierarchy is genuinely different. Encode what the new jurisdiction's statute actually says.

- **Citations that aren't statutes.** A citation like "Wikipedia article on Polish pensions" is editorial, not authoritative. The engine treats every citation as a statutory reference an auditor can chase. Government website URLs are OK as supplementary `howto_url` references on the jurisdiction's metadata, but the rule's `citation` field must be the statute itself.

- **Forgetting to bump test-count claims in the README + CHANGELOG.** When new jurisdiction tests land, any "N backend tests" claim in the README's "Current state" section or in the in-flight CHANGELOG entry drifts. Update in the same PR.

- **i18n debt.** The translation validator (`check-i18n-translation.mjs`) catches strings that look untranslated (e.g. "Welcome" appearing in `pl.json`). If you can't translate everything, add the key to `web/scripts/i18n-translation-allowlist.json` with a comment explaining why (proper noun, brand token, etc.).

- **Editing `src/govops/jurisdictions.py` looking for a registry to extend.** Pre-v3.1 runbooks instructed this; the literal no longer exists. The discovery is `build_registry_from_lawcode()` and the source of truth is `lawcode/<code>/`. If you find yourself wanting to add a Python entry, the runbook you're following is stale.

- **Editing `routeTree.gen.ts` manually.** That file is regenerated on every build. Edit only the files `govops init` produced under `lawcode/<jur>/`, plus the UI allowlists in step 6.

## Last validated

- **2026-05-11** — runbook rewritten for v3.1 lawcode-as-discovery (ADR-020). The CA/BR/ES/FR/DE/UA/JP migrations are the working reference; the cli_init → loader round-trip is pinned by `tests/test_cli_init.py::TestInitLoaderRoundTrip`.
