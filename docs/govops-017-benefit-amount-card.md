# GovOps Spec — Benefit amount card on /screen + case detail
<!-- type: component+route, priority: p1, depends_on: [govops-015, govops-015a] -->
type: component+route
priority: p1
depends_on: [govops-015, govops-015a]
spec_id: govops-017

## Intent

Phase 10B (ADR-011) gave the backend a calculation rule type. A citizen
self-screening for OAS in Canada now receives — alongside the eligibility
verdict — a `benefit_amount` object with the projected monthly amount, the
currency, the period, a per-step formula trace, and the dedup'd list of
statutory citations behind the calculation.

Today the screen surface and the case-detail surface both render the
verdict + ratio (e.g. `Eligible — 33/40`) but discard the `benefit_amount`.
The citizen-facing story is incomplete: *"you'd be eligible"* without the
*"≈ $600/month, here's why"* misses the point of the screening flow.

This spec adds a single new component, `BenefitAmountCard`, and consumes it
from `/screen/$jurisdictionId` and `/cases/$caseId`. The card is a passive
renderer over the backend's `benefit_amount` shape — it does not compute,
does not estimate, does not modify. If the backend returns `null`, the card
does not render.

## Backend contract (already shipped — read-only here)

`benefit_amount` on the screen response and the case-evaluate
recommendation has this shape:

```ts
type BenefitAmount = {
  value: number;          // already rounded to 2dp by the engine
  currency: string;       // ISO 4217, "CAD" today
  period: "monthly" | "annual" | "lump_sum";
  formula_trace: FormulaTraceStep[];
  citations: string[];    // dedup'd in walk order
};

type FormulaTraceStep = {
  op: "const" | "ref" | "field" |
      "add" | "subtract" | "multiply" | "divide" |
      "min" | "max" | "clamp";
  inputs: (number | string)[];
  output: number;
  citation?: string;
  note?: string;
};
```

The component **does not** call any new backend endpoint. It reads from the
existing screen response and the existing recommendation object.

## Acceptance criteria

### `BenefitAmountCard` component (new)

Path: `src/components/govops/screen/BenefitAmountCard.tsx`

Props:
```ts
type BenefitAmountCardProps = {
  benefitAmount: BenefitAmount;
  jurisdictionLabel: string;  // e.g. "Old Age Security — Canada"
  pensionType?: "full" | "partial" | "";
  partialRatio?: string | null;  // e.g. "33/40"
};
```

#### Visual structure (top-down)

- [ ] **Headline figure**: large prominent number + currency code +
      period suffix. Use the `Intl.NumberFormat` for the active locale to
      format `value` with currency style; fall back to a plain
      `{value} {currency}` if the locale-specific formatter is unavailable.
      Period suffix from i18n key `screen.benefit.period.{period}` (e.g.
      `screen.benefit.period.monthly` → EN: `/month`, FR: `/mois`).
- [ ] **Type chip**: small chip showing `pensionType` value. Use existing
      shadcn `Badge` component. Variant `default` for `full`, `secondary`
      for `partial`, hidden if `pensionType` is empty.
- [ ] **Ratio caption** (only when `partialRatio` is non-null): small
      subdued text under the headline, e.g. `33/40 of the full base
      amount`. Use i18n key `screen.benefit.ratio_caption` with parameter
      `{ratio}` (ICU MessageFormat).
- [ ] **"How is this calculated?" disclosure**: a `Collapsible` (shadcn)
      wrapping the formula trace. Header is the i18n key
      `screen.benefit.disclose_calculation`. Default state: closed.

#### Formula trace rendering (inside the disclosure)

- [ ] The trace renders as a vertically-stacked, monospaced step list. One
      row per `FormulaTraceStep`. Each row shows:
  - Operator label (i18n: `screen.benefit.op.{op}`, e.g.
    `screen.benefit.op.multiply` → EN: `multiply`, FR: `multiplier`)
  - Inputs rendered inline. For numeric inputs, format with
    `Intl.NumberFormat` (no currency style — these are intermediate
    values). For string inputs (refs, field names), render in a small
    monospaced span.
  - `→` arrow, then the `output` formatted as a plain number.
  - If `citation` is non-empty, render it on a second line in subdued text
    with a left border (`border-l-2 border-muted pl-2`). If `note` is
    non-empty, append it after the citation in italic.
- [ ] If the trace is empty (defensive — should not happen in practice),
      render the i18n string `screen.benefit.trace_unavailable` instead of
      an empty disclosure body.

#### Citations summary (inside the disclosure, below the trace)

