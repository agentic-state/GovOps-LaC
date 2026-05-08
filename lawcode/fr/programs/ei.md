# Return-to-Employment Allowance (Allocation d'aide au retour à l'emploi, ARE)

_This document is a plain-language rendering of the program manifest (`ei.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `ei`
- **Jurisdiction**: `jur-fr-national`
- **Shape**: `unemployment_insurance`
- **Name (en)**: Return-to-Employment Allowance (Allocation d'aide au retour à l'emploi, ARE)
- **Name (fr)**: Allocation d'aide au retour à l'emploi (ARE)

Bounded-duration income replacement for involuntarily-unemployed workers, administered by France Travail (formerly Pôle emploi) under the UNÉDIC convention (Code du travail, Art. L5421-1 et seq.).

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constitution de la Vᵉ République  
  Citation: `Constitution de 1958, Préambule (par renvoi à 1946, alinéa 11)`
  Link: <https://www.conseil-constitutionnel.fr/le-bloc-de-constitutionnalite/texte-integral-de-la-constitution-du-4-octobre-1958-en-vigueur>
- **act** — Code du travail — Titre II (Indemnisation des travailleurs involontairement privés d'emploi)  
  Citation: `Code du travail, Art. L5421-1 et suivants`
  Link: <https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000006195800/>
- **regulation** — Convention d'assurance chômage (UNÉDIC)  
  Citation: `Convention UNÉDIC du 14 avril 2017 (et avenants successifs)`
- **program** — France Travail (anciennement Pôle emploi)  
  Citation: `Code du travail, Art. L5311-1`
- **service** — Ouverture des droits à l'allocation d'aide au retour à l'emploi  
  Citation: `Code du travail, Art. L5422-1 ; Convention UNÉDIC, Art. 3`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/ei-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-ei-contribution` (residency_minimum)

> Affiliation minimale (130 jours travaillés ou 910 heures) au cours des 24 mois précédents

Citation: `Code du travail, Art. L5422-1 ; Convention UNÉDIC, Art. 3`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `fr-ei.rule.contribution.min_years`
- `home_countries` ← substrate key `fr-ei.rule.contribution.home_countries`

### `rule-ei-legal-status` (legal_status)

> Personne autorisée à travailler en France

Citation: `Code du travail, Art. L5421-1`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `fr-ei.rule.legal-status.accepted_statuses`

### `rule-ei-evidence` (evidence_required)

> Attestation employeur destinée à France Travail

Citation: `Code du travail, Art. R1234-9`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `fr-ei.rule.evidence.required_types`

### `rule-ei-duration` (benefit_duration_bounded)

> Durée maximale d'indemnisation (variable selon affiliation et âge)

Citation: `Convention UNÉDIC, Art. 9`

Parameters (read from substrate at evaluation time):

- `weeks_total` ← substrate key `fr-ei.rule.duration.weeks_total`
- `start_offset_days` ← substrate key `fr-ei.rule.duration.start_offset_days`

### `rule-ei-job-search` (active_obligation)

> Recherche active d'emploi auprès de France Travail

Citation: `Code du travail, Art. L5421-3`

Parameters (read from substrate at evaluation time):

- `obligation_id` ← substrate key `fr-ei.rule.job-search.obligation_id`
- `cadence` ← substrate key `fr-ei.rule.job-search.cadence`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-fr-ei-001`** — Camille Bernard (citizen)
- **`demo-fr-ei-002`** — Yann Le Roux (permanent_resident)
- **`demo-fr-ei-003`** — Sophie Martin (citizen)
- **`demo-fr-ei-004`** — Lucas Petit (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
