# Pension de jubilacion

_This document is a plain-language rendering of the program manifest (`oas.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `oas`
- **Jurisdiction**: `jur-es-national`
- **Shape**: `old_age_pension`
- **Name (es)**: Pension de jubilacion

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constitucion Espanola de 1978  
  Citation: `CE 1978, Art. 41, Art. 50`
  Link: <https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229>
- **act** — Ley General de la Seguridad Social  
  Citation: `Real Decreto Legislativo 8/2015`
  Link: <https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724>
- **program** — Seguridad Social - Instituto Nacional de la Seguridad Social (INSS)  
  Citation: `LGSS, Art. 1`
- **service** — Pension de jubilacion ordinaria  
  Citation: `LGSS, Arts. 205-209`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/oas-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-es-age` (age_threshold)

> Edad minima de jubilacion: 66 anos y 4 meses (regla general 2025)

Citation: `LGSS, Art. 205.1.a`

Parameters (read from substrate at evaluation time):

- `min_age` ← substrate key `es.rule.age.min_age`

### `rule-es-contribution-min` (residency_minimum)

> Periodo minimo de cotizacion: 15 anos

Citation: `LGSS, Art. 205.1.b`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `es.rule.contribution-min.min_years`
- `home_countries` ← substrate key `es.rule.contribution-min.home_countries`

### `rule-es-contribution-calc` (residency_partial)

> Pension completa con 36+ anos de cotizacion; proporcional con 15-35 anos

Citation: `LGSS, Art. 210`

Parameters (read from substrate at evaluation time):

- `full_years` ← substrate key `es.rule.contribution-calc.full_years`
- `min_years` ← substrate key `es.rule.contribution-calc.min_years`

### `rule-es-status` (legal_status)

> Afiliado al Regimen General de la Seguridad Social

Citation: `LGSS, Art. 7`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `es.rule.status.accepted_statuses`

### `rule-es-evidence` (evidence_required)

> Documento de identidad (DNI, NIE, o pasaporte)

Citation: `LGSS, Disposicion adicional`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `es.rule.evidence.required_types`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-es-001`** — Antonio Garcia Lopez (citizen)
- **`demo-es-002`** — Maria Carmen Rodriguez (citizen)
- **`demo-es-003`** — Mohammed El Fassi (permanent_resident)
- **`demo-es-004`** — Pilar Fernandez Ruiz (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