- [ ] A separator (`<Separator />` from shadcn).
- [ ] A heading from i18n key `screen.benefit.citations_heading` (EN:
      `Statutory authorities`).
- [ ] An unordered list of `citations`, each rendered as a single line. No
      external links — these are citation strings, not URLs.

### Consumption — `/screen/$jurisdictionId`

- [ ] In `src/routes/screen.$jurisdictionId.tsx`, after the existing result
      block (verdict + ratio + missing-evidence list), conditionally render
      `<BenefitAmountCard>` when `result.benefit_amount` is non-null.
- [ ] The card sits **after** the verdict block and **before** the
      "How this works" / disclaimer footer.
- [ ] If the result is `ineligible` / `insufficient_evidence` /
      `escalate`, the card is not rendered. Backend returns `null` for
      those cases; the conditional handles it.

### Consumption — `/cases/$caseId`

- [ ] In `src/routes/cases.$caseId.tsx`, the same `<BenefitAmountCard>` is
      rendered inside the recommendation panel when
      `recommendation.benefit_amount` is non-null.
- [ ] The card sits below the existing rule-evaluation list and above the
      review-actions block. Same conditional logic as the screen route.

### i18n keys (all 6 locales: en, fr, pt-BR, es-MX, de, uk)

Add to `src/messages/{lang}.json`:

| key | EN value | FR value |
| --- | --- | --- |
| `screen.benefit.heading` | `Projected monthly amount` | `Montant mensuel projeté` |
| `screen.benefit.period.monthly` | `/month` | `/mois` |
| `screen.benefit.period.annual` | `/year` | `/an` |
| `screen.benefit.period.lump_sum` | ` (lump sum)` | ` (somme forfaitaire)` |
| `screen.benefit.type.full` | `Full pension` | `Pension complète` |
| `screen.benefit.type.partial` | `Partial pension` | `Pension partielle` |
| `screen.benefit.ratio_caption` | `{ratio} of the full base amount` | `{ratio} du montant de base complet` |
| `screen.benefit.disclose_calculation` | `How is this calculated?` | `Comment est-ce calculé?` |
| `screen.benefit.op.const` | `constant` | `constante` |
| `screen.benefit.op.ref` | `lookup` | `valeur officielle` |
| `screen.benefit.op.field` | `case input` | `donnée du cas` |
| `screen.benefit.op.add` | `add` | `additionner` |
| `screen.benefit.op.subtract` | `subtract` | `soustraire` |
| `screen.benefit.op.multiply` | `multiply` | `multiplier` |
| `screen.benefit.op.divide` | `divide` | `diviser` |
| `screen.benefit.op.min` | `minimum` | `minimum` |
| `screen.benefit.op.max` | `maximum` | `maximum` |
| `screen.benefit.op.clamp` | `clamp` | `borner` |
| `screen.benefit.citations_heading` | `Statutory authorities` | `Sources statutaires` |
| `screen.benefit.trace_unavailable` | `Calculation trace not available.` | `Trace de calcul non disponible.` |

For pt-BR, es-MX, de, uk: machine-translate and flag with the existing
follow-up convention.

### Out of scope (DO NOT do in this PR)

- Don't add a "currency selector" or any user control that changes the
  rendered amount.
- Don't add an "estimate adjustment" UI (e.g. let the user override the
  base). The card is read-only over the backend response.
- Don't add localized currency conversion (CAD → EUR, etc.). The backend
  returns one currency; the card renders it.
- Don't add a "print this" or "download" button — that's Sprint 2's
  notification spec, not this one.
- Don't fetch from any new endpoint; the data is already in the existing
  responses.

### Verification

- [ ] Eligible CA case on `/screen/ca-oas` (citizen, 70 years, 50 years
      residency) renders the headline `$727.67 CAD/month`, full-pension
      chip, no ratio caption, and a working "How is this calculated?"
      disclosure.
- [ ] Partial CA case (PR, 33 years residency) renders the prorated
      amount, partial-pension chip, ratio caption `33/40 of the full base
      amount`, and the same disclosure.
- [ ] Ineligible / insufficient-evidence cases render no card at all
      (the existing verdict block is unchanged).
- [ ] Same coverage on `/cases/{id}` for the demo cases.
- [ ] French locale renders the same scenarios with the FR i18n strings;
      `Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' })`
      produces correct French formatting.
- [ ] `npm run check:i18n` passes (parity across all 6 locales).
- [ ] `npm run lint` clean.
- [ ] Existing Playwright E2E suite passes unchanged; if smoke spec touches
      the screen result page, add an assertion that the
      `BenefitAmountCard` renders for an eligible case.
