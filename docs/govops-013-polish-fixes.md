# GovOps Spec — Polish: wordmark glyph + resolve endpoint contract
<!-- type: a11y-fix, priority: p1, depends_on: [govops-002, govops-004] -->
type: a11y-fix
priority: p1
depends_on: [govops-002, govops-004]
spec_id: govops-013

## Intent

Two small but load-bearing corrections from the post-`govops-008` review:

1. **Wordmark glyph**: render `Gov0ps` literally — the middle character is a **zero**, not a styled letter `O`. The brand spec recommended O-as-zero as the primary wordmark because it bakes the law-as-code idea into the mark itself. The current implementation in [src/components/govops/Wordmark.tsx](src/components/govops/Wordmark.tsx) renders `GovOps` with the middle `O` colored lavender — typographically a styled letter, not the zero substitution. Keep the lavender accent on the zero.
2. **Resolve endpoint contract**: the GovOps backend now returns `ConfigValue | null` directly from `GET /api/config/resolve` (no envelope wrapper). Update the frontend client to match — remove the `.resolved` unwrap path, drop the envelope type. This unbreaks the live wire-up; the mock-fallback path was already correct and needs no change.

Both are small. Ship them as a single PR.

## Acceptance criteria

### Wordmark

- [ ] [src/components/govops/Wordmark.tsx](src/components/govops/Wordmark.tsx) renders the literal Unicode character `0` (U+0030, digit zero) as the third character of the wordmark, not the letter `O` (U+004F)
- [ ] The zero retains the agentic accent: `style={{ color: "var(--agentic)" }}` on the zero only
- [ ] `aria-label="GovOps"` is preserved (the spoken/screen-reader form stays "GovOps", not "GovZeroPS")
- [ ] Visual width and rhythm: cap-height of `0` matches surrounding letters in the chosen serif (Newsreader). If the figure is built differently — e.g. lining vs old-style — pick the variant that matches cap-height. CSS `font-variant-numeric: lining-nums` if needed
- [ ] Verify in both light and dark themes; verify the lavender accent still passes 4.5:1 contrast against `--surface` (use the dark-theme variable when in `.dark`)
- [ ] No regressions in the homepage hero (`src/routes/index.tsx`) — the Wordmark is reused there; same change cascades

### Resolve endpoint client

- [ ] In [src/lib/api.ts](src/lib/api.ts), `resolveCurrentConfigValue(key, jurisdictionId, evaluationDate)` calls the backend and treats the response **as `ConfigValue | null`** directly (200 OK, body is either the record or JSON `null`)
- [ ] Remove any `.resolved` indirection or envelope-shaped TypeScript types
- [ ] On network failure, the existing mock-fallback path (`MOCK_CONFIG_VALUES.filter(...)`) is unchanged and still returns `ConfigValue | null`
- [ ] If a TypeScript type was named `ResolveResponse` or similar, delete it
- [ ] Verify by manual smoke: with `VITE_USE_MOCK_API !== "true"` and the FastAPI backend running locally, the approval-review page (`/config/approvals/$id`) and any other "currently in effect" surface either shows the value or shows "No prior version" (when the backend returns null) — never throws
- [ ] No other endpoint client changes needed; this is the only one that had the envelope shape

## Files to create / modify

```
src/components/govops/Wordmark.tsx       (modify — 1 character change + comment update)
src/routes/index.tsx                      (no change required if it imports Wordmark; verify visually)
src/lib/api.ts                            (modify — resolveCurrentConfigValue path)
src/lib/types.ts                          (modify — remove ResolveResponse if it exists)
```

## Tokens / data

No new tokens. Existing `--agentic` (light) / `--agentic` rebound under `.dark` continue to apply.

Backend authority: `GET /api/config/resolve` now returns `ConfigValue | null` directly per the OpenAPI snapshot at `docs/api/openapi-v0.3.0-draft.json`. No envelope.

## Reference implementation

```tsx
// src/components/govops/Wordmark.tsx
// Text wordmark: "Gov0ps" — the middle character is a literal zero, the
// agentic accent on it bakes the law-as-code idea directly into the mark.
// PNG variants in /public are reserved for og:image / favicons.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-serif)",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        fontVariantNumeric: "lining-nums",
      }}
      aria-label="GovOps"
    >
      Gov<span style={{ color: "var(--agentic)" }}>0</span>ps
    </span>
  );
}
```

```ts
// src/lib/api.ts — replace the existing resolveCurrentConfigValue body
export async function resolveCurrentConfigValue(
  key: string,
  jurisdictionId: string | null,
  evaluationDate: string,
): Promise<ConfigValue | null> {
  const params = new URLSearchParams({ key, evaluation_date: evaluationDate });
  if (jurisdictionId) params.set("jurisdiction_id", jurisdictionId);
  try {
    return await fetcher<ConfigValue | null>(
      `/api/config/resolve?${params.toString()}`,
    );
  } catch {
    const { MOCK_CONFIG_VALUES } = await import("./mock-config-values");
    const evalTs = new Date(evaluationDate).getTime();
    const candidates = MOCK_CONFIG_VALUES.filter((v) => {
      if (v.key !== key) return false;
      if ((v.jurisdiction_id ?? null) !== (jurisdictionId ?? null)) return false;
      if (v.status !== "approved") return false;
      const from = new Date(v.effective_from).getTime();
      if (from > evalTs) return false;
      const to = v.effective_to ? new Date(v.effective_to).getTime() : null;
      if (to !== null && to < evalTs) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    return candidates[0];
  }
}
```

## i18n

```yaml
locales_required: []   # no new copy keys; existing keys unchanged
rtl_mirroring: capable_but_inactive
copy_keys: []
```

The wordmark `aria-label` stays as the literal string `"GovOps"` and is not translated (brand mark).

## a11y

```yaml
contrast: AA
focus_visible: not_applicable   # purely a glyph + client refactor
keyboard: not_applicable
aria_live: not_applicable
reduced_motion: not_applicable
brand_mark_a11y:
  - aria-label="GovOps" stays unchanged on the wordmark span
  - Screen readers continue to announce "GovOps" — the visual zero is not announced separately
contrast_check:
  - var(--agentic) light = oklch(0.72 0.130 290), against var(--surface) = oklch(0.985 0.008 90)  → expected ≥4.7:1 (verified in govops-001)
  - var(--agentic) dark = oklch(0.78 0.110 290), against var(--surface) = oklch(0.18 0.030 265)   → expected ≥8.2:1 (verified in govops-001)
```

provenance: none
  # The wordmark itself is the brand mark, not an artifact with provenance.
  # The api.ts change is internal plumbing; no UI provenance shift.

## Out of scope

- Any new feature work
- Refactoring other endpoint clients (this is the only one that had the envelope shape)
- Updating the PNG `/public/govops-wordmark.png` (the spec says use it only for og:image / favicons; it can stay as-is or be regenerated separately)
- Adding contrast unit tests (existing `BrandingCheck.tsx` continues to verify tokens load; no new test required)
