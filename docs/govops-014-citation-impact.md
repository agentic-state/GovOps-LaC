# GovOps Spec — Citation impact search
<!-- type: route, priority: p1, depends_on: [govops-002, govops-003] -->
type: route
priority: p1
depends_on: [govops-002, govops-003]
spec_id: govops-014

## Intent

Phase 7 of the Law-as-Code v2.0 plan: when a statute or regulation changes,
a maintainer needs to see — in one query — every `ConfigValue` record across
every jurisdiction that points at that citation, so the policy edit can be
scoped before it's drafted. This is a read-only investigative surface:
type or paste a citation string, see every dependent record grouped by
jurisdiction, click through to its timeline.

The same surface answers the inverse question for auditors: "show me what in
this system is grounded in section X of statute Y." It is the missing link
between the authority chain (`/authority`) and the ConfigValue admin
(`/config`).

## Acceptance criteria

- [ ] Route `/impact` renders an empty state and a single search input on first load (no implicit query)
- [ ] Search input accepts a free-text citation fragment (e.g. `OAS Act, s. 3(1)`); debounced 250ms; submits on Enter or after debounce
- [ ] Active query persists to URL query string: `/impact?citation=OAS+Act%2C+s.+3%281%29`; on direct navigation with `?citation=…`, the search runs immediately and the input is pre-filled
- [ ] Backend call: `GET /api/impact?citation=<urlencoded>` — see contract below. Empty/whitespace query short-circuits without a network call
- [ ] Results render as a stack of jurisdiction sections; each section header shows the jurisdiction's display name + flag chip + match count (`{count, plural, one {# record} other {# records}}`)
- [ ] Within each section, rows reuse the existing **`ConfigValueRow`** component from `govops-003` (full key mono, value preview, type badge, effective_from). Click → existing timeline route `/config/$key/$jurisdictionId`
- [ ] Cross-jurisdictional results (records with `jurisdiction_id === null`) appear under a "Global" section, sorted to the top
- [ ] Match-highlight: the citation substring inside each row's citation field is wrapped in `<mark>` (semantic highlight; CSS uses `--surface-sunken` background, not the browser default)
- [ ] Result count summary above the sections: "{n} records across {m} jurisdictions referencing «{query}»" — announced via `aria-live="polite"` after each query completes
- [ ] Empty result state: parchment-soft card "No records reference this citation yet." with a hint linking to `/authority` (the canonical citation list)
- [ ] Loading state: 3 skeleton rows under a single skeleton section header (shimmer respects reduced-motion)
- [ ] Error state: civic banner with the API error message + Retry button (re-issues the same query)
- [ ] Keyboard: Tab moves focus from search input → first result row; Enter on a row navigates; `/` from anywhere on the page focuses the search input (only when not already inside a text field)
- [ ] Page is reachable from the global nav under a new "Impact" entry, sitting between "Authority" and "Encode"
- [ ] When the live API returns 404 / network failure, the existing mock-fallback pattern in `src/lib/api.ts` returns a deterministic mock from `mock-impact.ts` so preview environments still render

## Files to create / modify

```
src/routes/impact.tsx                          (new — flat route)
src/components/govops/ImpactSection.tsx        (new — one jurisdiction's results)
src/components/govops/CitationHighlight.tsx    (new — wraps query substring in <mark>)
src/lib/api.ts                                 (modify — add impactByCitation())
src/lib/mock-impact.ts                         (new — mock fallback fixture)
src/lib/types.ts                               (modify — add ImpactResult, ImpactResponse)
src/messages/en.json                           (modify — add impact.* keys)
src/messages/fr.json                           (modify)
src/messages/pt-BR.json                        (modify)
src/messages/es-MX.json                        (modify)
src/messages/de.json                           (modify)
src/messages/uk.json                           (modify)
```

Do not touch `routeTree.gen.ts` — TanStack regenerates it. Do not add an
Arabic locale; the project ships en/fr/pt-BR/es-MX/de/uk and PLAN forbids
new languages during structural work.

## Tokens / data

Backend contract (Phase 7 endpoint, lands alongside this spec):

