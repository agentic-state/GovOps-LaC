# Unemployment Insurance (Seguro-Desemprego)

_This document is a plain-language rendering of the program manifest (`ei.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `ei`
- **Jurisdiction**: `jur-br-federal`
- **Shape**: `unemployment_insurance`
- **Name (en)**: Unemployment Insurance (Seguro-Desemprego)
- **Name (pt-BR)**: Seguro-Desemprego

Federal benefit for workers dismissed without cause from formal employment, providing 3-5 monthly parcels under Lei nº 7.998/1990.

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constituição da República Federativa do Brasil de 1988  
  Citation: `CF/1988, Art. 7º, II; Art. 201, III`
  Link: <https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm>
- **act** — Lei do Programa do Seguro-Desemprego  
  Citation: `Lei nº 7.998/1990`
  Link: <https://www.planalto.gov.br/ccivil_03/leis/l7998.htm>
- **program** — Fundo de Amparo ao Trabalhador (FAT)  
  Citation: `Lei nº 7.998/1990, Art. 10`
- **program** — Ministério do Trabalho — Sistema Nacional de Emprego (SINE)  
  Citation: `Lei nº 7.998/1990, Art. 18`
- **service** — Concessão do Seguro-Desemprego  
  Citation: `Lei nº 7.998/1990, Arts. 3º-7º`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/ei-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-ei-contribution` (residency_minimum)

> Mínimo de 12 meses de emprego formal nos 18 meses anteriores à dispensa

Citation: `Lei nº 7.998/1990, Art. 3º`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `br-ei.rule.contribution.min_years`
- `home_countries` ← substrate key `br-ei.rule.contribution.home_countries`

### `rule-ei-legal-status` (legal_status)

> Trabalhador autorizado a exercer atividade laboral no Brasil

Citation: `CF/1988, Art. 5º, XIII; Lei nº 7.998/1990`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `br-ei.rule.legal-status.accepted_statuses`

### `rule-ei-evidence` (evidence_required)

> Termo de rescisão de contrato de trabalho (CTPS) ou comprovante equivalente

Citation: `Lei nº 7.998/1990, Art. 8º`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `br-ei.rule.evidence.required_types`

### `rule-ei-duration` (benefit_duration_bounded)

> Número máximo de parcelas (3 a 5) — duração equivalente em semanas

Citation: `Lei nº 7.998/1990, Art. 4º`

Parameters (read from substrate at evaluation time):

- `weeks_total` ← substrate key `br-ei.rule.duration.weeks_total`
- `start_offset_days` ← substrate key `br-ei.rule.duration.start_offset_days`

### `rule-ei-job-search` (active_obligation)

> Manutenção da inscrição ativa no SINE e participação em programas de recolocação

Citation: `Lei nº 7.998/1990, Art. 7º`

Parameters (read from substrate at evaluation time):

- `obligation_id` ← substrate key `br-ei.rule.job-search.obligation_id`
- `cadence` ← substrate key `br-ei.rule.job-search.cadence`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-br-ei-001`** — João Silva (citizen)
- **`demo-br-ei-002`** — Maria Oliveira (permanent_resident)
- **`demo-br-ei-003`** — Carla Santos (citizen)
- **`demo-br-ei-004`** — Pedro Costa (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
