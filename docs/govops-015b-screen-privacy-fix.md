# GovOps Spec — Phase 10A privacy regression fix
<!-- type: bug-fix, priority: p0, depends_on: [govops-015] -->
type: bug-fix
priority: p0
depends_on: [govops-015]
spec_id: govops-015b

## Intent

The post-flight pass on the citizen-facing self-screening surface introduced a
load-bearing privacy regression that must be reverted before the surface goes
live to any audience (and definitely before the project pings SPRIND).

The artefact at `eva-foundry/user-insights-hub@main` now persists the entire
self-screening form state — date of birth, residency periods, legal status,
country of birth, evidence flags — to `sessionStorage` on every keystroke, and
restores it on mount. Two pieces ship the persistence: `src/lib/screenDraft.ts`
and the corresponding `useEffect` calls in `ScreenForm.tsx`. A reset
confirmation dialog and a "draft restored" banner sit on top of the same
storage layer.

This violates the explicit privacy invariant from
[govops-015 §Acceptance — Cross-cutting](govops-015-self-screening.md):

> No `localStorage` / `sessionStorage` writes containing PII; all state is
> in-memory React state. The only browser storage allowed is the existing
> locale cookie.

> No analytics events that include any form-field values

It also makes the citizen-facing copy factually false. The current
`screen.lede` text says *"Your answers stay on your device — nothing is saved
or sent for review."* That string is now a lie: the answers are saved, to
disk-backed sessionStorage, on every change. Even though sessionStorage is
scoped to the tab, "saved" is "saved" — the spec invariant is **no PII at
rest, period**, and the citizen-facing copy commits to that posture.

This is a single-purpose fix. Delete the persistence layer; preserve the
post-flight wins that are independent of it (validation summary panel, pure
validator, dialog component repurposed as in-memory clear).

## Acceptance criteria

### Persistence layer removal

- [ ] Delete the file `src/lib/screenDraft.ts` entirely.
- [ ] In `src/components/govops/ScreenForm.tsx`, remove the `import` of `screenDraft`, the `useEffect` that calls `saveScreenDraft(...)`, and the `useEffect` (or initializer) that calls `loadScreenDraft(...)` to hydrate state.
- [ ] The form's initial state is built from `useState(...)` with empty/default values only — no read from any browser storage.
- [ ] No `localStorage` or `sessionStorage` API call appears anywhere in `src/components/govops/Screen*` or `src/routes/screen*`. Verify with `grep -RE 'localStorage|sessionStorage' src/components/govops/Screen src/routes/screen` returning zero matches.
- [ ] The "draft restored" banner component / markup is removed from the form route. The "Clear draft" affordance, if it existed, is removed too.

### Reset behaviour

- [ ] Keep the `<Dialog>` component shipped in the post-flight pass (it is well-built and reusable). Repurpose it as a **plain in-memory reset confirmation**: the user clicks a "Reset" button, the dialog asks "Discard your answers and start over?", confirming clears all React state to defaults.
- [ ] Drop the i18n keys `screen.draft.restored`, `screen.draft.clear` from all six locales (the draft-restore banner is gone).
- [ ] Repurpose the existing `screen.reset.title`, `screen.reset.body`, `screen.reset.keep`, `screen.reset.discard` keys for the in-memory clear (the dialog stays; only the underlying state-clearing behaviour changes — no storage write/delete). Update the body copy across all six locales to remove any reference to a "draft" being kept or discarded; the user is just confirming they want to clear their answers.

### Lede copy correctness

- [ ] The `screen.lede` copy must be true on the page it appears on. Two acceptable shapes:
  - (a) Keep current "Your answers stay on your device — nothing is saved or sent for review" — accurate now that persistence is gone.
  - (b) If you prefer to soften further, replace with locale-equivalent of: "Your answers are not saved. Reload the page and they're gone. Submit only sends them to the eligibility engine — no case is created."
- [ ] Whichever shape is chosen, ship the same intent across all six locales (`en`, `fr`, `pt-BR`, `es-MX`, `de`, `uk`).

### Tests

- [ ] Add a Playwright assertion to `screen.spec.ts` (or wherever the screen E2E lives) that `await page.evaluate(() => sessionStorage.getItem('govops:screen-draft'))` returns `null` after filling the form, after submitting, and after reloading the page.
- [ ] Add a Playwright assertion that reloading the form route with a partially-filled form discards all input.
- [ ] Existing unit tests for the pure validator (`src/lib/screenValidation.ts`) must still pass — that file is preserved.

