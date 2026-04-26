# GovOps Spec — Admin stats dashboard
<!-- type: route, priority: p2, depends_on: [govops-001, govops-002, govops-003, govops-009, govops-010, govops-011] -->
type: route
priority: p2
depends_on: [govops-001, govops-002, govops-003, govops-009, govops-010, govops-011]
spec_id: govops-012

## Intent

Single-screen operator overview: how many jurisdictions, authority links, legal documents, rules, ConfigValues, cases, recommendations, reviews, audit entries, and pending approvals are currently in the system. Each tile links to the relevant surface so the dashboard is also a navigation hub. Replaces the existing Jinja `/admin` page.

## Acceptance criteria

- [ ] Route `/admin` loads in parallel: `GET /api/health`, `GET /api/authority-chain`, `GET /api/legal-documents`, `GET /api/rules`, `GET /api/config/values`, `GET /api/cases`, plus `GET /api/encode/batches` (mock-fallback per `govops-011`)
- [ ] **Header**: jurisdiction switcher (lists `available_jurisdictions` from `/api/health`, posts to `POST /api/jurisdiction/{code}` on selection, then refetches all)
- [ ] **Stat tiles** (responsive grid: 4 cols ≥1024px, 2 cols ≥640px, 1 col below) — each tile is a clickable card linking to its surface:
  - Jurisdictions (count from `available_jurisdictions.length`) → masthead jurisdiction switcher
  - Authority links → `/authority`
  - Legal documents → `/authority#documents`
  - Rules → `/authority#rules`
  - ConfigValues → `/config`
  - Cases → `/cases`
  - Recommendations (cases where `has_recommendation === true`) → `/cases?has_recommendation=true`
  - Reviews (sum of review actions across cases — derived client-side by walking case detail responses, OR via a dedicated endpoint if added) → `/cases`
  - Pending approvals (ConfigValues with `status in ("draft","pending")`) → `/config/approvals`
  - Encoding batches → `/encode`
  - Audit entries (sum across cases) → `/cases` (no dedicated audit list yet)
- [ ] Each tile shows: large number (mono, tabular-numeric, formatted via `react-intl`), label (sans, sentence case), trend dot (gold = activity in last 7 days, muted = quiet), provenance ribbon
- [ ] Provenance per tile:
  - `human`: legal documents, rules, authority links, reviews
  - `agent`: recommendations, encoding batches (LLM ones), prompts
  - `hybrid`: ConfigValues, pending approvals, encoding batches (manual+LLM mix)
  - `system`: jurisdictions, audit entries
- [ ] **Recent activity** panel (right rail ≥1280px, below tiles on smaller): unified timeline of the last 20 events from `audit_trails` across all cases + recent ConfigValue creations + recent batch commits — sorted desc by timestamp
  - Each event row: timestamp (relative, e.g. "2h ago"), actor, event_type chip, detail (truncated 80 chars), source link
  - Empty state: "No recent activity"
- [ ] **System health** strip at bottom: API status (from `/api/health.status`), version, current jurisdiction, current program — small mono row, foreground-subtle color
- [ ] Loading: 11 skeleton tiles (preserve grid)
- [ ] Per-tile error: tile shows "—" with a tooltip on hover explaining which endpoint failed; the rest of the dashboard continues to render
- [ ] Refresh button (top right) — refetches all sources; spinner while in-flight; uses `--duration-base` rotation, respects reduced-motion (replace with opacity pulse)

## Files to create / modify

```
src/routes/admin.tsx                                  (new)
src/components/govops/admin/StatTile.tsx              (new)
src/components/govops/admin/RecentActivity.tsx        (new)
src/components/govops/admin/JurisdictionSwitcher.tsx  (new)
src/components/govops/admin/SystemHealthStrip.tsx     (new)
src/components/govops/admin/RefreshButton.tsx         (new)
src/lib/api.ts                                        (modify — add `health()`, `switchJurisdiction(code)`, ensure listCases/listConfigValues/listRules/etc are exported)
src/lib/aggregations.ts                               (new — pure functions to derive stats from raw responses)
src/messages/{en,fr,pt-BR,es-MX,de,uk}.json           (modify — add admin.* keys)
```

Update masthead nav: add `/admin` link at the end of the nav, separated visually (e.g. `me-auto` ends nav; `/admin` sits next to LanguageSwitcher).

## Tokens / data

```ts
// src/lib/api.ts additions
export interface HealthResponse {
  status: "healthy" | string;
  engine: string;
  version: string;
  jurisdiction: string;
  program: string;
  available_jurisdictions: string[];
}

export async function health(): Promise<HealthResponse> {
  return fetcher<HealthResponse>("/api/health");
}

export async function switchJurisdiction(
  code: string,
): Promise<{ jurisdiction: string; name: string; program: string }> {
  return fetcher(`/api/jurisdiction/${encodeURIComponent(code)}`, { method: "POST" });
}
```

```ts
// src/lib/aggregations.ts
import type { CaseListItem, ConfigValue, EncodingBatchSummary, AuditPackage } from "./types";

export interface DashboardStats {
  jurisdictions: number;
  authorityLinks: number;
  legalDocuments: number;
  rules: number;
  configValues: number;
  cases: number;
  recommendations: number;
  reviews: number;
  pendingApprovals: number;
  encodingBatches: number;
  auditEntries: number;
}

export function deriveStats(input: {
  health: HealthResponse | null;
  authorityLinks: number;
  documents: number;
  rules: number;
  configValues: ConfigValue[];
  cases: CaseListItem[];
  reviews: number;
  batches: EncodingBatchSummary[];
  auditEntries: number;
}): DashboardStats {
  return {
    jurisdictions: input.health?.available_jurisdictions.length ?? 0,
    authorityLinks: input.authorityLinks,
    legalDocuments: input.documents,
    rules: input.rules,
    configValues: input.configValues.length,
    cases: input.cases.length,
    recommendations: input.cases.filter(c => c.has_recommendation).length,
    reviews: input.reviews,
    pendingApprovals: input.configValues.filter(
      c => c.status === "draft" || c.status === "pending",
    ).length,
    encodingBatches: input.batches.length,
    auditEntries: input.auditEntries,
  };
}
```

