# GovOps Spec — ConfigValue timeline (per-key version history)
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002, govops-003] -->
type: route
priority: p1
depends_on: [govops-001, govops-002, govops-003]
spec_id: govops-004

## Intent

For a single `(key, jurisdiction_id)` pair, render the full version history as a temporal timeline so a maintainer can see what was in effect when, why, and who approved it. This is the primary "show me the history of one configuration value" surface.

## Acceptance criteria

- [ ] Route `/config/$key/$jurisdictionId` (TanStack flat dot params) loads `GET /api/config/versions?key=<key>&jurisdiction_id=<id>` on mount
- [ ] Header shows: full key (mono, copy-to-clipboard button), jurisdiction chip, value-type badge, current-effective indicator (lavender or gold dot depending on provenance)
- [ ] Vertical timeline rendered top-to-bottom (newest-first), with one card per version. RTL: timeline mirrors to right side.
- [ ] Each timeline card shows: value (rendered per type — `prompt` collapsed by default, expand on click), effective_from → effective_to range (locale-formatted), citation, author, approved_by, rationale (max 4 lines, expand if longer), provenance ribbon
- [ ] Records with `effective_to: null` are labeled "Currently in effect" — gold accent if today falls in the window
- [ ] Future-dated records (effective_from > now) get a `pending: scheduled` badge
- [ ] Records with `status != "approved"` get a status badge (`draft`, `pending`, `rejected`) and are visually de-emphasized (50% opacity)
- [ ] "Compare" checkbox on each card; selecting two opens diff view (`govops-005`) with both ids prefilled
- [ ] "Draft new version" button at top of page (gold/authority styling) — pre-fills `key`, `jurisdiction_id`, `value_type` and navigates to `govops-006`
- [ ] When versions count is 0: empty state pointing back to search (`govops-003`) with copy "No history for this key in this jurisdiction."
- [ ] When the URL `key` doesn't exist anywhere: same empty state

## Files to create / modify

```
src/routes/config.$key.$jurisdictionId.tsx   (new — flat dot, two params)
src/components/govops/Timeline.tsx           (new)
src/components/govops/TimelineCard.tsx       (new)
src/components/govops/ValueRenderer.tsx      (new — dispatches on value_type)
src/components/govops/CitationLink.tsx       (new — opens drawer on click)
src/components/govops/CopyButton.tsx         (new)
src/lib/api.ts                               (modify — add `listVersions(...)`)
src/messages/{en,fr,ar}.json                 (modify)
```

## Tokens / data

```ts
// src/lib/api.ts addition
export interface ListVersionsResponse {
  key: string;
  versions: ConfigValue[];   // oldest-first per backend; flip to newest-first on render
  count: number;
}

export async function listVersions(
  key: string,
  jurisdictionId: string | null,
  language?: string
): Promise<ListVersionsResponse> {
  const params = new URLSearchParams({ key });
  if (jurisdictionId && jurisdictionId !== "global") {
    params.set("jurisdiction_id", jurisdictionId);
  }
  if (language) params.set("language", language);
  const r = await fetcher(`/api/config/versions?${params}`);
  if (!r.ok) throw new Error(`listVersions failed: ${r.status}`);
  return r.json();
}
```

Tokens used: `--surface`, `--surface-raised`, `--border`, `--foreground`, `--foreground-muted`, `--agentic`, `--authority`, `--verdict-pending` (scheduled badge), `--verdict-rejected` (rejected badge), `--font-mono`, `--font-serif` (for prompt-type values), `--duration-base` for card hover.

Timeline rule (the vertical line connecting cards):
```css
border-inline-start: 2px solid var(--border-strong);
margin-inline-start: var(--space-4);
padding-inline-start: var(--space-6);
```

## Reference implementation

```tsx
// src/components/govops/TimelineCard.tsx
import type { ConfigValue } from "@/lib/types";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import { ValueRenderer } from "./ValueRenderer";
import { CitationLink } from "./CitationLink";
import { useIntl, FormattedDate } from "react-intl";

export function TimelineCard({
  cv,
  isCurrent,
  selected,
  onSelect,
}: {
  cv: ConfigValue;
  isCurrent: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const intl = useIntl();
  const provenance = cv.author.startsWith("agent:") ? "agent" : "human";
  const isFuture = new Date(cv.effective_from) > new Date();

  return (
    <article
      aria-label={intl.formatMessage(
        { id: "timeline.card.aria" },
        { key: cv.key, date: cv.effective_from }
      )}
      className={`flex rounded-lg border bg-surface ${cv.status !== "approved" ? "opacity-50" : ""}`}
    >
      <ProvenanceRibbon variant={provenance} />
      <div className="flex-1 p-5 space-y-3">
        <header className="flex items-start justify-between gap-4">
          <div className="text-sm text-foreground-muted">
            <FormattedDate value={cv.effective_from} year="numeric" month="short" day="numeric" />
            {" → "}
            {cv.effective_to ? (
              <FormattedDate value={cv.effective_to} year="numeric" month="short" day="numeric" />
            ) : (
              <span className="text-authority">{intl.formatMessage({ id: "timeline.in_effect" })}</span>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected} onChange={() => onSelect(cv.id)} />
            {intl.formatMessage({ id: "timeline.compare" })}
          </label>
        </header>
        <ValueRenderer value={cv.value} type={cv.value_type} />
        {cv.citation && <CitationLink citation={cv.citation} />}
        {cv.rationale && (
          <p className="text-sm text-foreground-muted line-clamp-4">{cv.rationale}</p>
        )}
        <footer className="text-xs text-foreground-subtle font-mono">
          {cv.author}{cv.approved_by && ` · approved by ${cv.approved_by}`}
        </footer>
      </div>
    </article>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, ar]
rtl_mirroring: auto
copy_keys:
  - timeline.heading                # "Version history"
  - timeline.in_effect              # "Currently in effect"
  - timeline.scheduled              # "Scheduled"
  - timeline.compare                # "Compare"
  - timeline.compare.cta            # "View diff (2 selected)"
  - timeline.draft_new              # "Draft new version"
  - timeline.empty.title
  - timeline.empty.body
  - timeline.copy_key               # "Copy key"
  - timeline.copied                 # toast
  - timeline.card.aria              # ICU: "Version of {key} effective from {date, date, medium}"
  - status.draft
  - status.pending
  - status.rejected
  - status.approved
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - Tab through "Draft new version" button, copy-key button, then each timeline card's compare checkbox
  - Space toggles compare checkbox
  - Enter on "Compare" CTA opens diff
aria_live: polite      # announce when 2 items are selected for compare
reduced_motion: respect
landmarks:
  - <main> wraps the page; <section aria-labelledby="timeline-heading"> wraps the timeline
  - Each card is an <article>
```

provenance: hybrid

## Out of scope

- Editing existing versions (immutable by design)
- Diff rendering itself (deferred to `govops-005`)
- Drafting new versions (deferred to `govops-006`)
- Approval transitions (deferred to `govops-007`)
- Cross-jurisdiction comparison (would require a different route shape)
- "What did this resolve to on date X?" — that's `/api/config/resolve`, surfaced separately if needed
