# Regelaltersrente (DRV)

_This document is a plain-language rendering of the program manifest (`oas.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `oas`
- **Jurisdiction**: `jur-de-federal`
- **Shape**: `old_age_pension`
- **Name (de)**: Regelaltersrente (DRV)

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Grundgesetz für die Bundesrepublik Deutschland  
  Citation: `GG, Art. 20 Abs. 1 (Sozialstaatsprinzip)`
  Link: <https://www.gesetze-im-internet.de/gg/>
- **act** — Sozialgesetzbuch Sechstes Buch - Gesetzliche Rentenversicherung  
  Citation: `SGB VI`
  Link: <https://www.gesetze-im-internet.de/sgb_6/>
- **program** — Deutsche Rentenversicherung (DRV)  
  Citation: `SGB VI, §§ 125 ff. (Träger der Rentenversicherung)`
- **service** — Regelaltersrente  
  Citation: `SGB VI, Para. 35, Para. 235`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/oas-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-de-age` (age_threshold)

> Regelaltersgrenze: 67 Jahre (Jahrgang 1964 und später)

Citation: `SGB VI, § 35, § 235`

Parameters (read from substrate at evaluation time):

- `min_age` ← substrate key `de.rule.age.min_age`

### `rule-de-wartezeit` (residency_minimum)

> Allgemeine Wartezeit: mindestens 5 Jahre Beitragszeit

Citation: `SGB VI, § 35, § 50`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `de.rule.wartezeit.min_years`
- `home_countries` ← substrate key `de.rule.wartezeit.home_countries`

### `rule-de-beitragszeit` (residency_partial)

> Anteilige Rente nach Rentenformel (vereinfacht: bis 45 Beitragsjahre)

Citation: `SGB VI, § 64 (Rentenformel); vgl. § 236b (besonders langjährig Versicherte)`

Parameters (read from substrate at evaluation time):

- `full_years` ← substrate key `de.rule.beitragszeit.full_years`
- `min_years` ← substrate key `de.rule.beitragszeit.min_years`

### `rule-de-status` (legal_status)

> Versicherter der gesetzlichen Rentenversicherung (Proxy: legal_status)

Citation: `SGB VI, § 1 (Versicherungspflichtige Personen)`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `de.rule.status.accepted_statuses`

### `rule-de-evidence` (evidence_required)

> Personalausweis oder Reisepass, Geburtsurkunde (Mitwirkungspflicht)

Citation: `SGB I, §§ 60–65 (Mitwirkungspflichten); SGB VI, § 99 (Beginn der Rente)`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `de.rule.evidence.required_types`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-de-001`** — Hans Mueller (citizen)
- **`demo-de-002`** — Petra Schmidt (citizen)
- **`demo-de-003`** — Mehmet Yilmaz (permanent_resident)
- **`demo-de-004`** — Ingrid Weber (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
