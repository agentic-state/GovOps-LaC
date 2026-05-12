# Old Age Security

_This document is a plain-language rendering of the program manifest (`oas.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `oas`
- **Jurisdiction**: `jur-ca-federal`
- **Shape**: `old_age_pension`
- **Name (en)**: Old Age Security
- **Name (fr)**: Sécurité de la vieillesse

Federal monthly pension for residents of Canada aged 65 and over (Old Age Security Act, R.S.C. 1985, c. O-9).

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constitution Act, 1867  
  Citation: `30 & 31 Vict., c. 3 (U.K.), s. 91(2A)`
  Link: <https://laws-lois.justice.gc.ca/eng/const/page-1.html>
- **act** — Old Age Security Act  
  Citation: `R.S.C., 1985, c. O-9`
  Link: <https://laws-lois.justice.gc.ca/eng/acts/o-9/>
- **regulation** — Old Age Security Regulations  
  Citation: `C.R.C., c. 1246`
  Link: <https://laws-lois.justice.gc.ca/eng/regulations/c.r.c.,_c._1246/>
- **program** — Federal Department Responsible for OAS Delivery  
  Citation: `Department of Employment and Social Development Act, S.C. 2005, c. 34`
- **program** — Old Age Security Program  
  Citation: `OAS Act, Part I`
- **service** — OAS Initial Eligibility Determination  
  Citation: `OAS Act, ss. 3-3.1`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/oas-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-age-65` (age_threshold)

> Applicant must be 65 years of age or older

Citation: `Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(1)`

Parameters (read from substrate at evaluation time):

- `min_age` ← substrate key `ca.rule.age-65.min_age`

### `rule-residency-10` (residency_minimum)

> Minimum 10 years of Canadian residency after age 18

Citation: `Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(1)`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `ca.rule.residency-10.min_years`
- `home_countries` ← substrate key `ca.rule.residency-10.home_countries`

### `rule-residency-pension-type` (residency_partial)

> Full pension at 40+ years; partial pension at 10-39 years (1/40 per year)

Citation: `Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(2)`

Parameters (read from substrate at evaluation time):

- `full_years` ← substrate key `ca.rule.residency-pension-type.full_years`
- `min_years` ← substrate key `ca.rule.residency-pension-type.min_years`

### `rule-legal-status` (legal_status)

> Applicant must be a Canadian citizen or permanent resident

Citation: `Old Age Security Act, R.S.C. 1985, c. O-9, s. 3(1)`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `ca.rule.legal-status.accepted_statuses`

### `rule-evidence-age` (evidence_required)

> Evidence of age must be provided (birth certificate or equivalent)

Citation: `Old Age Security Regulations, C.R.C. c. 1246, s. 21(1)`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `ca.rule.evidence-age.required_types`

### `rule-calc-oas-amount` (calculation)

> Monthly OAS pension amount: base × (eligible years ÷ 40)

Citation: `Old Age Security Act, R.S.C. 1985, c. O-9, ss. 7-8`

Parameters (read from substrate at evaluation time):

- `currency` ← substrate key `ca.calc.oas.currency`
- `period` ← substrate key `ca.calc.oas.period`
- `formula` ← include `formulas/oas-amount.yaml`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-case-001`** — Margaret Chen (citizen)
- **`demo-case-002`** — David Park (citizen)
- **`demo-case-003`** — Amara Osei (permanent_resident)
- **`demo-case-004`** — Jean-Pierre Tremblay (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
