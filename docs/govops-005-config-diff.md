# GovOps Spec — ConfigValue diff view
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002, govops-004] -->
type: route
priority: p1
depends_on: [govops-001, govops-002, govops-004]
spec_id: govops-005

## Intent

Render a side-by-side comparison of any two `ConfigValue` records (typically adjacent versions of the same key) so a maintainer can see exactly what changed: value, citation, rationale, author, effective window. The diff is the surface that makes "law amended on date X" auditable in one screen.

## Acceptance criteria

- [ ] Route `/config/diff?from=<id>&to=<id>` loads both records via `GET /api/config/values/{id}` (parallel)
- [ ] Side-by-side panes on viewport ≥ 768px; stacked vertically below
- [ ] Each pane shows: effective_from (large, locale-formatted), value (rendered per type), citation, rationale, author, approved_by
- [ ] Diff highlighting per `govops-001` `diff-view` token spec:
  - Removed text: red-tinted background, line-through, color `--verdict-rejected`
  - Added text: green-tinted background, underline, color `--verdict-enacted`
  - Context: muted foreground
- [ ] **Value diff**: render with `react-diff-viewer-continued` or equivalent for `string` / `prompt` / `formula` types; for `number` / `bool`, show `before → after` inline; for `list` / `enum`, show added/removed items
- [ ] **Metadata diff strip** at top: 4 columns (effective_from, citation, author, status) showing `from` ⇒ `to` with the diff tokens; if a field is unchanged, show it once in muted tone
- [ ] If both records share the same `key` and `jurisdiction_id` (the common case), header reads "Comparing versions of `<key>` (`<jurisdiction>`)" with a back link to the timeline (`govops-004`)
- [ ] If they differ on `key` or `jurisdiction_id`, header reads "Cross-record comparison" and shows both keys; back link returns to search (`govops-003`)
- [ ] "Swap from/to" button reverses the URL params and re-renders
- [ ] If either id is invalid (404 from API), show error state with the failing id and a "Go back" link
- [ ] Loading state: two skeleton panes (3 placeholder lines each)
- [ ] Print-friendly: `@media print` collapses panes side-by-side regardless of width and removes interactive controls

## Files to create / modify

```
src/routes/config.diff.tsx                   (new — flat dot, ?from & ?to query params)
src/components/govops/DiffPane.tsx           (new)
src/components/govops/DiffMetadataStrip.tsx  (new)
src/components/govops/ValueDiff.tsx          (new — dispatches on value_type)
src/lib/api.ts                               (modify — add `getConfigValue(id)`)
src/messages/{en,fr,ar}.json                 (modify)
package.json                                 (add `react-diff-viewer-continued`)
```

## Tokens / data

```ts
// src/lib/api.ts addition
export async function getConfigValue(id: string): Promise<ConfigValue> {
  const r = await fetcher(`/api/config/values/${id}`);
  if (r.status === 404) throw new Error(`ConfigValue ${id} not found`);
  if (!r.ok) throw new Error(`getConfigValue failed: ${r.status}`);
  return r.json();
}
```

```css
/* additions to src/styles.css */
:root {
  --diff-removed-bg: oklch(0.55 0.18 28 / 0.08);
  --diff-removed-fg: var(--verdict-rejected);
  --diff-added-bg:   oklch(0.62 0.115 155 / 0.10);
  --diff-added-fg:   var(--verdict-enacted);
  --diff-context-fg: var(--foreground-muted);
}

@theme inline {
  --color-diff-removed-bg: var(--diff-removed-bg);
  --color-diff-removed-fg: var(--diff-removed-fg);
  --color-diff-added-bg:   var(--diff-added-bg);
  --color-diff-added-fg:   var(--diff-added-fg);
}
```

`react-diff-viewer-continued` configuration: pass these CSS vars via the `styles` prop so the component matches the GovOps palette instead of defaulting to GitHub greens/reds.

## Reference implementation

