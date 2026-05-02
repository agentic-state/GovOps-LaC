# Unemployment Benefit I (Arbeitslosengeld I)

_This document is a plain-language rendering of the program manifest (`ei.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `ei`
- **Jurisdiction**: `jur-de-federal`
- **Shape**: `unemployment_insurance`
- **Name (en)**: Unemployment Benefit I (Arbeitslosengeld I)
- **Name (de)**: Arbeitslosengeld I

Contribution-based unemployment insurance administered by the Bundesagentur für Arbeit, requiring at least 12 months of insured employment in the last 30 months (Sozialgesetzbuch III).

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Grundgesetz für die Bundesrepublik Deutschland  
  Citation: `GG, Art. 74 Abs. 1 Nr. 12 (Sozialversicherung)`
  Link: <https://www.gesetze-im-internet.de/gg/>
- **act** — Sozialgesetzbuch (SGB) Drittes Buch — Arbeitsförderung  
  Citation: `SGB III`
  Link: <https://www.gesetze-im-internet.de/sgb_3/>
- **program** — Bundesagentur für Arbeit  
  Citation: `SGB III, § 367`
- **service** — Anspruch auf Arbeitslosengeld  
  Citation: `SGB III, §§ 136-164`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/ei-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-ei-contribution` (residency_minimum)

> Mindestens 12 Monate versicherungspflichtige Beschäftigung in der Rahmenfrist von 30 Monaten

Citation: `SGB III, § 142`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `de-ei.rule.contribution.min_years`
- `home_countries` ← substrate key `de-ei.rule.contribution.home_countries`

### `rule-ei-legal-status` (legal_status)

> Arbeitnehmer mit Erlaubnis zur Erwerbstätigkeit in Deutschland

Citation: `SGB III, § 138 Abs. 5`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `de-ei.rule.legal-status.accepted_statuses`

### `rule-ei-evidence` (evidence_required)

> Arbeitsbescheinigung des letzten Arbeitgebers

Citation: `SGB III, § 312`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `de-ei.rule.evidence.required_types`

### `rule-ei-duration` (benefit_duration_bounded)

> Anspruchsdauer abhängig von Versicherungszeit und Lebensalter

Citation: `SGB III, § 147`

Parameters (read from substrate at evaluation time):

- `weeks_total` ← substrate key `de-ei.rule.duration.weeks_total`
- `start_offset_days` ← substrate key `de-ei.rule.duration.start_offset_days`

### `rule-ei-job-search` (active_obligation)

> Verfügbarkeit für Vermittlung und aktive Mitwirkung an der beruflichen Eingliederung

Citation: `SGB III, § 138`

Parameters (read from substrate at evaluation time):

- `obligation_id` ← substrate key `de-ei.rule.job-search.obligation_id`
- `cadence` ← substrate key `de-ei.rule.job-search.cadence`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-de-ei-001`** — Anna Müller (citizen)
- **`demo-de-ei-002`** — Tomáš Novák (permanent_resident)
- **`demo-de-ei-003`** — Stefan Schmidt (citizen)
- **`demo-de-ei-004`** — Lukas Weber (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