### What stays (do NOT remove)

These post-flight additions are independent of the persistence layer and represent strict improvements over the original spec:

- `src/lib/screenValidation.ts` — pure validator extracted, testable in isolation. Keep.
- The validation summary panel at form top with focus-jump links + ICU plural heading. Keep.
- Per-field `<p role="alert">` validation messages with `aria-describedby` + `aria-invalid`. Keep.
- The mojibake re-encoding fix in `en.json` (`screen.disclaimer.body` em-dash, `screen.footer.disclaimer` middle-dot). Keep.
- The `<Dialog>` component itself, repurposed per "Reset behaviour" above.
- The validation copy keys (`screen.errors.summary.heading` etc.). Keep.

## Files to create / modify

```
DELETE:
  src/lib/screenDraft.ts

MODIFY:
  src/components/govops/ScreenForm.tsx          (remove screenDraft imports, useEffects, restore-banner markup)
  src/routes/screen.$jurisdictionId.tsx         (remove any draft-restored banner state if present here)
  src/messages/en.json                          (remove screen.draft.* keys; revise screen.reset.body; verify screen.lede)
  src/messages/fr.json                          (same)
  src/messages/pt-BR.json                       (same)
  src/messages/es-MX.json                       (same)
  src/messages/de.json                          (same)
  src/messages/uk.json                          (same)

ADD:
  e2e/screen.spec.ts                            (sessionStorage assertions; or extend existing spec)
```

Do not touch `routeTree.gen.ts`.

## Tokens / data

No tokens, no contract types. Pure deletion + state-management refactor.

## Reference behaviour

```ts
// ScreenForm.tsx — desired shape after fix
function ScreenForm() {
  // Pure in-memory state. No storage hydration.
  const [dob, setDob] = useState<string>("");
  const [legalStatus, setLegalStatus] = useState<LegalStatus | null>(null);
  const [residencyPeriods, setResidencyPeriods] = useState<ResidencyPeriod[]>([
    { country: "", start_date: "", end_date: null },
  ]);
  const [evidence, setEvidence] = useState({ dob: false, residency: false });
  const [showResetDialog, setShowResetDialog] = useState(false);

  // No useEffect to saveScreenDraft.
  // No useEffect to loadScreenDraft.

  function resetAll() {
    setDob("");
    setLegalStatus(null);
    setResidencyPeriods([{ country: "", start_date: "", end_date: null }]);
    setEvidence({ dob: false, residency: false });
    setShowResetDialog(false);
  }

  return (
    <>
      {/* form fields */}
      <ResetDialog
        open={showResetDialog}
        onCancel={() => setShowResetDialog(false)}
        onConfirm={resetAll}
      />
    </>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: not_applicable
copy_keys_to_remove:
  - screen.draft.restored
  - screen.draft.clear
copy_keys_to_revise:
  - screen.reset.body          # remove any reference to a saved draft; phrase as "discard answers and start over?"
copy_keys_to_verify_truthful:
  - screen.lede                # must be accurate post-fix; see Acceptance §Lede copy correctness
```

## a11y

```yaml
contrast: AA                      # preserved
focus_visible: required           # preserved
keyboard:                         # preserved
  - Tab through form
  - Esc closes Reset dialog
  - Esc on result returns focus to first form field (existing bonus, keep)
aria_live: polite                 # preserved on result card
reduced_motion: respect           # preserved
dialog_a11y:
  - Reset dialog uses the existing focus-trap + aria-modal pattern
  - Initial focus on the dialog's "Cancel" / "Keep my answers" button (the safe default)
```

provenance: hybrid
  # Citizen-facing surface, deterministic engine + ConfigValue substrate

## Out of scope

- Changing the engine, the API, or the response shape — none of these are involved
- Adding a new "save my screening" feature (deliberately out of scope; the citizen surface stays anonymous and stateless)
- Any UX redesign beyond the deletions above
- Modifying the ProvenanceRibbon, ScreenResult, or any other surface
- Closing the program-name-hardcoded polish gap — that's [govops-015a](govops-015a-self-screening-polish.md)
