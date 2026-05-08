# GovOps i18n translation pass — reviewer notes

Source files
- `i18n-worklist.json` — 303 rows × 1,351 cells
- `i18n-glossary.json` — 412 EN→{fr,de,es-MX,pt-BR,uk} validated entries
- Output: `i18n-translations.json`

Generator: `scratch/generate_translations.py`. Glossary-first deterministic
table indexed by `(EN-string, locale)` plus per-key overrides for
context-sensitive cells. Self-verifies seven invariants before writing.

## 1. Working terminology table

The translations below are the **canonical mapping for this pass**. Where the
glossary already had an entry it was used verbatim; where it was missing
(many of the GovOps-specific verbs and process nouns) the entry was
authored against the formal-register rules (vous / Sie / usted / você /
formal ви) and aligned with the surrounding rows in the existing
`web/src/messages/<locale>.json` files.

| EN | fr | de | es-MX | pt-BR | uk |
|----|----|----|-------|-------|-----|
| GovOps | GovOps | GovOps | GovOps | GovOps | GovOps |
| Authority | Autorité | Autorität | Autoridad | Autoridade | Орган |
| Jurisdiction | Juridiction | Jurisdiktion | Jurisdicción | Jurisdição | Юрисдикція |
| Constitution | Constitution | Verfassung | Constitución | Constituição | Конституція |
| Decision | Décision | Entscheidung | Decisión | Decisão | Рішення |
| Rule | Règle | Regel | Regla | Regra | Правило |
| Cases | Dossiers | Fälle | Casos | Casos | Справи |
| Case (in `Case {id}`) | Dossier {id} | Fall {id} | Caso {id} | Caso {id} | Справа {id} |
| Citation | Citation | Fundstelle | Cita | Citação | Посилання |
| Audit | Audit | Audit | Auditoría | Auditoria | Аудит |
| Approve | Approuver | Freigeben | Aprobar | Aprovar | Затвердити |
| Approved | Approuvé | Freigegeben | Aprobado | Aprovado | Затверджено |
| Reject | Rejeter | Ablehnen | Rechazar | Rejeitar | Відхилити |
| Rejected | Rejeté | Abgelehnt | Rechazado | Rejeitado | Відхилено |
| Modify | Modifier | Ändern | Modificar | Modificar | Змінити |
| Modified | Modifié | Geändert | Modificado | Modificado | Змінено |
| Pending | En attente | Ausstehend | Pendiente | Pendente | Очікує |
| Escalate | Escalader | Eskalieren | Escalar | Escalar | Передати вище |
| Escalated | Escaladé | Eskaliert | Escalado | Escalado | Передано вище |
| Eligible | Admissible | Anspruchsberechtigt | Elegible | Elegível | Має право |
| Ineligible | Non admissible | Nicht anspruchsberechtigt | No elegible | Não elegível | Не має права |
| Insufficient evidence | Preuves insuffisantes | Unzureichende Nachweise | Evidencia insuficiente | Evidência insuficiente | Недостатньо доказів |
| Evidence | Preuves | Nachweise | Evidencias | Evidências | Докази |
| Encode | Encoder | Erfassen | Codificar | Codificar | Кодувати |
| Encoder | Encodeur | Encoder | Codificador | Codificador | Кодувальник |
| Engine | Moteur | Engine | Motor | Motor | Рушій |
| Schema | Schéma | Schema | Esquema | Esquema | Схема |
| Status | Statut | Status | Estado | Status | Статус |
| Type | Type | Typ | Tipo | Tipo | Тип |
| Name | Nom | Name | Nombre | Nome | Назва |
| Version | Version | Version | Versión | Versão | Версія |
| Actions | Actions | Aktionen | Acciones | Ações | Дії |
| Refresh | Actualiser | Aktualisieren | Actualizar | Atualizar | Оновити |
| Cancel | Annuler | Abbrechen | Cancelar | Cancelar | Скасувати |
| Country | Pays | Land | País | País | Країна |
| Legal status | Statut légal | Rechtsstatus | Situación legal | Situação legal | Правовий статус |
| Pension (full) | Pension complète | Volle Rente | Pensión completa | Pensão integral | Повна пенсія |
| Pension (partial) | Pension partielle | Teilrente | Pensión parcial | Pensão parcial | Часткова пенсія |
| Residency | Résidence | Aufenthalt | Residencia | Residência | Проживання |
| Workflow / pipeline | Statut→propositions→examen→validation (and similar) | Gesetz→Vorschläge→Prüfung→Festschreibung | (analogous) | (analogous) | (analogous) |
| Outcome | Résultat | Ergebnis | Resultado | Resultado | Результат |
| Recommendation | Recommandation | Empfehlung | Recomendación | Recomendação | Рекомендація |
| Reviewer | Examinateur | Prüfer·in | Revisor | Revisor | Рецензент |
| Locale | Langue | Sprache | Idioma | Idioma | Локаль |
| Wordmark | Logotype | Wortmarke | Logotipo | Logotipo | Логотип |
| Pass / Fail | Réussi / Échec | Bestanden / Fehlgeschlagen | Aprobado / Fallido | Aprovado / Reprovado | Пройдено / Не пройдено |
| Manual | Manuel | Manuell | Manual | Manual | Уручну |
| Diff | Différence | Diff | Diferencia | Diferença | Порівняння |
| Verdict | Verdict | Urteil | Veredicto | Veredito | Вердикт |

