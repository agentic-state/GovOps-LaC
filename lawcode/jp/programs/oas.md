# Kosei Nenkin Hoken (Employees' Pension Insurance)

_This document is a plain-language rendering of the program manifest (`oas.yaml`) for non-coder review. The YAML next to it is the authoritative source the engine reads; this Markdown is generated from the same content and may be regenerated whenever the YAML changes._

## At a glance

- **Program id**: `oas`
- **Jurisdiction**: `jur-jp-national`
- **Shape**: `old_age_pension`
- **Name (en)**: Kosei Nenkin Hoken (Employees' Pension Insurance)

## Authority chain

Where this program's authority comes from, top to bottom — constitution at the top, the specific service at the bottom.

- **constitution** — Nihon-koku Kenpo (Constitution of Japan)  
  Citation: `Kenpo, Art. 25 (right to maintain minimum standards of living)`
  Link: <https://elaws.e-gov.go.jp/document?lawid=321CONSTITUTION>
- **act** — Kokumin Nenkin Ho (National Pension Act)  
  Citation: `Showa 34-nen Horitsu Dai 141-go (1959 Act No. 141)`
  Link: <https://elaws.e-gov.go.jp/document?lawid=334AC0000000141>
- **act** — Kosei Nenkin Hoken Ho (Employees' Pension Insurance Act)  
  Citation: `Showa 29-nen Horitsu Dai 115-go (1954 Act No. 115)`
  Link: <https://elaws.e-gov.go.jp/document?lawid=329AC0000000115>
- **act** — Heisei 29-nen Horitsu Dai 84-go (Act No. 84, 2017) — qualifying-period reduction  
  Citation: `Heisei 29-nen Horitsu Dai 84-go`
- **program** — Nihon Nenkin Kiko (Japan Pension Service)  
  Citation: `Nihon Nenkin Kiko Ho (2007 Act No. 109)`
- **service** — Rourei Kiso Nenkin / Rourei Kosei Nenkin (Old-age Basic + Employees' Pension)  
  Citation: `Kokumin Nenkin Ho, Art. 26; Kosei Nenkin Hoken Ho, Art. 42`

## Rules the engine evaluates

Each rule is a condition the engine checks against a case. Parameter values come from the substrate (`lawcode/.../config/oas-rules.yaml`) and can be amended through the dual-approval workflow without touching this manifest.

### `rule-jp-age` (age_threshold)

> Standard pensionable age: 65

Citation: `Kokumin Nenkin Ho, Art. 26; Kosei Nenkin Hoken Ho, Art. 42`

Parameters (read from substrate at evaluation time):

- `min_age` ← substrate key `jp.rule.age.min_age`

### `rule-jp-contribution` (residency_minimum)

> Minimum qualifying period: 10 years (reduced from 25 by Act No. 84, 2017)

Citation: `Kokumin Nenkin Ho, Art. 26; Heisei 29-nen Horitsu Dai 84-go`

Parameters (read from substrate at evaluation time):

- `min_years` ← substrate key `jp.rule.contribution.min_years`
- `home_countries` ← substrate key `jp.rule.contribution.home_countries`

### `rule-jp-contribution-calc` (residency_partial)

> Full pension at 40 years (480 months); proportional between 10 and 40 years

Citation: `Kokumin Nenkin Ho, Art. 27`

Parameters (read from substrate at evaluation time):

- `full_years` ← substrate key `jp.rule.contribution-calc.full_years`
- `min_years` ← substrate key `jp.rule.contribution-calc.min_years`

### `rule-jp-status` (legal_status)

> Hihokensha of the Japanese pension system (proxy: legal_status)

Citation: `Kokumin Nenkin Ho, Art. 7; Kosei Nenkin Hoken Ho, Art. 9`

Parameters (read from substrate at evaluation time):

- `accepted_statuses` ← substrate key `jp.rule.status.accepted_statuses`

### `rule-jp-evidence` (evidence_required)

> Birth certificate (koseki tohon)

Citation: `Kokumin Nenkin Ho Sekorei kisoku, Art. 16; Kosei Nenkin Hoken Ho Sekorei kisoku, Art. 30`

Parameters (read from substrate at evaluation time):

- `required_types` ← substrate key `jp.rule.evidence.required_types`

## Demo cases

Synthetic applicants used by the test suite and the demo UI — no real personal data.

- **`demo-jp-001`** — Tanaka Hiroshi (citizen)
- **`demo-jp-002`** — Sato Yuki (citizen)
- **`demo-jp-003`** — Kim Min-jun (permanent_resident)
- **`demo-jp-004`** — Watanabe Aiko (citizen)

---

Regenerate this file with `govops docs <manifest-path>` whenever the manifest changes.
