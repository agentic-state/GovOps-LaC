# GovOps Spec — Self-screening (citizen-facing pre-check)
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002] -->
type: route
priority: p1
depends_on: [govops-001, govops-002]
spec_id: govops-015

## Intent

Phase 10A of the Law-as-Code v2.0 plan: a citizen, anonymously and without
creating a case, answers a short structured form and gets back a plain-language
eligibility hint plus the list of evidence they would need to gather before
applying. Same engine as the officer flow; **no PII is stored**, **no case
row is created**, and **no audit entry is written**. The output is decision
support for the citizen, not a determination — every screen ends with a clear
"this is not a decision; apply through the program to get one" disclaimer.

This is the first non-officer surface in GovOps. It is intentionally lighter
in chrome, friendlier in tone, and structurally distinct from the admin and
officer flows. It exists to prove that the same Law-as-Code substrate that
powers officer decisions can also serve citizens directly with full
transparency about which rules and citations were checked.

## Acceptance criteria

### Entry route — `/screen`

- [ ] Renders a minimal landing page: short headline, one-paragraph description, jurisdiction picker (the existing six: ca / br / es / fr / de / ua), and a prominent "this is not a determination" disclaimer card
- [ ] Disclaimer text is copied verbatim from `screen.disclaimer.body` translation key (see i18n) — must mention: not affiliated with any government, deterministic eligibility hint only, official decisions require formal application
- [ ] Selecting a jurisdiction navigates to `/screen/$jurisdictionId`
- [ ] No global app chrome (no nav bar) — citizen-facing surface uses a stripped shell with only the GovOps wordmark and a "Back" link
- [ ] Footer carries the open-source / Apache-2.0 attribution and a link back to `/`

### Form route — `/screen/$jurisdictionId`

- [ ] URL-validated against the six known jurisdiction codes; unknown code → 404 surface with a link back to `/screen`
- [ ] Renders the program name (e.g. "Old Age Security — Canada") and a one-line program description, both from the live `/api/jurisdiction/{code}` payload (already exposed; reuse existing client)
- [ ] Form fields (one screen, no multi-step wizard for v1):
  - Date of birth (date picker; required; cannot be in future; min plausible 1900-01-01)
  - Legal status (radio: citizen / permanent resident / other; required)
  - Country of birth (free-text, optional)
  - Residency periods (repeating row group, "Add period" button; each row: country dropdown, start date, end date or "ongoing" checkbox)
  - Evidence checkboxes: "I have a birth certificate or passport", "I have records of my residency"
