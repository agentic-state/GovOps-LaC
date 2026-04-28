# GovOps Spec — "Download decision" CTA on /screen + case detail
<!-- type: component+route, priority: p1, depends_on: [govops-015, govops-015a, govops-017] -->
type: component+route
priority: p1
depends_on: [govops-015, govops-015a, govops-017]
spec_id: govops-018

## Intent

Phase 10C (ADR-012) gave the backend an HTML-rendering path for
citizen-facing decision notices. A citizen self-screening or an officer
reviewing a case can now leave the surface with a **portable, audit-bearing
artefact** they can save, print, share, or hand to a caseworker. Today the
endpoints exist but the UI does not call them — there is no "Download
decision" CTA anywhere.

This spec adds:

1. A small `<DownloadDecisionButton>` component reused in two places.
2. A "Download decision" CTA on the `/screen/$jurisdictionId` result block
   when the result is `eligible` (and optionally for `ineligible` too —
   citizens deserve a portable record of the decision either way).
3. A "Download decision" CTA on the recommendation panel of
   `/cases/$caseId`.

The component is a **passive consumer** of the existing backend: no new
endpoints, no client-side rendering of the notice. It calls the API, gets
HTML back, and either opens the HTML in a new tab (default) or triggers a
"Save Page As" dialog.

## Backend contract (already shipped, read-only here)

Two endpoints, both returning `text/html` with the same response headers:

| Endpoint | Use | Privacy |
| --- | --- | --- |
| `GET /api/cases/{case_id}/notice?lang={code}` | Officer flow / cases with persistence | Appends a `notice_generated` audit event |
| `POST /api/screen/notice` (body = same as POST /api/screen, query: `?lang=`) | Citizen `/screen` flow | No persistence, no audit, no PII echoed |

Response headers on both:
- `X-Notice-Sha256`: 64-char hex digest of the body, identical across
  identical inputs.
- `X-Notice-Template-Version`: ConfigValue id of the resolved template
  record. Same template shipped today across `/screen` and `/cases`.
- `X-Notice-Language`: Echo of the requested language.

## Acceptance criteria

### `<DownloadDecisionButton>` component (new)

Path: `src/components/govops/notices/DownloadDecisionButton.tsx`

Props:
```ts
type DownloadDecisionButtonProps =
  | {
      mode: "case";
      caseId: string;
      language?: string;          // default: "en"
      label?: string;             // override; defaults to i18n key
      variant?: "default" | "outline" | "secondary";
    }
  | {
      mode: "screen";
      screenRequest: ScreenRequest;  // the same body the screen page POST'd
      language?: string;
      label?: string;
      variant?: "default" | "outline" | "secondary";
    };
```

#### Behaviour

- [ ] On click:
  - **mode=case**: `fetch(\`/api/cases/${caseId}/notice?lang=${language}\`)`.
  - **mode=screen**: `fetch('/api/screen/notice?lang=' + language, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(screenRequest) })`.
- [ ] On `200`: read the response as text, open the HTML in a **new tab**
      via `window.open()` with the HTML written into the tab via
      `document.write()`. (Do NOT use `Blob` URLs — they survive past the
      browser session and complicate audit. The transient `data:` URL or
      direct write keeps the artefact ephemeral by default; the user
      explicitly chooses to save by browser action.)
- [ ] On `4xx` / `5xx`: surface a non-blocking toast with the error
      detail; button stays clickable so the user can retry.
- [ ] While the request is in flight: button is disabled, label switches
      to a "rendering..." string (i18n: `screen.download.in_progress`),
      no spinner overhead beyond a subtle pulse on the button.
- [ ] If the response includes an `X-Notice-Sha256` header, log it via
      `console.debug` for development purposes only — do **not** display
      it to the citizen. (The hash is for audit-side verification, not a
      citizen-visible affordance.)

#### Visual

- [ ] Use the existing shadcn `Button` primitive. Default variant:
      `outline`. The CTA should not compete visually with the primary
      action on the page (which on `/screen` is "Try another scenario").
- [ ] Lucide `Download` icon to the left of the label.
- [ ] Right-aligned within its container by default; container can
      override with prop or wrapping classes.

### Consumption — `/screen/$jurisdictionId`

- [ ] In `src/routes/screen.$jurisdictionId.tsx`, after the existing
      result block (verdict / ratio / `BenefitAmountCard` from govops-017
      / missing evidence), render `<DownloadDecisionButton mode="screen"
      screenRequest={...} language={activeLocale} />`.
- [ ] The `screenRequest` prop is the same object the page already sent
      to `/api/screen` to produce the result. No new state — the page
      already has it; pass it through.
- [ ] Render the button regardless of outcome (`eligible` /
      `ineligible` / `insufficient_evidence`). A citizen who got a "no"
      answer still benefits from a portable record of why.

### Consumption — `/cases/$caseId`

- [ ] In `src/routes/cases.$caseId.tsx`, inside the recommendation
      panel, after the existing rule-evaluation list +
      `BenefitAmountCard` (from govops-017), render
      `<DownloadDecisionButton mode="case" caseId={caseId}
      language={activeLocale} />`.
- [ ] Render the button only when a recommendation exists for the case
      (i.e. POST /evaluate has run); otherwise the button has nothing
      to render against. Same conditional that gates the
      `BenefitAmountCard`.

### i18n keys (all 6 locales)

Add to `src/messages/{lang}.json`:

| key | EN value | FR value |
| --- | --- | --- |
| `screen.download.cta` | `Download decision` | `Télécharger la décision` |
| `screen.download.in_progress` | `Rendering…` | `Génération…` |
| `screen.download.error` | `Could not generate the notice. Please try again.` | `Impossible de générer l'avis. Veuillez réessayer.` |
| `screen.download.tooltip` | `Open the decision notice in a new tab. Use your browser's "Save as PDF" or "Print" to keep a copy.` | `Ouvrir l'avis de décision dans un nouvel onglet. Utilisez "Enregistrer en PDF" ou "Imprimer" de votre navigateur pour garder une copie.` |

For pt-BR, es-MX, de, uk: machine-translate and flag.

### Out of scope

- Don't add a separate "Download as PDF" CTA. PDF rendering is a
  follow-up backend concern (separate ADR pending dependency choice).
  Today: open HTML in new tab, citizen uses browser's print-to-PDF.
- Don't store the rendered HTML or the sha256 anywhere (localStorage,
  IndexedDB, cookies). The citizen gets a tab; they decide what to keep.
- Don't add a "Send by email" / "Share" CTA. Out of scope; raises legal
  and identity questions that warrant their own spec.
- Don't add a back-end-side rate limit specifically for `/api/screen/notice`
  here. The generic `/api/screen` rate limit (already shipped) covers it.

### Verification

- [ ] Eligible CA case on `/screen/ca-oas` shows a "Download decision"
      button below the result; clicking opens a new tab containing the
      rendered HTML notice.
- [ ] Same on `/cases/{id}` for an evaluated demo case.
- [ ] Ineligible / partial cases also expose the button (privacy of the
      record is the same; portability is the feature).
- [ ] French locale renders FR strings on the button + tooltip and
      passes `lang=fr` to the API (verify in network panel).
- [ ] Backend `4xx` / `5xx` shows a toast and re-enables the button.
- [ ] `npm run check:i18n` passes.
- [ ] `npm run lint` clean.
- [ ] Existing Playwright suite passes; smoke spec gains an assertion
      that the button is present on `/screen` after an eligible result.