Brand / verbatim-keep tokens preserved exactly: GovOps, SPRIND, GitHub, GitHub Pages,
Lovable, FastAPI, TanStack, Tailwind, shadcn, React, Vite, Next.js, OAuth, OIDC,
Stripe, Entra, Azure, OWASP, MITRE, NIST, WCAG, ICU, MessageFormat, MIT, Apache,
The Agentic State, Tallinn Digital Summit, Deutsche Rentenversicherung, ConfigValue/ConfigValues,
plus all filenames (PLAN.md, configvalue-v1.0.json, LAW-AS-CODE.md, etc.) and
acronyms (API, URL, JSON, YAML, CSV, PDF, LLM, SQLite, MariaDB, MySQL, PostgreSQL).

## 2. Per-domain progress

### admin — 32 rows
- `admin.federation.col.{actions,name,status,version}`: existing values were
  already correct (loanwords identical to EN in the asked locales). Re-emitted
  unchanged: French “Actions”, German “Name/Status/Version”, Brazilian
  Portuguese “Status” are valid loans / cognates. These count as legitimate
  glossary-keep cases, not MT artefacts.
- `admin.health.{jurisdiction,program,status,version}`: French uses the
  required non-breaking space before `:` (rule 10).
- `admin.error.partial`: ICU plural — Ukrainian extended to one/few/many/other.

### encode — 50 rows
- `encode.method.llm`: kept `LLM (Claude)` verbatim — both are tradenames /
  acronyms.
- `encode.review.bulk.heading`: en collapses both branches to “# selected”;
  translations keep the gender/number distinction in fr/es/pt and use
  one/few/many/other in uk.
- `encode.review.commit.confirm.body` and `commit.success`: ICU plurals
  expanded for Slavic; placeholder names `{count}` preserved.

### cases — 60 rows
- `cases.detail.heading`: `Case {id}` → `Dossier {id}` (fr), `Fall {id}` (de),
  etc. Uses the same word as `nav.cases` to avoid splitting the term.
- `cases.recommendation.pension_type.{full,partial}` matches
  `screen.benefit.type.{full,partial}` for cross-screen consistency.
- `cases.review.action.{approve,modify,reject,escalate}` are the canonical
  glossary verbs; identical wording reused at `encode.proposal.*`.
- `cases.review.rationale.placeholder`: French uses « min. 20 caractères » for
  brevity; meaning preserved.

### authority — 27 rows
- `authority.layer.act` → fr `Loi`, de `Gesetz` (canonical statutory term;
  same word also used at `document_type.statute`).
- `authority.chain.selected.aria` and `documents.section.aria`: every
  placeholder name preserved verbatim.

### screen — 24 rows
- `screen.benefit.op.*`: rendered as lowercase verbs/nouns in EN (calculation
  trace tags). Kept lowercase in fr/es/pt/uk; capitalised in de because German
  nouns are capitalised (`Addieren`, `Konstante`, `Maximum`…).
- `screen.benefit.period.lump_sum` is ` (lump sum)` — leading space and
  parenthesis preserved.
- `screen.download.tooltip` German uses lower quotation marks „…“ as is
  conventional.

### home — 23 rows
- `home.hello = GovOps`: per-key override forces verbatim across all locales.
- `home.headline.before` keeps the trailing space; combined with
  `home.headline.accent` (= `System` translated per-locale) at render time.
- `home.eyebrow` is a literal spec string (`spec govops-002 · law-as-code`)
  and is intentionally kept verbatim in every locale — it’s a developer
  reference shown only to operators.

### about — 10 rows
- `about.references.project_home_desc` (de): rephrased to
  `Kanonische Startseite auf GitHub Pages für den GovOps-Prototyp.` so the
  brand `GitHub Pages` survives unhyphenated (rule 2 wins over German
  compound-noun convention).
- `about.frameworks.agentic.{name,subtitle}`: kept verbatim in every locale
  (rule 2 — both are proper-noun event/framework titles).
- `about.cta.project_home`: `GitHub Pages` kept verbatim.

### config / status / rule_type / outcome / document_type / rule_outcome / proposal_status — 36 rows
- Single-word status taxonomy translated from the glossary; e.g.
  `outcome.eligible` aligns with `cases.review.final_outcome`.
