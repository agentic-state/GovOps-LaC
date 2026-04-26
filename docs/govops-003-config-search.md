# GovOps Spec — ConfigValue search & filter
<!-- type: route, priority: p1, depends_on: [govops-001, govops-002] -->
type: route
priority: p1
depends_on: [govops-001, govops-002]
spec_id: govops-003

## Intent

Give a maintainer the ability to find any `ConfigValue` record across all jurisdictions and domains by typing part of a key, choosing a domain, or filtering by jurisdiction / language. This is the entry point to the admin UI — every other Phase 6 surface (`govops-004` through `govops-008`) is reached via search results.

## Acceptance criteria

- [ ] Route `/config` lists every `ConfigValue` returned by `GET /api/config/values` with no filters
- [ ] Search input (debounced 200ms) filters by `key_prefix` server-side; client never holds the full result set
- [ ] Three filter dropdowns: **Domain** (`rule` / `enum` / `ui` / `prompt` / `engine` / "all"), **Jurisdiction** (populated from a hardcoded list of the six current jurisdictions plus "global" and "all"), **Language** (`en` / `fr` / `pt` / `es` / `de` / `uk` / "all")
- [ ] Active filters persist to URL query string (`?key_prefix=ca-oas.rule&domain=rule&jurisdiction_id=ca-oas`)
- [ ] Result row shows: full key (mono), value preview (truncated to 60 chars), value_type badge, jurisdiction chip, effective_from date (locale-formatted), citation (mono, hover-underlined per `govops-001` citation token)
- [ ] Provenance ribbon on each row reflects the record's `author` field — `agent` if author starts with `agent:`, `human` otherwise (heuristic for v1)
- [ ] Click a row → navigate to `/config/$key/$jurisdictionId` (timeline view, `govops-004`)
- [ ] Empty state when no results: lavender-soft card with "No matching ConfigValue records." in the active locale
- [ ] Loading state: skeleton rows (3 placeholder rows, shimmer animation respecting reduced-motion)
- [ ] Error state: red civic banner with the API error message; "Retry" button refetches
- [ ] Page is keyboard-navigable: Tab moves through filters → search → results; Enter on a row opens timeline
- [ ] Result count and active filter chips are announced via `aria-live="polite"`

## Files to create / modify

```
src/routes/config.tsx                        (new — flat dot, list view)
src/components/govops/ConfigValueRow.tsx     (new)
src/components/govops/ConfigValueFilters.tsx (new)
src/components/govops/ValueTypeBadge.tsx     (new)
src/components/govops/JurisdictionChip.tsx   (new)
src/lib/api.ts                               (modify — add `listConfigValues(params)`)
src/lib/types.ts                             (new — TypeScript types mirroring backend ConfigValue)
src/messages/en.json                         (modify — add config.* keys)
src/messages/fr.json                         (modify)
src/messages/ar.json                         (modify)
```

## Tokens / data

Backend contract from `docs/api/openapi-v0.3.0-draft.json` (live shape — do NOT use Supabase):

```ts
// src/lib/types.ts
export type ValueType = "number" | "string" | "bool" | "list" | "enum" | "prompt" | "formula";
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";

export interface ConfigValue {
  id: string;                     // ULID, 26 chars
  domain: string;                 // "rule" | "enum" | "ui" | "prompt" | "engine"
  key: string;                    // dotted, e.g. "ca-oas.rule.age-65.min_age"
  jurisdiction_id: string | null; // null = global
  value: unknown;                 // any JSON-serializable
  value_type: ValueType;
  effective_from: string;         // ISO-8601 with timezone
  effective_to: string | null;
  citation: string | null;
  author: string;
  approved_by: string | null;
  rationale: string;
  supersedes: string | null;
  status: ApprovalStatus;
  language: string | null;
  created_at: string;
}

export interface ListConfigValuesResponse {
  values: ConfigValue[];
  count: number;
}
```

