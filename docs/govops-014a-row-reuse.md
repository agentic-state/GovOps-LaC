# GovOps Spec — Phase 7 follow-up: import ConfigValueRow into ImpactSection
<!-- type: refactor, priority: p2, depends_on: [govops-003, govops-014] -->
type: refactor
priority: p2
depends_on: [govops-003, govops-014]
spec_id: govops-014a

## Intent

Phase 7 follow-up landed in [PLAN.md §12](../PLAN.md) item 7.x.3.

The accepted Phase 7 artefact (`/impact`) recomposes a row layout inline
inside [src/components/govops/ImpactSection.tsx](src/components/govops/ImpactSection.tsx)
instead of importing the shared
[src/components/govops/ConfigValueRow.tsx](src/components/govops/ConfigValueRow.tsx)
that drives `/config`. The two were duplicated because `ImpactSection`
needed two things `ConfigValueRow` did not yet support:

1. **Citation highlighting** — the search query is highlighted inside the
   citation field via `<CitationHighlight>`.
2. **Suppressing the per-row jurisdiction chip** — `ImpactSection` already
   shows the chip in its section header, so per-row chips are redundant.

This follow-up extends `ConfigValueRow` to support both, then refactors
`ImpactSection` to use it. Net result: one row component drives every
ConfigValue list in the app, the design-system invariant stays intact, and
any future surface that lists ConfigValues with a search context (e.g. a
filtered `/config` view, a federation discovery surface) inherits the
highlight capability for free.

This is purely structural — no UX change, no copy change, no new locales,
no new tokens.

## Acceptance criteria

### `ConfigValueRow` (extended in place)

- [ ] Adds two new optional props to the existing `ConfigValueRow` signature:
  - `highlightQuery?: string` — when set and non-empty, the citation field renders via `<CitationHighlight text={cv.citation} query={highlightQuery} matchLabel={...} />` instead of as plain text. When unset/empty, behaviour is identical to today.
  - `showJurisdictionChip?: boolean` — defaults to `true` (preserves current behaviour for `/config`); when `false`, the `<JurisdictionChip>` cell and its grid column are omitted from the row so callers that already render the chip elsewhere (e.g. in a section header) don't double-render it.
- [ ] When `showJurisdictionChip` is `false`, the row's grid template adjusts to drop that column. No empty cell, no layout shift compared to the inline implementation.
- [ ] When `highlightQuery` is non-empty but the citation has no match, `CitationHighlight` renders the citation as plain text (existing component behaviour) — no error, no fallback path needed.
- [ ] `matchLabel` for `CitationHighlight` is derived from the existing `impact.match.aria` ICU key when `highlightQuery` is set; if the calling surface doesn't supply that key context (i.e. `useIntl().formatMessage` cannot resolve the id), `CitationHighlight` falls back to its existing default — no new copy keys are introduced.
- [ ] Default props preserve current `/config` behaviour byte-for-byte: rendering a row with no new props passed must produce identical DOM to the current implementation.
- [ ] The component still owns its own `<li>` wrapper (callers stay simple — they render `<ol role="list"> {rows.map(cv => <ConfigValueRow cv={cv} ... />)} </ol>`).

### `ImpactSection` (refactored to consume)

- [ ] Imports `ConfigValueRow` from `./ConfigValueRow` and renders one per `result.values` entry inside the existing `<ol role="list">`.
- [ ] Passes `highlightQuery={query}` and `showJurisdictionChip={false}` on every row.
- [ ] Removes all inline row markup: the `<Link>` row body, the per-row `ProvenanceRibbon`, the per-row grid, the inline `previewValue` helper, the inline `CitationHighlight` invocation, and the inline `<ValueTypeBadge>` usage in the row body. Anything still needed at the section level (header chip, `<CitationHighlight>` import for `matchLabel` plumbing if any) stays.
- [ ] The section header is unchanged: same `<h2>`, same JurisdictionChip in the header, same count line.
- [ ] `previewValue` is no longer needed in `ImpactSection.tsx` after the refactor — delete it from this file (it already lives inside `ConfigValueRow`).
- [ ] The inline `provenance` heuristic (`cv.author.startsWith("agent:")`) is no longer needed in `ImpactSection.tsx` — `ConfigValueRow` already computes it. Delete the duplicate.

### Visual & interaction parity

- [ ] Visual diff vs current `/impact` is none beyond the dropped per-row chip cell (which was redundant by design).
- [ ] All keyboard / focus / hover / link-target behaviour is preserved — `ConfigValueRow` already navigates to `/config/$key/$jurisdictionId` with the right params, which matches the prior inline `<Link>`.
- [ ] All a11y attributes from the prior inline row are present via `ConfigValueRow` (focus ring, hover bg, list semantics).

### Tests