- `config.filter.jurisdiction.global` → fr/es/pt all use the cognate
  `Global`/`Global` per glossary; uk = `Глобальний`.
- `proposal_status.*` aligned 1:1 with `cases.review.action.*` derivatives.

### dataflow / draft / events / prompt / prompts — 13 rows
- `dataflow.legend.title [de] = 'register'` corrected to `Register`
  (German noun capitalisation), as the brief explicitly called out.
- `dataflow.register.system [de] = 'system'` corrected to `System`.
- `events.summary.move_country` placeholders `{from}` `{to}` preserved verbatim.
- `prompt.fixture.result.latency` and `.tokens`: number-format placeholders
  preserved; uk renders `мс` and `токенів`.
- `prompts.row.versions` (fr only needed): EN plural rendering kept identical
  in French because the noun *version* is invariant in the singular and adds
  *s* in the plural — already matches EN.

### help / policies / app / approvals / walkthrough — 5 rows
- `help.encode.title [de]` = `Encoder` (the established term; matches the
  walkthrough tag and the nav target).
- `policies.column.verdict [fr]` = `Verdict` (cognate; the audience is
  decision-makers familiar with the term).
- `app.name` = `GovOps` everywhere (per-key override, brand verbatim).
- `approvals.filter.status.label` is `Status` in both de and pt-BR loans.
- `walkthrough.step2.tag [de]` = `Encoder` (matches help.encode.title).

### branding — 8 rows
- `branding.check.col.title`: per-key override emits the literal i18n key
  `app.name` in every locale (this column header references the key by name,
  not by value).
- `branding.check.caption`: typographic curly quotes `“ ”` preserved around
  GovOps in fr/de/es/pt/uk to match EN style.

### nav / lang / country / diff — 19 rows
- `nav.*`: each label is a single noun in the glossary (Cases, Authority,
  Encode, Admin, Console, Menu, Impact, Prompts).
- `lang.*`: language names always given in their **native form** regardless of
  the surrounding locale (e.g. `lang.fr` is `Français` in every locale).
  This matches the de-facto convention used by the rest of `web/src/messages`.
- `country.iso.*`: standard country names (Australie/Canada/France/Ukraine
  etc., per glossary).
- `diff.metadata.{citation,status}`: glossary single-word translations.

## 3. Self-verification result

Re-loaded the output JSON and ran 7 checks programmatically:

| # | Check | Result |
|---|---|---|
| 1 | top-level key count = 303 | PASS (303) |
| 2 | every worklist key present | PASS |
| 3 | every locale in `needs` present per key | PASS (0 missing) |
| 4 | no `[MT]` prefix anywhere | PASS (0) |
| 5 | placeholder name parity (EN vs translation) | PASS (0 mismatches) |
| 6 | brand-token preservation (case-sensitive substring) | PASS (0 failures) |
| 7 | every translation non-empty | PASS (0 empty) |

## 4. Cells flagged for human re-look

These are translated and shipped — but the local register is one a native
reviewer might want to nudge:

- `home.eyebrow` — left as the literal spec string `spec govops-002 · law-as-code`
  in all locales. This is intentional (developer-only reference), but a
  locale-aware label could read better. Consider whether to localise
  `spec`/`law-as-code` later.
- `screen.benefit.op.*` — operator/trace verb tags are lowercase in
  fr/es/pt/uk and capitalised in de. A reviewer should confirm whether the
  UI prefers nominalisations (e.g. fr “Addition” instead of `ajouter`) once
  the calculation trace component is finalised.
- `events.summary.add_evidence` ⇒ `+ {evidence_type}` and
  `events.summary.move_country` ⇒ `{from} → {to}` are pure placeholders;
  identical in every locale (intentional). If `evidence_type` text is
  English-only at runtime, the visible string will be EN regardless of
  locale — that is an upstream concern, not a translation gap.
- `cases.detail.heading` (`Case {id}`) — fr translates to `Dossier {id}` to
  match `nav.cases`. If the product team prefers `Cas {id}` in French, this
  is the single source of truth to flip.
- Federation column re-emits — `admin.federation.col.actions [fr] = "Actions"`,
  `…col.name [de] = "Name"`, `…col.status [de/pt-BR] = "Status"`,
  `…col.version [fr/de] = "Version"`. These are valid loan/cognate
  translations. Worth confirming that the existing locale JSON did not
  intend a deeper localisation.

## 5. Tally

- 303 keys covered
- 1,351 cells translated (no empties, no `[MT]`)
- 261 fr · 286 de · 268 es-MX · 273 pt-BR · 263 uk
- 20 ICU placeholder rows preserved verbatim by name; 5 plural rows expanded
  one/few/many/other for Ukrainian
- 0 brand-token violations
