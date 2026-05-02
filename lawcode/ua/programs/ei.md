# Unemployment Assistance (Допомога по безробіттю)

_This document is a plain-language rendering of the program manifest (`ei.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `ei`
- **Jurisdiction**: `jur-ua-national`
- **Shape**: `unemployment_insurance`
- **Name (en)**: Unemployment Assistance (Допомога по безробіттю)
- **Name (uk)**: Допомога по безробіттю

Insurance-based unemployment benefit administered by the State Employment Service of Ukraine, requiring at least 26 weeks of insurance contributions in the last 12 months (Закон України No. 1533-III, 2000).

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Конституція України  
  Citation: `Конституція України, ст. 46`
  Link: <https://zakon.rada.gov.ua/laws/show/254%D0%BA/96-%D0%B2%D1%80>
- **act** — Закон України «Про загальнообов'язкове державне соціальне страхування на випадок безробіття»  
  Citation: `Закон України № 1533-III від 02.03.2000`
  Link: <https://zakon.rada.gov.ua/laws/show/1533-14>
- **act** — Закон України «Про зайнятість населення»  
  Citation: `Закон України № 5067-VI від 05.07.2012`
  Link: <https://zakon.rada.gov.ua/laws/show/5067-17>
- **program** — Державна служба зайнятості України  
  Citation: `Закон України № 5067-VI, ст. 19`
- **service** — Призначення допомоги по безробіттю  
  Citation: `Закон України № 1533-III, ст. 22`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/ei-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-ei-contribution` (residency_minimum)

> Не менше 26 тижнів страхового стажу за останні 12 місяців

Citation: `Закон України № 1533-III, ст. 22`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `ua-ei.rule.contribution.min_years`
- `home_countries` ← substrate key `ua-ei.rule.contribution.home_countries`

### `rule-ei-legal-status` (legal_status)

> Особа з правом на роботу в Україні

Citation: `Закон України № 5067-VI, ст. 1`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `ua-ei.rule.legal-status.accepted_statuses`

### `rule-ei-evidence` (evidence_required)

> Довідка про звільнення від останнього роботодавця

Citation: `Закон України № 5067-VI, ст. 22`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `ua-ei.rule.evidence.required_types`

### `rule-ei-duration` (benefit_duration_bounded)

> Загальна тривалість виплати допомоги (до 360 днів)

Citation: `Закон України № 1533-III, ст. 23`

Parameters (read from substrate at evaluation time):

- `weeks_total` ← substrate key `ua-ei.rule.duration.weeks_total`
- `start_offset_days` ← substrate key `ua-ei.rule.duration.start_offset_days`

### `rule-ei-job-search` (active_obligation)

> Активне сприяння працевлаштуванню та відвідування служби зайнятості

Citation: `Закон України № 1533-III, ст. 31`

Parameters (read from substrate at evaluation time):

- `obligation_id` ← substrate key `ua-ei.rule.job-search.obligation_id`
- `cadence` ← substrate key `ua-ei.rule.job-search.cadence`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-ua-ei-001`** — Олена Коваленко (citizen)
- **`demo-ua-ei-002`** — Aleksandr Petrov (permanent_resident)
- **`demo-ua-ei-003`** — Іван Шевченко (citizen)
- **`demo-ua-ei-004`** — Марія Бондар (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