```ts
// src/lib/api.ts addition
export async function listConfigValues(params: {
  domain?: string;
  key_prefix?: string;
  jurisdiction_id?: string;
  language?: string;
}): Promise<ListConfigValuesResponse> {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([_, v]) => v && v !== "all")
  ).toString();
  const r = await fetcher(`/api/config/values${qs ? "?" + qs : ""}`);
  if (!r.ok) throw new Error(`listConfigValues failed: ${r.status}`);
  return r.json();
}
```

Use these existing tokens: `--surface`, `--border`, `--foreground`, `--foreground-muted`, `--agentic`, `--authority`, `--font-mono` (key + citation), `--ring-focus` (focus ring on rows).

## Reference implementation

```tsx
// src/components/govops/ConfigValueRow.tsx
import { Link } from "@tanstack/react-router";
import { useIntl, FormattedDate } from "react-intl";
import { ProvenanceRibbon } from "./ProvenanceRibbon";
import { ValueTypeBadge } from "./ValueTypeBadge";
import { JurisdictionChip } from "./JurisdictionChip";
import type { ConfigValue } from "@/lib/types";

export function ConfigValueRow({ cv }: { cv: ConfigValue }) {
  const intl = useIntl();
  const provenance = cv.author.startsWith("agent:") ? "agent" : "human";
  const preview = String(cv.value ?? "").slice(0, 60);

  return (
    <Link
      to="/config/$key/$jurisdictionId"
      params={{ key: cv.key, jurisdictionId: cv.jurisdiction_id ?? "global" }}
      className="flex items-stretch gap-0 rounded-md border border-border bg-surface hover:bg-surface-sunken focus-visible:shadow-[var(--ring-focus)] outline-none"
    >
      <ProvenanceRibbon variant={provenance} />
      <div className="flex-1 px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
        <div className="min-w-0">
          <div className="font-mono text-sm truncate">{cv.key}</div>
          <div className="text-foreground-muted text-sm truncate">{preview}</div>
        </div>
        <div className="flex items-center gap-2">
          <ValueTypeBadge type={cv.value_type} />
          <JurisdictionChip id={cv.jurisdiction_id} />
        </div>
        <div className="text-foreground-muted text-sm">
          <FormattedDate value={cv.effective_from} year="numeric" month="short" day="numeric" />
        </div>
      </div>
    </Link>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, ar]
rtl_mirroring: auto
copy_keys:
  - config.search.placeholder       # "Search by key prefix…"
  - config.filter.domain.label
  - config.filter.domain.all
  - config.filter.domain.rule
  - config.filter.domain.enum
  - config.filter.domain.ui
  - config.filter.domain.prompt
  - config.filter.domain.engine
  - config.filter.jurisdiction.label
  - config.filter.jurisdiction.all
  - config.filter.jurisdiction.global
  - config.filter.language.label
  - config.filter.language.all
  - config.results.count            # "{count, plural, one {# record} other {# records}}"
  - config.empty.title
  - config.empty.body
  - config.error.title
  - config.error.retry
  - config.row.provenance.agent
  - config.row.provenance.human
```

Numerals stay Latin in `ar`. Dates/numbers via `react-intl` `<FormattedDate>` / `<FormattedNumber>`.

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - Tab through filters, search input, then result rows
  - Enter / Space on a result row navigates to timeline
  - Esc clears search input when focused
aria_live: polite      # for "X records found" announcement after filter changes
reduced_motion: respect
landmarks:
  - <section aria-labelledby="config-heading"> wraps the page
list_semantics:
  - Result rows use <ol role="list"> and <li> (each row is a Link, list item carries no extra role)
```

provenance: hybrid

## Out of scope

- Drafting / editing values (deferred to `govops-006`)
- Approval flow (deferred to `govops-007`)
- Diff between versions (deferred to `govops-005`)
- Per-key history view (deferred to `govops-004`)
- Server-side pagination — Phase 1 returns the full filtered set; revisit if a single jurisdiction exceeds ~500 records
- Saved searches / bookmarks
- Export to CSV / YAML