Tokens used: `--surface-raised` (tiles), `--border` (tile borders), `--authority` (trend dot when active), `--foreground-muted` (trend dot when quiet), `--font-mono` (tabular numerals, system health strip), `--font-serif` (page heading).

Trend dot: 8px circle, `bg-authority` when activity in last 7 days, `bg-foreground-muted` otherwise. Position: top-right of tile, `aria-hidden="true"` (the meaning is conveyed via tooltip).

## Reference implementation

```tsx
// src/components/govops/admin/StatTile.tsx
import { Link } from "@tanstack/react-router";
import { useIntl } from "react-intl";
import { ProvenanceRibbon, type ProvenanceVariant } from "@/components/govops/ProvenanceRibbon";

export function StatTile({
  labelKey, value, to, provenance, recentActivity, loading,
}: {
  labelKey: string;
  value: number;
  to: string;
  provenance: ProvenanceVariant;
  recentActivity: boolean;
  loading?: boolean;
}) {
  const intl = useIntl();
  return (
    <Link
      to={to}
      className="group flex items-stretch rounded-lg border border-border bg-surface-raised
                 hover:bg-surface focus-visible:shadow-[var(--ring-focus)] outline-none"
    >
      <ProvenanceRibbon variant={provenance} />
      <div className="flex-1 p-5 flex flex-col gap-2 relative">
        <span
          className={`absolute top-3 end-3 inline-block h-2 w-2 rounded-full
            ${recentActivity ? "bg-authority" : "bg-foreground-muted"}`}
          aria-hidden="true"
        />
        {loading ? (
          <span className="h-9 w-16 rounded bg-surface-sunken animate-pulse" />
        ) : (
          <span
            className="text-3xl tabular-nums text-foreground"
            style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
          >
            {intl.formatNumber(value)}
          </span>
        )}
        <span className="text-sm text-foreground-muted">
          {intl.formatMessage({ id: labelKey })}
        </span>
      </div>
    </Link>
  );
}
```

## i18n

```yaml
locales_required: [en, fr, pt-BR, es-MX, de, uk]
rtl_mirroring: capable_but_inactive
copy_keys:
  - admin.heading
  - admin.lede
  - admin.refresh
  - admin.refreshing
  - admin.tile.jurisdictions
  - admin.tile.authority_links
  - admin.tile.legal_documents
  - admin.tile.rules
  - admin.tile.config_values
  - admin.tile.cases
  - admin.tile.recommendations
  - admin.tile.reviews
  - admin.tile.pending_approvals
  - admin.tile.encoding_batches
  - admin.tile.audit_entries
  - admin.trend.recent                      # tooltip: "Activity in the last 7 days"
  - admin.trend.quiet                       # tooltip: "No recent activity"
  - admin.activity.heading
  - admin.activity.empty
  - admin.activity.relative                 # ICU: "{date, relativeTime}"
  - admin.health.heading
  - admin.health.status                     # ICU: "API: {status}"
  - admin.health.version                    # ICU: "v{version}"
  - admin.health.jurisdiction               # ICU: "Jurisdiction: {code}"
  - admin.health.program                    # ICU: "Program: {program}"
  - admin.jurisdiction.switcher.label
  - admin.jurisdiction.switcher.help        # "Switching reseeds all data."
  - admin.error.partial                     # ICU: "{count, plural, one {# tile failed to load} other {# tiles failed to load}}"
```

## a11y

```yaml
contrast: AA
focus_visible: required
keyboard:
  - Tab through: jurisdiction switcher → refresh → tiles in grid order → recent activity entries → health strip
  - Each tile is a Link (Enter to activate)
  - Refresh button: Space/Enter to fire
aria_live: polite
  - Refresh start / completion announced
  - "Jurisdiction switched to X" announced after the post-switch refetch completes
reduced_motion: respect
  - Refresh spinner: rotate animation replaced with opacity pulse
  - Tile skeletons use opacity pulse (already), no transforms
landmarks:
  - <main> for the page
  - <section aria-labelledby="tiles-heading"> for the stat grid
  - <section aria-labelledby="activity-heading"> for the activity panel
  - <footer> for the system health strip
tile_a11y:
  - Tile is a Link with descriptive aria-label "{value} {label} — view all"
  - Numbers use tabular-numeric for visual alignment AND for screen-reader stability
```

provenance: hybrid
  # Dashboard composes mixed provenance (system metrics + agent activity + human reviews).

## Out of scope

- User-configurable dashboards (drag-drop tiles)
- Time-series charts (cases-per-week, etc.) — premature; add only when there's enough longitudinal data
- Export to CSV / PDF
- Scheduled report emails
- Cross-jurisdiction comparison view
- Cost / usage metrics (LLM tokens, latency aggregates) — Phase 4 territory once prompts ship as ConfigValues
- Real-time live counts (websocket subscriptions) — manual refresh only
- Advanced filtering on the activity feed (by actor, event type)