```ts
// src/lib/types.ts addition
export interface ImpactResult {
  jurisdiction_id: string | null;        // null = global
  jurisdiction_label: string;            // server-formatted display name
  values: ConfigValue[];                 // existing ConfigValue type from govops-003
}

export interface ImpactResponse {
  query: string;                         // echoed back, normalized (trimmed, single-spaced)
  total: number;                         // total matches across the FULL set (not page-scoped)
  jurisdiction_count: number;            // distinct jurisdictions across the FULL set (not page-scoped)
  limit: number;                         // effective page size (default 50, floor 1, cap 200) — see PLAN §12 7.x.1
  page: number;                          // 1-indexed page number, echoed back (floor 1)
  page_count: number;                    // ceil(total / limit), or 0 when total === 0
  results: ImpactResult[];               // sections containing values on THIS page; sorted: global first, then by jurisdiction_label asc
}
```

```ts
// src/lib/api.ts addition
export async function impactByCitation(citation: string): Promise<ImpactResponse> {
  const trimmed = citation.trim();
  if (!trimmed) return { query: "", total: 0, jurisdiction_count: 0, results: [] };
  const qs = new URLSearchParams({ citation: trimmed }).toString();
  try {
    return await fetcher<ImpactResponse>(`/api/impact?${qs}`);
  } catch {
    const { MOCK_IMPACT_RESPONSE } = await import("./mock-impact");
    return MOCK_IMPACT_RESPONSE(trimmed);
  }
}
```

Reuse existing tokens only: `--surface`, `--surface-sunken`, `--border`,
`--foreground`, `--foreground-muted`, `--agentic`, `--authority`,
`--font-mono`, `--ring-focus`. No new tokens.

## Reference implementation

```tsx
// src/components/govops/CitationHighlight.tsx
export function CitationHighlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const needle = query.trim();
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          backgroundColor: "var(--surface-sunken)",
          color: "var(--foreground)",
          padding: "0 0.15em",
          borderRadius: "2px",
        }}
      >
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  );
}
```

```tsx
// src/routes/impact.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { impactByCitation } from "@/lib/api";
import type { ImpactResponse } from "@/lib/types";
import { ImpactSection } from "@/components/govops/ImpactSection";

export const Route = createFileRoute("/impact")({
  validateSearch: (s: Record<string, unknown>) => ({
    citation: typeof s.citation === "string" ? s.citation : "",
  }),
  component: ImpactPage,
});

function ImpactPage() {
  const { citation } = Route.useSearch();
  const navigate = useNavigate({ from: "/impact" });
  const intl = useIntl();
  const [input, setInput] = useState(citation);
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // sync URL → input
  useEffect(() => { setInput(citation); }, [citation]);

  // run query when ?citation= changes
  useEffect(() => {
    let cancelled = false;
    if (!citation.trim()) { setData(null); return; }
    setLoading(true); setError(null);
    impactByCitation(citation)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [citation]);

  function onChange(v: string) {
    setInput(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      navigate({ search: { citation: v }, replace: true });
    }, 250);
  }

  return (
    <section aria-labelledby="impact-heading" className="px-6 py-8 max-w-5xl mx-auto">
      <h1 id="impact-heading" className="text-2xl font-serif mb-2">
        {intl.formatMessage({ id: "impact.heading" })}
      </h1>
      <p className="text-foreground-muted mb-6">
        {intl.formatMessage({ id: "impact.lede" })}
      </p>
      <input
        type="search"
        value={input}
        onChange={(e) => onChange(e.target.value)}
        placeholder={intl.formatMessage({ id: "impact.search.placeholder" })}
        className="w-full rounded-md border border-border bg-surface px-4 py-3 font-mono text-sm focus-visible:shadow-[var(--ring-focus)] outline-none"
        aria-label={intl.formatMessage({ id: "impact.search.placeholder" })}
      />
      <div className="mt-6" aria-live="polite">
        {error && <ErrorBanner message={error} />}
        {loading && <ImpactSkeleton />}
        {data && data.total > 0 && (
          <>
            <p className="text-sm text-foreground-muted mb-4">
              {intl.formatMessage(
                { id: "impact.summary" },
                { n: data.total, m: data.jurisdiction_count, query: data.query },
              )}
            </p>
            {data.results.map((r) => (
              <ImpactSection key={r.jurisdiction_id ?? "global"} result={r} query={data.query} />
            ))}
          </>
        )}
        {data && data.total === 0 && <EmptyState />}
      </div>
    </section>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: not_applicable
copy_keys:
  - nav.impact                          # nav label "Impact" — shipped under nav.* prefix to match sibling nav keys (was specced as impact.nav; renamed during 014 implementation, see PLAN §12 7.x.2)
  - impact.heading                      # "Citation impact"
  - impact.lede                         # one-line description
  - impact.search.placeholder           # "Paste a citation (e.g. OAS Act, s. 3(1))"
  - impact.summary                      # ICU: "{n, plural, one {# record} other {# records}} across {m, plural, one {# jurisdiction} other {# jurisdictions}} referencing «{query}»"
  - impact.section.global               # "Global / cross-jurisdictional"
  - impact.empty.title                  # "No records reference this citation yet."
  - impact.empty.body                   # "Try the authority chain to confirm the citation exists."
  - impact.empty.cta                    # "Browse authority chain"
  - impact.error.title                  # "Couldn't run the impact query"
  - impact.error.retry                  # "Retry"
```