```tsx
// src/components/govops/ValueDiff.tsx
import ReactDiffViewer from "react-diff-viewer-continued";
import type { ConfigValue, ValueType } from "@/lib/types";

function stringify(value: unknown, type: ValueType): string {
  if (type === "prompt" || type === "string") return String(value ?? "");
  if (type === "formula") return JSON.stringify(value, null, 2);
  return JSON.stringify(value);
}

export function ValueDiff({ from, to }: { from: ConfigValue; to: ConfigValue }) {
  if (from.value_type !== to.value_type) {
    return (
      <div role="alert" className="rounded border border-verdict-rejected p-3 text-sm">
        Type mismatch: {from.value_type} → {to.value_type}. Cannot diff values directly.
      </div>
    );
  }

  const fromStr = stringify(from.value, from.value_type);
  const toStr = stringify(to.value, to.value_type);

  // Inline rendering for primitives
  if (from.value_type === "number" || from.value_type === "bool") {
    return (
      <div className="font-mono text-lg flex items-center gap-3">
        <span className="bg-diff-removed-bg text-diff-removed-fg line-through px-2 rounded">
          {fromStr}
        </span>
        <span aria-hidden="true">→</span>
        <span className="bg-diff-added-bg text-diff-added-fg underline px-2 rounded">
          {toStr}
        </span>
      </div>
    );
  }

  return (
    <ReactDiffViewer
      oldValue={fromStr}
      newValue={toStr}
      splitView={false}
      hideLineNumbers={from.value_type !== "prompt"}
      styles={{
        variables: {
          light: {
            diffViewerBackground: "var(--surface)",
            addedBackground: "var(--diff-added-bg)",
            addedColor: "var(--diff-added-fg)",
            removedBackground: "var(--diff-removed-bg)",
            removedColor: "var(--diff-removed-fg)",
            wordAddedBackground: "var(--diff-added-bg)",
            wordRemovedBackground: "var(--diff-removed-bg)",
          },
        },
      }}
    />
  );
}
```

## i18n

```yaml
locales_required: [en, fr, ar]
rtl_mirroring: auto
copy_keys:
  - diff.heading.same_key            # "Comparing versions of {key} ({jurisdiction})"
  - diff.heading.cross_record        # "Cross-record comparison"
  - diff.label.from
  - diff.label.to
  - diff.swap                        # "Swap from/to"
  - diff.back_to_timeline
  - diff.back_to_search
  - diff.metadata.effective_from
  - diff.metadata.citation
  - diff.metadata.author
  - diff.metadata.status
  - diff.metadata.unchanged
  - diff.value.unchanged
  - diff.error.not_found             # "ConfigValue {id} not found"
  - diff.error.go_back
  - diff.print.title                 # for the @media print header
```

For RTL: the side-by-side panes should still read **older → newer** in source order; CSS `flex-direction: row` flips automatically under `dir="rtl"`. The arrow glyph in the `from → to` inline diff for primitives stays as `→` (LTR arrow); document this choice in the rule comments.

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - Tab: back link → swap button → from-pane → to-pane → metadata strip
  - Esc on either pane: navigate back (history.back())
aria_live: polite        # announce "Diff loaded" once both panes are populated
reduced_motion: respect
color_independence: required
  - Removed text uses line-through + red color + aria-label "removed"
  - Added text uses underline + green color + aria-label "added"
  - Never rely on color alone (color-blindness, monochrome printing of diffs)
landmarks:
  - <main> wraps the page
  - Each pane is <section aria-labelledby="...">
print:
  - <header>, <main>, both <section> panes preserve in print stylesheet
  - controls (swap button, back link) hidden via @media print
```

provenance: none

## Out of scope

- Three-way merge / conflict resolution
- Bulk diff across many keys
- Diff in narrative form ("the minimum age increased from 65 to 67 effective 2027-01-01") — that's a different surface, possibly Phase 7 (impact analysis)
- Approve / reject directly from the diff view (deferred to `govops-007`)
- Visualizing diff against a different jurisdiction's version of the same key (cross-jurisdiction harmonization is not a v2.0 goal)