- [ ] Submit button label "Check eligibility"; disabled until all required fields are valid
- [ ] On submit: `POST /api/screen` with the structured payload (see contract below); on success, render the result inline below the form (do not navigate away — keeps the citizen's facts visible for adjustment)
- [ ] Result card shows:
  - Outcome banner with friendly one-line copy keyed off `outcome` (eligible / ineligible / insufficient_evidence)
  - Per-rule breakdown: rule description, outcome chip, citation (mono, hover-underlined). Each rule that resolved against a `ConfigValue` shows its `effective_from` date small and grey
  - Missing-evidence list (if any), with friendly copy "Before applying you'll want to gather…"
  - "How to apply" panel — placeholder copy linking to a hypothetical program URL (driven by jurisdiction config; for now hardcoded per-jurisdiction)
  - Repeat-the-disclaimer block at the bottom: "This is decision support, not a decision."
- [ ] Edit-and-resubmit: changing any form field invalidates the result card (greyed with a "rerun" overlay) until resubmitted; result is never silently stale
- [ ] No `localStorage` / `sessionStorage` writes containing PII; all state is in-memory React state. The only browser storage allowed is the existing locale cookie
- [ ] No analytics events that include any form-field values
- [ ] The page works fully offline once loaded if the API is unreachable: the existing mock-fallback pattern in `src/lib/api.ts` returns a deterministic mock screen result so previews still demonstrate the UX (the mock result is clearly labelled as such with a "preview mode" badge)

### Cross-cutting

- [ ] No header nav, no admin links, no officer links visible on either `/screen` or `/screen/$jurisdictionId`. This is a deliberate boundary — citizen-facing surfaces stay uncluttered
- [ ] Provenance ribbon: every result rule row gets a hybrid ribbon (engine is deterministic, but the underlying ConfigValues may be agent- or human-authored)
- [ ] All form labels announce purpose to assistive tech via `<label for>`; no placeholder-as-label
- [ ] Result card has `role="status"` + `aria-live="polite"` so screen readers hear the outcome change after submit / edit / rerun
- [ ] Print-friendly: a `@media print` block strips form chrome and renders the result card cleanly with the citation list intact

## Files to create / modify

```
src/routes/screen.tsx                          (new — landing + jurisdiction picker)
src/routes/screen.$jurisdictionId.tsx          (new — form + result)
src/components/govops/ScreenShell.tsx          (new — minimal chrome wrapper)
src/components/govops/ScreenForm.tsx           (new — form fields + validation)
src/components/govops/ScreenResult.tsx         (new — outcome card)
src/components/govops/ResidencyPeriodRows.tsx  (new — repeating rows)
src/lib/api.ts                                 (modify — add submitScreen())
src/lib/mock-screen.ts                         (new — mock fallback fixture)
src/lib/types.ts                               (modify — add ScreenRequest, ScreenResponse)
src/messages/en.json                           (modify — add screen.* keys)
src/messages/fr.json                           (modify)
src/messages/pt-BR.json                        (modify)
src/messages/es-MX.json                        (modify)
src/messages/de.json                           (modify)
src/messages/uk.json                           (modify)
```

Do not touch `routeTree.gen.ts`. Do not add an Arabic locale.

## Tokens / data

Backend contract (Phase 10A endpoint, lands alongside this spec):

```ts
// src/lib/types.ts addition
export interface ScreenResidencyPeriod {
  country: string;            // ISO-2 or display name
  start_date: string;         // ISO date
  end_date: string | null;    // ISO date or null = ongoing
}

export interface ScreenRequest {
  jurisdiction_id: string;    // "ca" | "br" | "es" | "fr" | "de" | "ua"
  date_of_birth: string;      // ISO date
  legal_status: "citizen" | "permanent_resident" | "other";
  country_of_birth?: string;
  residency_periods: ScreenResidencyPeriod[];
  evidence_present: {
    dob: boolean;
    residency: boolean;
  };
  evaluation_date?: string;   // ISO date; defaults to server's today()
}

export interface ScreenRuleResult {
  rule_id: string;
  description: string;
  citation: string;
  outcome: "satisfied" | "not_satisfied" | "insufficient_evidence" | "not_applicable";
  detail: string;
  effective_from?: string;    // ISO date if the rule resolved a ConfigValue
}

export interface ScreenResponse {
  outcome: "eligible" | "ineligible" | "insufficient_evidence" | "escalate";
  pension_type: "full" | "partial" | "";
  partial_ratio?: string;     // e.g. "33/40"
  rule_results: ScreenRuleResult[];
  missing_evidence: string[];
  jurisdiction_label: string;
  evaluation_date: string;
  // Critical: no case_id, no applicant_id, no audit_id, no echoed PII.
}
```

```ts
// src/lib/api.ts addition
export async function submitScreen(req: ScreenRequest): Promise<ScreenResponse> {
  try {
    return await fetcher<ScreenResponse>("/api/screen", {
      method: "POST",
      body: JSON.stringify(req),
    });
  } catch {
    const { mockScreen } = await import("./mock-screen");
    return mockScreen(req);
  }
}
```

Reuse existing tokens only: `--surface`, `--surface-sunken`, `--border`,
`--foreground`, `--foreground-muted`, `--agentic`, `--authority`,
`--font-serif` (citizen-facing surfaces lean on serif headings, matching
the marketing pages), `--font-mono` (citations only), `--ring-focus`.

A new layout context but no new tokens.

## Reference implementation

```tsx
// src/components/govops/ScreenShell.tsx
import { Link } from "@tanstack/react-router";
import { Wordmark } from "./Wordmark";
import { useIntl } from "react-intl";

export function ScreenShell({ children, showBack }: { children: React.ReactNode; showBack?: boolean }) {
  const intl = useIntl();
  return (
    <div className="min-h-screen flex flex-col bg-surface text-foreground">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <Link to="/"><Wordmark className="text-xl" /></Link>
        {showBack && (
          <Link to="/screen" className="text-sm text-foreground-muted hover:text-foreground">
            {intl.formatMessage({ id: "screen.back" })}
          </Link>
        )}
      </header>
      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">{children}</main>
      <footer className="px-6 py-4 border-t border-border text-center text-sm text-foreground-muted">
        {intl.formatMessage({ id: "screen.footer.disclaimer" })}
      </footer>
    </div>
  );
}
```

```tsx
// src/components/govops/ScreenResult.tsx — sketch
import { useIntl } from "react-intl";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import type { ScreenResponse } from "@/lib/types";

export function ScreenResult({ data, stale }: { data: ScreenResponse; stale: boolean }) {
  const intl = useIntl();
  return (
    <section
      role="status"
      aria-live="polite"
      className={`mt-8 rounded-lg border border-border bg-surface ${stale ? "opacity-50" : ""}`}
    >
      <header className="px-5 py-4 border-b border-border">
        <h2 className="font-serif text-xl">
          {intl.formatMessage({ id: `screen.outcome.${data.outcome}` })}
        </h2>
        {data.partial_ratio && (
          <p className="text-foreground-muted text-sm">
            {intl.formatMessage({ id: "screen.partial" }, { ratio: data.partial_ratio })}
          </p>
        )}
      </header>
      <ol role="list" className="divide-y divide-border">
        {data.rule_results.map((r) => (
          <li key={r.rule_id} className="flex gap-0">
            <ProvenanceRibbon variant="hybrid" />
            <div className="flex-1 px-5 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm">{r.description}</p>
                <span className={`text-xs uppercase tracking-wide rule-chip-${r.outcome}`}>
                  {intl.formatMessage({ id: `screen.rule.${r.outcome}` })}
                </span>
              </div>
              <p className="font-mono text-xs text-foreground-muted mt-1">{r.citation}</p>
            </div>
          </li>
        ))}
      </ol>
      {data.missing_evidence.length > 0 && (
        <section className="px-5 py-4 border-t border-border">
          <h3 className="text-sm font-medium mb-2">
            {intl.formatMessage({ id: "screen.missing.heading" })}
          </h3>
          <ul role="list" className="list-disc list-inside text-sm text-foreground-muted">
            {data.missing_evidence.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </section>
      )}
      <footer className="px-5 py-4 border-t border-border bg-surface-sunken text-sm text-foreground-muted">
        {intl.formatMessage({ id: "screen.disclaimer.footer" })}
      </footer>
    </section>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: not_applicable
copy_keys:
  - screen.heading                       # "Self-screen for benefits"
  - screen.lede                          # one-paragraph description
  - screen.disclaimer.title              # "This is not a determination"
  - screen.disclaimer.body               # full multi-line disclaimer (ICU; uses \n for paragraph breaks)
  - screen.disclaimer.footer             # short reminder shown under every result
  - screen.back                          # "Back to jurisdictions"
  - screen.footer.disclaimer             # footer attribution + Apache 2.0 line
  - screen.jurisdiction.heading          # "Choose your country"
  - screen.jurisdiction.cta              # "Continue"
  - screen.form.dob.label
  - screen.form.dob.help
  - screen.form.legal_status.label
  - screen.form.legal_status.citizen
  - screen.form.legal_status.permanent_resident
  - screen.form.legal_status.other
  - screen.form.country_of_birth.label
  - screen.form.country_of_birth.help    # "Optional. Helps the system explain its reasoning."
  - screen.form.residency.heading
  - screen.form.residency.add            # "Add another period"
  - screen.form.residency.country
  - screen.form.residency.start
  - screen.form.residency.end
  - screen.form.residency.ongoing
  - screen.form.evidence.heading
  - screen.form.evidence.dob
  - screen.form.evidence.residency
  - screen.form.submit                   # "Check eligibility"
  - screen.form.submit.loading           # "Checking…"
  - screen.outcome.eligible              # "You appear to qualify"
  - screen.outcome.ineligible            # "You do not appear to qualify yet"
  - screen.outcome.insufficient_evidence # "More information would help"
  - screen.outcome.escalate              # "This case needs human review"
  - screen.partial                       # ICU: "Partial benefit estimate: {ratio}"
  - screen.rule.satisfied                # "Met"
  - screen.rule.not_satisfied            # "Not met"
  - screen.rule.insufficient_evidence    # "Needs evidence"
  - screen.rule.not_applicable           # "N/A"
  - screen.missing.heading               # "Before applying you'll want to gather:"
  - screen.howto.heading                 # "How to apply"
  - screen.howto.body                    # ICU: "Apply through {program} to get an official decision."
  - screen.preview_mode                  # "Preview mode — running on mock data"
```

Numerals stay locale-default. Citations are mono-font and not translated.
Date inputs use the browser's locale date format via `<input type="date">`
plus `react-intl` for any date displays.

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - "Tab through form in source order"
  - "Enter on Submit triggers the screen request"
  - "Esc on the result card returns focus to the first form field"
  - "Add-period button is keyboard reachable; Backspace from an empty country field deletes the row"
aria_live: polite                       # for outcome announcement
reduced_motion: respect                 # any transitions on stale-overlay respect prefers-reduced-motion
landmarks:
  - "<main> wraps the form + result"
  - "<section role='status' aria-live='polite'> wraps the result card"
form_labels:
  - "Every input has an explicit <label for>; no placeholder-as-label"
  - "Required fields marked with aria-required='true' and a visible asterisk"
error_handling:
  - "Validation errors render inline next to the field with role='alert'"
  - "Submit button stays disabled until validation passes — never silently fails"
print:
  - "@media print strips form chrome; result card prints cleanly with citations"
```

provenance: hybrid

## Out of scope

- Persisting the form across page reloads (deliberately discarded for privacy)
- Saving / sharing the result as a PDF or signed artefact (defer; handled by Phase 10C)
- Multi-step wizard UX (single-page form for v1; revisit if cognitive load becomes an issue)
- Translation of program-specific copy beyond the labels listed above (program names stay in their authoritative language)
- Account creation, sign-in, "save my screening" flows (citizen surface stays anonymous)
- Calculating actual benefit dollar amounts (Phase 10B)
- Scheduling a follow-up reassessment based on a future event (Phase 10D)
- Notification artefact generation (Phase 10C)
- A/B testing or experimentation hooks
- Analytics events keyed to citizen identity or facts