- [ ] If unit tests exist for `ImpactSection`, they keep passing without modification (DOM shape changes minimally — query selectors that target the link / citation / value preview keep matching).
- [ ] If E2E tests target `data-testid` hooks Lovable added on impact rows, those test IDs are forwarded by `ConfigValueRow` (add `data-testid` as an optional pass-through prop if needed; otherwise leave Lovable's E2E hooks on the parent `<li>` or section).
- [ ] No new tests are required by this spec — the refactor is structural; the existing govops-014 acceptance suite continues to cover the behaviour.

## Files to create / modify

```
src/components/govops/ConfigValueRow.tsx     (modify — add 2 optional props, conditional column, conditional citation render)
src/components/govops/ImpactSection.tsx      (modify — import ConfigValueRow, drop inline row markup)
```

Do not modify:
- `src/components/govops/CitationHighlight.tsx` — already correct, used as-is from the row
- `src/lib/api.ts`, `src/lib/types.ts`, `src/lib/mock-impact.ts` — no contract change
- Any locale file under `src/messages/` — no new copy
- `src/routes/impact.tsx` — the page itself doesn't change

## Tokens / data

No token changes. No new copy keys. No new types.

## Reference implementation

```tsx
// src/components/govops/ConfigValueRow.tsx — extended signature
import { FormattedDate, useIntl } from "react-intl";
import { Link } from "@tanstack/react-router";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import { ValueTypeBadge } from "./ValueTypeBadge";
import { JurisdictionChip } from "./JurisdictionChip";
import { CitationHighlight } from "./CitationHighlight";
import type { ConfigValue } from "@/lib/types";

function previewValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

export interface ConfigValueRowProps {
  cv: ConfigValue;
  /** When set, the citation is rendered with `<CitationHighlight>` against this query. */
  highlightQuery?: string;
  /** When false, the per-row JurisdictionChip cell is omitted (callers may render it elsewhere). */
  showJurisdictionChip?: boolean;
}

export function ConfigValueRow({
  cv,
  highlightQuery,
  showJurisdictionChip = true,
}: ConfigValueRowProps) {
  const provenance = cv.author.startsWith("agent:") ? "agent" : "human";
  const intl = useIntl();
  const matchLabel = highlightQuery
    ? intl.formatMessage({ id: "impact.match.aria" }, { query: highlightQuery })
    : undefined;

  // Grid template adjusts based on whether the chip column is present.
  const gridCols = showJurisdictionChip
    ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto_auto]"
    : "sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto]";

  return (
    <li>
      <Link
        to="/config/$key/$jurisdictionId"
        params={{ key: cv.key, jurisdictionId: cv.jurisdiction_id ?? "global" }}
        className="flex items-stretch rounded-md border border-border bg-surface outline-none transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:shadow-[var(--ring-focus)]"
      >
        <ProvenanceRibbon variant={provenance} />
        <div className={`grid flex-1 grid-cols-1 items-center gap-3 px-4 py-3 ${gridCols} sm:gap-4`}>
          <div className="min-w-0">
            <div className="truncate text-sm text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {cv.key}
            </div>
            {cv.citation && (
              <div className="mt-1 truncate text-xs text-foreground-subtle" style={{ fontFamily: "var(--font-mono)" }}>
                {highlightQuery
                  ? <CitationHighlight text={cv.citation} query={highlightQuery} matchLabel={matchLabel} />
                  : cv.citation}
              </div>
            )}
          </div>
          <div className="min-w-0 truncate text-sm text-foreground-muted">
            {previewValue(cv.value)}
          </div>
          <ValueTypeBadge type={cv.value_type} />
          {showJurisdictionChip && <JurisdictionChip id={cv.jurisdiction_id} />}
          <div className="text-xs text-foreground-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <FormattedDate value={cv.effective_from} year="numeric" month="short" day="numeric" />
          </div>
        </div>
      </Link>
    </li>
  );
}
```

```tsx
// src/components/govops/ImpactSection.tsx — refactored to consume ConfigValueRow
import { FormattedMessage } from "react-intl";
import type { ImpactResult } from "@/lib/types";
import { JurisdictionChip } from "./JurisdictionChip";
import { ConfigValueRow } from "./ConfigValueRow";

export function ImpactSection({ result, query }: { result: ImpactResult; query: string }) {
  const id = `impact-section-${result.jurisdiction_id ?? "global"}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <header className="mb-3 flex items-center gap-3 border-b border-border pb-2">
        <h2 id={id} className="text-lg text-foreground" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
          {result.jurisdiction_id === null ? (
            <FormattedMessage id="impact.section.global" />
          ) : (
            result.jurisdiction_label
          )}
        </h2>
        <JurisdictionChip id={result.jurisdiction_id} />
        <span className="ms-auto text-xs text-foreground-muted" style={{ fontFamily: "var(--font-mono)" }}>
          <FormattedMessage id="impact.section.count" values={{ count: result.values.length }} />
        </span>
      </header>
      <ol role="list" className="space-y-2">
        {result.values.map((cv) => (
          <ConfigValueRow
            key={cv.id}
            cv={cv}
            highlightQuery={query}
            showJurisdictionChip={false}
          />
        ))}
      </ol>
    </section>
  );
}
```

## i18n

```yaml
locales_required: []   # no new copy keys
rtl_mirroring: not_applicable
copy_keys: []
```

The `impact.match.aria` key already exists in all 6 locales from govops-014;
this spec only changes which component reads it.

## a11y

```yaml
contrast: AA
focus_visible: required             # preserved via ConfigValueRow
keyboard: not_applicable            # no behaviour change
aria_live: not_applicable           # the live region is on the page, not the row
reduced_motion: respect             # ConfigValueRow has no motion of its own
landmarks: preserved                # section landmarks unchanged
list_semantics: preserved           # <ol role="list"> in ImpactSection, <li> from ConfigValueRow
```

provenance: hybrid
  # ConfigValueRow already computes provenance per row; no change.

## Out of scope

- Any visual / UX redesign of either surface
- Adding pagination logic into `ConfigValueRow` (pagination stays at the page level — see PLAN §12 item 7.x.1)
- Backporting other Lovable extras from PLAN §12 (each gets its own follow-up if needed)
- Changing how `CitationHighlight` itself works
- Renaming or relocating `ConfigValueRow`
- Adding storybook / demo entries
- Adding a unit test specifically for the `highlightQuery` / `showJurisdictionChip` props (the existing govops-014 acceptance suite covers the user-visible behaviour through `ImpactSection`)
- Touching `/config` row rendering — defaults preserve current behaviour, no change visible there
