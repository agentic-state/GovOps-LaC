# GovOps Spec — Phase 10A polish: live-fetch program name + lede
<!-- type: refactor, priority: p2, depends_on: [govops-015, govops-015b] -->
type: refactor
priority: p2
depends_on: [govops-015, govops-015b]
spec_id: govops-015a

## Intent

Phase 10A polish gap from [PLAN.md §12](../PLAN.md) item 10A.x.2. The original
spec required the form route to fetch program name + lede live from
`/api/jurisdiction/{code}` so the citizen-facing surface stays in sync with
the backend authority chain. Lovable's first pass shipped a hardcoded
`PROGRAM_LABELS` table inside `src/routes/screen.$jurisdictionId.tsx`. The
labels are correct today but will drift the moment a program is renamed
upstream — and the entire reason ConfigValue exists is to avoid that
class of drift.

This spec wires the live fetch with a graceful fallback to the existing
hardcoded table for preview-mode parity (no flicker, no broken page when
the API isn't reachable).

Ship after [govops-015b](govops-015b-screen-privacy-fix.md) (the privacy
regression takes priority).

## Acceptance criteria

- [ ] `src/routes/screen.$jurisdictionId.tsx` uses TanStack's route `loader` to call `fetchJurisdiction(jurisdictionId)` from `src/lib/api.ts` (the function already exists in the artefact — wire it through).
- [ ] The loader returns `{ program_name, jurisdiction_label, lede }` (or whatever shape `fetchJurisdiction` returns; use the live values directly).
- [ ] The route component reads from `Route.useLoaderData()` for the program name + lede.
- [ ] On loader success: program name + lede render from the live response.
- [ ] On loader failure (network error, 404, timeout): fall back to the existing `PROGRAM_LABELS` table for preview-mode parity. Render a small `screen.preview_mode` badge as is already done elsewhere in the artefact.
- [ ] If the backend `/api/jurisdiction/{code}` does not yet expose a `program_name` field separate from the jurisdiction label, that's a backend follow-up — for now the loader can derive program name from the jurisdiction pack's `program_name` (already available — see [govops-014's `_jurisdiction_label` helper](../src/govops/api.py)). Either way the route never reads `PROGRAM_LABELS` first; it's the fallback only.
- [ ] Loader uses TanStack's standard error handling: a thrown error in the loader yields a route-level error boundary; the component itself only renders happy-path or fallback shapes.
- [ ] Preview/mock mode (`VITE_USE_MOCK_API=true`) returns a deterministic mock from `mock-jurisdiction.ts` (create if it doesn't exist) so the page works without a backend.
- [ ] Loading state: the form skeleton renders while the loader is pending — no FOUC of empty strings, no jumpy layout.
- [ ] No regression to a11y, validation, privacy invariants, or the disclaimer card.

## Files to create / modify

```
src/routes/screen.$jurisdictionId.tsx          (modify — add loader, replace PROGRAM_LABELS reads with loader data)
src/lib/api.ts                                 (verify — fetchJurisdiction exists; if not, add)
src/lib/mock-jurisdiction.ts                   (new if absent — mock fallback fixture for preview mode)
src/lib/types.ts                               (modify if needed — Jurisdiction response type)
```

The `PROGRAM_LABELS` constant is **kept** as the network-fallback table, not
deleted. Add a JSDoc above it noting the role.

## Tokens / data

Backend contract — confirm against current `GET /api/jurisdiction/{code}` shape:

```ts
// src/lib/types.ts — verify or add
export interface JurisdictionResponse {
  id: string;                  // e.g. "ca", "br", "es", "fr", "de", "ua"
  jurisdiction_label: string;  // e.g. "Government of Canada"
  program_name: string;        // e.g. "Old Age Security (OAS)"
  default_language: string;    // e.g. "en"
}

// src/lib/api.ts — should already exist; verify signature
export async function fetchJurisdiction(code: string): Promise<JurisdictionResponse> { ... }
```

If the backend response shape is different, adapt the type to what's
actually returned and add a TODO note for backend alignment.

## Reference implementation

```tsx
// src/routes/screen.$jurisdictionId.tsx — desired shape
import { createFileRoute, notFound } from "@tanstack/react-router";
import { fetchJurisdiction } from "@/lib/api";
import type { JurisdictionResponse } from "@/lib/types";

const SUPPORTED = ["ca", "br", "es", "fr", "de", "ua"] as const;
type SupportedCode = (typeof SUPPORTED)[number];

/**
 * Network-failure fallback. Kept in sync with the live response, used only
 * when the loader cannot reach the backend (preview mode, offline, 5xx).
 */
const PROGRAM_LABELS: Record<SupportedCode, { program_name: string; jurisdiction_label: string }> = {
  ca: { program_name: "Old Age Security (OAS)", jurisdiction_label: "Government of Canada" },
  br: { program_name: "Aposentadoria por Idade (INSS)", jurisdiction_label: "República Federativa do Brasil" },
  es: { program_name: "Pensión de jubilación", jurisdiction_label: "Reino de España" },
  fr: { program_name: "Retraite de base (CNAV)", jurisdiction_label: "République française" },
  de: { program_name: "Regelaltersrente (DRV)", jurisdiction_label: "Bundesrepublik Deutschland" },
  ua: { program_name: "Пенсія за віком", jurisdiction_label: "Україна" },
};

export const Route = createFileRoute("/screen/$jurisdictionId")({
  loader: async ({ params }) => {
    const code = params.jurisdictionId;
    if (!SUPPORTED.includes(code as SupportedCode)) {
      throw notFound();
    }
    try {
      return { live: true as const, data: await fetchJurisdiction(code) };
    } catch {
      return { live: false as const, data: PROGRAM_LABELS[code as SupportedCode] };
    }
  },
  pendingComponent: ScreenFormSkeleton,
  component: ScreenFormPage,
});

function ScreenFormPage() {
  const { live, data } = Route.useLoaderData();
  return (
    <ScreenShell showBack>
      {!live && <PreviewModeBadge />}
      <ScreenHeader programName={data.program_name} jurisdictionLabel={data.jurisdiction_label} />
      <ScreenForm jurisdictionId={Route.useParams().jurisdictionId} />
    </ScreenShell>
  );
}
```

## i18n

```yaml
locales_required: []         # no new copy keys; PROGRAM_LABELS stays in source
rtl_mirroring: not_applicable
copy_keys: []
```

The fallback table values are technically copy, but they mirror what the
backend already serves and are not user-translatable through ICU — they
are jurisdiction-program names, which are authoritative in their source
language and not translated.

## a11y

```yaml
contrast: AA                  # preserved
focus_visible: required       # preserved
keyboard: preserved
aria_live: not_applicable     # loader transitions are atomic; pendingComponent renders as needed
reduced_motion: respect
loading_state:
  - "ScreenFormSkeleton renders while the loader is pending — no jumpy layout"
  - "Skeleton respects prefers-reduced-motion (no shimmer when set)"
```

provenance: hybrid

## Out of scope

- Adding new fields to `JurisdictionResponse` (e.g. application URL, contact info) — that's a backend change tracked separately
- Caching the loader response across navigations beyond TanStack's default
- Backporting this loader pattern to other routes (`/cases`, `/authority`, `/encode`) — track separately as small UI hygiene
- Removing the privacy regression — that's [govops-015b](govops-015b-screen-privacy-fix.md), priority P0
- Translating the program names (they stay in their authoritative source language)
