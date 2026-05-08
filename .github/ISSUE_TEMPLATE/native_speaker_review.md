---
name: Native-speaker i18n review
about: Offer translation review for one of the 6 supported locales
title: "[i18n] Native review — <locale>"
labels: i18n, good first issue
---

GovOps ships in 6 locales (en, fr, pt-BR, es-MX, de, uk). The current translations passed automated parity + ICU validation, but a few cells are flagged for native-speaker re-look — see [PLAN.md §12.4](https://github.com/agentic-state/GovOps-LaC/blob/main/PLAN.md#124--i18n-translation-round-2026-04-29-reviewer-follow-ups).

**Locale you're reviewing**: (e.g. `fr`, `de`, `pt-BR`, `es-MX`, `uk`)

**Background**
- I'm a native speaker of: 
- Domain familiarity (public-sector / legal / general): 

**Cells to confirm or nudge** (from PLAN §12.4)
- [ ] `home.eyebrow` — should `spec` / `law-as-code` localise or stay verbatim?
- [ ] `screen.benefit.op.*` — verbs vs nominalisations (currently mixed across locales)
- [ ] `events.summary.add_evidence` / `events.summary.move_country` — pure-placeholder design; visible string is currently EN
- [ ] `cases.detail.heading` (fr only) — `Dossier {id}` vs `Cas {id}`
- [ ] `admin.federation.col.*` — loanwords vs local equivalents

**Other cells you'd nudge**
List any other strings you'd word differently. Source files: [`web/src/messages/<locale>.json`](https://github.com/agentic-state/GovOps-LaC/tree/main/web/src/messages).

**How you'd like to contribute the changes**
- [ ] PR (preferred — even rough TSV / JSON delta is fine, the maintainer will reformat)
- [ ] Comment on this issue with the suggested strings
- [ ] Other (describe)