Numerals stay locale-default via `react-intl` `<FormattedNumber>`. Citations
are mono-font and not translated.

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - "Tab through search input → first result row → subsequent rows"
  - "Enter on a row navigates to /config/$key/$jurisdictionId"
  - "/ from anywhere on the page focuses the search input (only when not already in a text field)"
aria_live: polite                       # for result-count summary
aria_live_atomic: true                  # count summary re-announces in full on each query (PLAN §12 7.x.5 — shipped baseline above the spec minimum)
reduced_motion: respect                 # skeleton shimmer respects prefers-reduced-motion
landmarks:
  - "<section aria-labelledby='impact-heading'> wraps the page"
  - "Result-count summary carries role='region' (PLAN §12 7.x.5)"
list_semantics:
  - "Each ImpactSection is a <section aria-labelledby='impact-section-{id}'> with its own list of result rows"
  - "Result rows reuse govops-003's row semantics (Link inside <li>)"
mark_element:
  - "<mark> highlights the matched citation substring; default browser styling overridden to use --surface-sunken"
  - "Each <mark> carries an aria-label naming the matched substring (PLAN §12 7.x.5 — strict accessibility upgrade over the spec minimum)"
error_banner:
  - "role='alert' on the error banner so screen readers announce errors as they appear (PLAN §12 7.x.5)"
form_submission:
  - "<form onSubmit> wrapper around the search input bypasses the 250 ms debounce when the user presses Enter (PLAN §12 7.x.6)"
```

provenance: hybrid
  # The page renders human-authored ConfigValues alongside agent-authored
  # ones; the impact-search tool itself is deterministic (no LLM in the
  # query path), so the surface ribbon is hybrid, matching govops-003.

## Out of scope

- Writing / editing values from this surface (use existing draft form)
- CLI integration (`govops impact-of` ships in the same backend PR but is not a Lovable concern)
- ~~Server-side pagination — Phase 1 returns the full match set; revisit if a single citation matches >500 records~~ **AMENDED 2026-04-28**: server-side pagination shipped via PLAN §12 7.x.1. `GET /api/impact` now accepts `limit` (default 50, floor 1, cap 200) and `page` (1-indexed, default 1), returns `limit` / `page` / `page_count` in `ImpactResponse`. `total` and `jurisdiction_count` describe the FULL match set so the summary string stays meaningful across pages; `results` carries only the sections containing values on the requested page; out-of-range pages return `results=[]` (not 404).
- Saved / shareable impact reports (exportable view) — defer
- Filtering by domain or value_type within the impact view (open-ended scope creep)
- Cross-citation comparison (two queries side by side)
- Authority-chain integration (clicking a citation in `/authority` to launch the impact query) — track separately as a polish follow-up
