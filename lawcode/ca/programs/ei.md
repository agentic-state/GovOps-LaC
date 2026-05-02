# Employment Insurance

_This document is a plain-language rendering of the program manifest (`ei.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `ei`
- **Jurisdiction**: `jur-ca-federal`
- **Shape**: `unemployment_insurance`
- **Name (en)**: Employment Insurance
- **Name (fr)**: Assurance-emploi

Federal income replacement for workers who have lost employment through no fault of their own and remain available for and actively seek suitable employment (Employment Insurance Act, S.C. 1996, c. 23).

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Constitution Act, 1867  
  Citation: `30 & 31 Vict., c. 3 (U.K.), s. 91(2A)`
  Link: <https://laws-lois.justice.gc.ca/eng/const/page-1.html>
- **act** — Employment Insurance Act  
  Citation: `S.C. 1996, c. 23`
  Link: <https://laws-lois.justice.gc.ca/eng/acts/E-5.6/>
- **regulation** — Employment Insurance Regulations  
  Citation: `SOR/96-332`
- **program** — Employment Insurance Program (Service Canada)  
  Citation: `Department of Employment and Social Development Act, S.C. 2005, c. 34`
- **service** — EI Initial Eligibility Determination  
  Citation: `EI Act, ss. 6-12, s. 18`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/ei-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-ei-contribution` (residency_minimum)

> Minimum qualifying employment period (insurable hours equivalent)

Citation: `Employment Insurance Act, S.C. 1996, c. 23, s. 7(2)`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `ca-ei.rule.contribution.min_years`
- `home_countries` ← substrate key `ca-ei.rule.contribution.home_countries`

### `rule-ei-legal-status` (legal_status)

> Applicant must be authorized to work in Canada

Citation: `Employment Insurance Act, S.C. 1996, c. 23, s. 6(1)`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `ca-ei.rule.legal-status.accepted_statuses`

### `rule-ei-evidence` (evidence_required)

> Record of Employment from former employer must be provided

Citation: `Employment Insurance Act, S.C. 1996, c. 23, s. 50(1)`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `ca-ei.rule.evidence.required_types`

### `rule-ei-duration` (benefit_duration_bounded)

> Maximum weeks of regular EI benefits payable in a benefit period

Citation: `Employment Insurance Act, S.C. 1996, c. 23, s. 12(2)`

Parameters (read from substrate at evaluation time):

- `weeks_total` ← substrate key `ca-ei.rule.duration.weeks_total`
- `start_offset_days` ← substrate key `ca-ei.rule.duration.start_offset_days`

### `rule-ei-job-search` (active_obligation)

> Recipient must be available for and actively seeking suitable employment

Citation: `Employment Insurance Act, S.C. 1996, c. 23, s. 18(1)(a)`

Parameters (read from substrate at evaluation time):

- `obligation_id` ← substrate key `ca-ei.rule.job-search.obligation_id`
- `cadence` ← substrate key `ca-ei.rule.job-search.cadence`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-ca-ei-001`** — Sarah Tremblay (citizen)
- **`demo-ca-ei-002`** — Daniel Wong (permanent_resident)
- **`demo-ca-ei-003`** — Marie Dubois (citizen)
- **`demo-ca-ei-004`** — Ahmed Khalil (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
