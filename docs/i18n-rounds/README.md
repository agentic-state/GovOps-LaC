# i18n translation rounds

Each round of translation work archives its deliverable + provenance under a date-stamped subdirectory:

```
docs/i18n-rounds/
  YYYY-MM-DD/
    i18n-glossary.json          # EN → 5-locale validated terms reusable across rounds
    i18n-worklist.json          # rows flagged for translation in this round
    i18n-translations.json      # the deliverable: key → {locale: translation}
    i18n-translation-notes.md   # terminology, per-domain decisions, reviewer flags
```

The merge tool [scripts/merge_i18n_translations.mjs](../../scripts/merge_i18n_translations.mjs) auto-resolves to the most recent round, or accepts a path:

```bash
node scripts/merge_i18n_translations.mjs                                          # latest round
node scripts/merge_i18n_translations.mjs docs/i18n-rounds/2026-04-29/i18n-translations.json
```

After running, verify with `cd web && npm run check:i18n && npm run check:i18n:icu`.

## Round protocol

1. **Identify gaps.** Run a copy-paste-from-EN audit per locale (a row in `web/src/messages/<locale>.json` whose value is byte-identical to `en.json` and substantive — i.e. not a brand token, ICU placeholder, or single character).
2. **Export to CSV.** Generate `i18n-export-<date>.csv` (gitignored, intermediate transport).
3. **Translate.** External pass with the formal-register rules: vous (fr) / Sie (de) / usted (es) / você (pt) / formal ви (uk). Brand tokens stay verbatim — see the canonical list in any round's `i18n-translation-notes.md` §1.
4. **Materialize the deliverable.** Re-encode CSV into `i18n-translations.json` with shape `{key: {locale: translation}}`. Drop locales where the EN value is appropriate as-is (loanwords, cognates).
5. **Archive the round.** Drop all four artefacts into `docs/i18n-rounds/<YYYY-MM-DD>/`.
6. **Merge.** `node scripts/merge_i18n_translations.mjs`. Verify: 0 missing-from-catalog, key counts unchanged across locales.
7. **Test.** `npm run check:i18n`, `npm run check:i18n:icu`, the cross-browser Playwright `i18n.spec.ts` and `a11y.spec.ts`.

## Legitimate copy-paste residue

After every round there will be substantive cells that look like copy-paste from EN but aren't:

- **Brand / proper-noun tokens** — `GovOps`, `SPRIND`, `Lovable`, `FastAPI`, `TanStack`, `Tailwind`, `shadcn`, the Agentic State, etc.
- **Acronyms / standards** — `API`, `URL`, `JSON`, `YAML`, `OWASP`, `WCAG`, `ICU`, `MIT`, `Apache`.
- **Filenames** — `PLAN.md`, `configvalue-v1.0.json`, `LAW-AS-CODE.md`.
- **ICU placeholders / number formats** — `{count}`, `{date, date, medium}`, `# ms`.
- **Intentional loanwords** — e.g. `admin.federation.col.{actions,name,status,version}` — flagged in the round notes when accepted.
- **Developer-only operator strings** — `home.eyebrow` reads `spec govops-002 · law-as-code` in every locale because it's a developer reference, not user-facing copy.

These are codified in [web/scripts/i18n-translation-allowlist.json](../../web/scripts/i18n-translation-allowlist.json) — `global_keys` for every-locale exceptions, `per_locale_keys[<loc>]` for locale-specific cognates / loanwords. The [check-i18n-translation.mjs](../../web/scripts/check-i18n-translation.mjs) gate runs in `prebuild` and fails the build if a substantive non-EN value matches EN without being on the allowlist. New copy-paste cases force a deliberate decision: translate or allowlist.
