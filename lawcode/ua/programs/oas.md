# Pensiia za vikom (PFU)

_This document is a plain-language rendering of the program manifest (`oas.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `oas`
- **Jurisdiction**: `jur-ua-national`
- **Shape**: `old_age_pension`
- **Name (uk)**: Pensiia za vikom (PFU)

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Konstytutsiia Ukrainy  
  Citation: `Konstytutsiia Ukrainy, st. 46`
  Link: <https://zakon.rada.gov.ua/laws/show/254%D0%BA/96-%D0%B2%D1%80>
- **act** — Zakon Ukrainy 'Pro zahalnooboviazkove derzhavne pensiine strakhuvannia'  
  Citation: `Zakon No. 1058-IV vid 09.07.2003`
  Link: <https://zakon.rada.gov.ua/laws/show/1058-15>
- **program** — Pensiinyi fond Ukrainy (PFU)  
  Citation: `Zakon No. 1058-IV, Rozdil VIII`
- **service** — Pensiia za vikom (starosna pensiia)  
  Citation: `Zakon No. 1058-IV, st. 26`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/oas-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-ua-age` (age_threshold)

> Pensiinyi vik: 60 rokiv

Citation: `Zakon No. 1058-IV, st. 26`

Parameters (read from substrate at evaluation time):

- `min_age` ← substrate key `ua.rule.age.min_age`

### `rule-ua-stazh-min` (residency_minimum)

> Minimalnyi strakhovyi stazh: 25 rokiv (choloviky)

Citation: `Zakon No. 1058-IV, st. 26`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `ua.rule.stazh-min.min_years`
- `home_countries` ← substrate key `ua.rule.stazh-min.home_countries`

### `rule-ua-stazh-calc` (residency_partial)

> Povna pensiia z 35+ rokamy stazhu; proportsionalna z 25-34 rokamy

Citation: `Zakon No. 1058-IV, st. 28`

Parameters (read from substrate at evaluation time):

- `full_years` ← substrate key `ua.rule.stazh-calc.full_years`
- `min_years` ← substrate key `ua.rule.stazh-calc.min_years`

### `rule-ua-status` (legal_status)

> Hromadianyn Ukrainy abo osoba z postiinymy pravom na prozhyvannia

Citation: `Zakon No. 1058-IV, st. 4`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `ua.rule.status.accepted_statuses`

### `rule-ua-evidence` (evidence_required)

> Pasport hromadianyna Ukrainy abo svidotstvo pro narodzhennia

Citation: `Zakon No. 1058-IV, st. 45`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `ua.rule.evidence.required_types`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-ua-001`** — Oleksandr Kovalenko (citizen)
- **`demo-ua-002`** — Nataliia Shevchenko (citizen)
- **`demo-ua-003`** — Vasyl Bondarenko (citizen)
- **`demo-ua-004`** — Halyna Tkachenko (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
