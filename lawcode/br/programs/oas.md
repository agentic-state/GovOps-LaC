# Aposentadoria por Idade (INSS)

_This document is a plain-language rendering of the program manifest (`oas.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `oas`
- **Jurisdiction**: `jur-br-federal`
- **Shape**: `old_age_pension`
- **Name (pt)**: Aposentadoria por Idade (INSS)

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constituicao da Republica Federativa do Brasil de 1988  
  Citation: `CF/1988, Art. 201`
  Link: <https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm>
- **act** — Lei de Beneficios da Previdencia Social  
  Citation: `Lei n. 8.213/1991`
  Link: <https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm>
- **act** — Emenda Constitucional n. 103/2019 (Reforma da Previdencia)  
  Citation: `EC n. 103/2019`
- **program** — Instituto Nacional do Seguro Social (INSS)  
  Citation: `Lei n. 8.029/1990, Art. 17`
- **service** — Aposentadoria por Idade  
  Citation: `Lei n. 8.213/1991, Art. 48; EC 103/2019, Art. 19`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/oas-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-br-age` (age_threshold)

> Idade minima: 65 anos (homens) ou 62 anos (mulheres)

Citation: `Lei n. 8.213/1991, Art. 48; EC 103/2019`

Parameters (read from substrate at evaluation time):

- `min_age` ← substrate key `br.rule.age.min_age`

### `rule-br-contribution` (residency_minimum)

> Minimo de 15 anos (180 meses) de contribuicao ao INSS

Citation: `Lei n. 8.213/1991, Art. 25, II`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `br.rule.contribution.min_years`
- `home_countries` ← substrate key `br.rule.contribution.home_countries`

### `rule-br-contribution-calc` (residency_partial)

> Beneficio integral com 40 anos de contribuicao; proporcional com 15-39 anos

Citation: `EC 103/2019, Art. 26`

Parameters (read from substrate at evaluation time):

- `full_years` ← substrate key `br.rule.contribution-calc.full_years`
- `min_years` ← substrate key `br.rule.contribution-calc.min_years`

### `rule-br-status` (legal_status)

> Segurado deve estar inscrito no INSS (cidadao ou residente permanente)

Citation: `Lei n. 8.213/1991, Art. 11`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `br.rule.status.accepted_statuses`

### `rule-br-evidence` (evidence_required)

> Comprovante de idade (certidao de nascimento ou documento de identidade)

Citation: `Lei n. 8.213/1991, Art. 62`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `br.rule.evidence.required_types`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-br-001`** — Carlos Alberto Silva (citizen)
- **`demo-br-002`** — Ana Lucia Ferreira (citizen)
- **`demo-br-003`** — Joao Pedro Oliveira (permanent_resident)
- **`demo-br-004`** — Maria das Gracas Costa (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
