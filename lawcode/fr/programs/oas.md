# Retraite de base (CNAV)

_This document is a plain-language rendering of the program manifest (`oas.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `oas`
- **Jurisdiction**: `jur-fr-national`
- **Shape**: `old_age_pension`
- **Name (fr)**: Retraite de base (CNAV)

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constitution de la Ve Republique  
  Citation: `Constitution du 4 octobre 1958, Preambule de 1946, al. 11`
  Link: <https://www.legifrance.gouv.fr/loda/id/LEGITEXT000006071194>
- **act** — Code de la securite sociale  
  Citation: `CSS, Livre III, Titre V`
  Link: <https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006073189/>
- **act** — Loi de financement rectificative de la securite sociale pour 2023  
  Citation: `Loi n. 2023-270 du 14 avril 2023`
- **program** — Caisse nationale d'assurance vieillesse (CNAV)  
  Citation: `CSS, Art. L. 222-1`
- **service** — Retraite de base - pension de vieillesse  
  Citation: `CSS, Art. L. 351-1 et seq.`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/oas-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-fr-age` (age_threshold)

> Age legal de depart a la retraite : 64 ans (reforme 2023)

Citation: `CSS, Art. L. 351-1; Loi n. 2023-270`

Parameters (read from substrate at evaluation time):

- `min_age` ← substrate key `fr.rule.age.min_age`

### `rule-fr-trimestres-min` (residency_minimum)

> Duree minimale d'assurance : 2 ans (8 trimestres) pour ouvrir le droit

Citation: `CSS, Art. L. 351-1`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `fr.rule.trimestres-min.min_years`
- `home_countries` ← substrate key `fr.rule.trimestres-min.home_countries`

### `rule-fr-trimestres-calc` (residency_partial)

> Taux plein a 43 ans de cotisation (172 trimestres); proratise en dessous

Citation: `CSS, Art. L. 351-1`

Parameters (read from substrate at evaluation time):

- `full_years` ← substrate key `fr.rule.trimestres-calc.full_years`
- `min_years` ← substrate key `fr.rule.trimestres-calc.min_years`

### `rule-fr-status` (legal_status)

> Assure du regime general (citoyen ou resident)

Citation: `CSS, Art. L. 311-2`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `fr.rule.status.accepted_statuses`

### `rule-fr-evidence` (evidence_required)

> Piece d'identite (acte de naissance, carte d'identite, ou passeport)

Citation: `CSS, Art. R. 351-1`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `fr.rule.evidence.required_types`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-fr-001`** — Jean-Claude Dupont (citizen)
- **`demo-fr-002`** — Sophie Martin (citizen)
- **`demo-fr-003`** — Fatima Benali (permanent_resident)
- **`demo-fr-004`** — Pierre Lefevre (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
