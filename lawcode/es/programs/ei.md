# Unemployment Benefit (Prestación por Desempleo)

_This document is a plain-language rendering of the program manifest (`ei.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `ei`
- **Jurisdiction**: `jur-es-national`
- **Shape**: `unemployment_insurance`
- **Name (en)**: Unemployment Benefit (Prestación por Desempleo)
- **Name (es-MX)**: Prestación por Desempleo

Contributory unemployment benefit administered by SEPE for workers with at least 360 days of contributions in the last 6 years (TRLGSS, Art. 266 et seq.).

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constitución Española  
  Citation: `CE 1978, Art. 41`
  Link: <https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229>
- **act** — Texto Refundido de la Ley General de la Seguridad Social  
  Citation: `Real Decreto Legislativo 8/2015`
  Link: <https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724>
- **program** — Servicio Público de Empleo Estatal (SEPE)  
  Citation: `TRLGSS, Art. 295`
- **service** — Reconocimiento de la prestación contributiva por desempleo  
  Citation: `TRLGSS, Arts. 266-272`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/ei-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-ei-contribution` (residency_minimum)

> Mínimo 360 días cotizados en los últimos 6 años

Citation: `Real Decreto Legislativo 8/2015, Art. 266`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `es-ei.rule.contribution.min_years`
- `home_countries` ← substrate key `es-ei.rule.contribution.home_countries`

### `rule-ei-legal-status` (legal_status)

> Persona afiliada a la Seguridad Social y autorizada para trabajar

Citation: `Real Decreto Legislativo 8/2015, Art. 266(a)`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `es-ei.rule.legal-status.accepted_statuses`

### `rule-ei-evidence` (evidence_required)

> Certificado de empresa acreditando la situación legal de desempleo

Citation: `Real Decreto Legislativo 8/2015, Art. 268`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `es-ei.rule.evidence.required_types`

### `rule-ei-duration` (benefit_duration_bounded)

> Duración máxima de la prestación según escala de cotización

Citation: `Real Decreto Legislativo 8/2015, Art. 269`

Parameters (read from substrate at evaluation time):

- `weeks_total` ← substrate key `es-ei.rule.duration.weeks_total`
- `start_offset_days` ← substrate key `es-ei.rule.duration.start_offset_days`

### `rule-ei-job-search` (active_obligation)

> Compromiso de actividad — búsqueda activa de empleo y aceptación de colocación adecuada

Citation: `Real Decreto Legislativo 8/2015, Art. 300`

Parameters (read from substrate at evaluation time):

- `obligation_id` ← substrate key `es-ei.rule.job-search.obligation_id`
- `cadence` ← substrate key `es-ei.rule.job-search.cadence`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-es-ei-001`** — Lucía García (citizen)
- **`demo-es-ei-002`** — Diego Martínez (permanent_resident)
- **`demo-es-ei-003`** — Carmen López (citizen)
- **`demo-es-ei-004`** — Antonio Ruiz (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
