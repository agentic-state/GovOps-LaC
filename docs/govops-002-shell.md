# GovOps Spec — App shell, theming, i18n scaffolding
<!-- type: layout, priority: p0, depends_on: [govops-001] -->
type: layout
priority: p0
depends_on: [govops-001]
spec_id: govops-002

## Intent

Stand up the GovOps web frontend scaffold so all subsequent feature specs (`govops-003+`) drop straight in. Ship the runtime chrome only: routing, design-token consumption, light/dark theming, language switcher with one RTL locale wired, masthead with the `Gov0ps` wordmark, and a reusable `ProvenanceRibbon` primitive. **No business UI in this spec** — just the substrate that proves tokens, theming, RTL, and TanStack routing all work end-to-end against an empty home route.

## Acceptance criteria

- [ ] `npm run dev` boots a Vite + React + TypeScript app on `http://localhost:5173`
- [ ] TanStack Router renders `/` (home) and `/about` (placeholder) — both flat-dot route files
- [ ] `src/styles.css` consumes the OKLCH token set from `govops-001` (see "Tokens / data" below) via Tailwind v4 `@theme inline`
- [ ] Light/dark toggle in masthead persists to `localStorage["govops-theme"]` and respects `prefers-color-scheme` on first visit
- [ ] Language switcher in masthead toggles between `en` / `fr` / `ar`; `ar` flips `<html dir="rtl">` and the layout mirrors via CSS logical properties
- [ ] `Gov0ps` wordmark (text rendering — see "Reference implementation") appears in masthead, scales with viewport, never breaks across lines
- [ ] `<ProvenanceRibbon variant="agent|human|hybrid|system|citizen|none">` component renders 3px inline-start ribbon, correct color per variant, ARIA label from i18n
- [ ] Skip-to-content link is the first focusable element on every page
- [ ] All masthead controls reachable by keyboard; focus ring uses `--ring-focus` (3px lavender, 2px offset)
- [ ] `prefers-reduced-motion` honored (no transforms, opacity-only crossfades)
- [ ] Lighthouse a11y score ≥ 95 on `/`
- [ ] Backend wiring: a single `src/lib/api.ts` exports a `fetcher(path)` that prepends `import.meta.env.VITE_API_BASE_URL` (default `http://127.0.0.1:8000`). **No Supabase client, no Supabase env vars, no auth scaffolding.**

## Files to create / modify

```
package.json                                 (new)
vite.config.ts                               (new)
tsconfig.json                                (new)
index.html                                   (new — sets <html lang> dynamically)
src/main.tsx                                 (new)
src/styles.css                               (new — full token system)
src/router.tsx                               (new — TanStack Router setup)
src/routes/__root.tsx                        (new — shell layout: masthead + main + footer)
src/routes/index.tsx                         (new — empty home, only the words "GovOps")
src/routes/about.tsx                         (new — placeholder)
src/components/govops/Masthead.tsx           (new)
src/components/govops/Wordmark.tsx           (new — text wordmark, "Gov0ps")
src/components/govops/ProvenanceRibbon.tsx   (new)
src/components/govops/ThemeToggle.tsx        (new)
src/components/govops/LanguageSwitcher.tsx   (new)
src/components/govops/SkipToContent.tsx      (new)
src/lib/api.ts                               (new — fetch wrapper, no Supabase)
src/lib/theme.ts                             (new — light/dark with localStorage)
src/lib/i18n.ts                              (new — react-intl provider, ICU)
src/messages/en.json                         (new)
src/messages/fr.json                         (new)
src/messages/ar.json                         (new)
public/govops-wordmark.png                   (copy from /mnt/documents/govops-wordmark.png)
public/govops-symbol.png                     (copy from /mnt/documents/govops-symbol.png)
```

Do NOT create: `src/pages/`, any nested route directories, `routeTree.gen.ts` (TanStack autogenerates), Supabase client files, auth pages.

## Tokens / data

Drop the full token set into `src/styles.css`. Below is the canonical shape — copy verbatim, adjusting only if a value contradicts `govops-001` (in which case `govops-001` wins).

```css
@import "tailwindcss";

:root {
  /* primitives — ink */
  --ink-50:  oklch(0.985 0.005 265);
  --ink-100: oklch(0.96 0.008 265);
  --ink-200: oklch(0.90 0.012 265);
  --ink-300: oklch(0.78 0.015 265);
  --ink-400: oklch(0.62 0.020 265);
  --ink-500: oklch(0.48 0.025 265);
  --ink-600: oklch(0.36 0.028 265);
  --ink-700: oklch(0.27 0.030 265);
  --ink-800: oklch(0.22 0.030 265);
  --ink-900: oklch(0.18 0.030 265);
  --ink-950: oklch(0.13 0.025 265);

  /* primitives — parchment */
  --parchment-50:  oklch(0.992 0.005 90);
  --parchment-100: oklch(0.985 0.008 90);
  --parchment-200: oklch(0.965 0.012 88);
  --parchment-300: oklch(0.93 0.018 85);

  /* primitives — lavender (agentic) */
  --lavender-100: oklch(0.96 0.025 290);
  --lavender-200: oklch(0.90 0.055 290);
  --lavender-400: oklch(0.78 0.110 290);
  --lavender-500: oklch(0.72 0.130 290);
  --lavender-600: oklch(0.62 0.140 290);
  --lavender-700: oklch(0.50 0.130 290);

  /* primitives — civic-gold (authority) */
  --civic-gold-100: oklch(0.96 0.030 80);
  --civic-gold-200: oklch(0.90 0.070 80);
  --civic-gold-400: oklch(0.82 0.130 78);
  --civic-gold-500: oklch(0.75 0.140 75);
  --civic-gold-600: oklch(0.62 0.130 72);
  --civic-gold-700: oklch(0.48 0.110 70);

  /* verdict statuses */
  --verdict-enacted:  oklch(0.62 0.115 155);
  --verdict-pending:  oklch(0.72 0.130 75);
  --verdict-rejected: oklch(0.55 0.180 28);
  --verdict-draft:    oklch(0.62 0.020 265);

  /* semantic — light (default) */
  --background:           var(--parchment-50);
  --surface:              var(--parchment-100);
  --surface-raised:       var(--ink-50);
  --surface-sunken:       var(--parchment-200);
  --foreground:           var(--ink-900);
  --foreground-muted:     var(--ink-500);
  --foreground-subtle:    var(--ink-400);
  --border:               var(--ink-200);
  --border-strong:        var(--ink-300);
  --primary:              var(--ink-900);
  --primary-foreground:   var(--parchment-50);
  --agentic:              var(--lavender-500);
  --agentic-soft:         var(--lavender-100);
  --agentic-foreground:   var(--lavender-700);
  --authority:            var(--civic-gold-500);
  --authority-soft:       var(--civic-gold-100);
  --authority-foreground: var(--civic-gold-700);
  --ring:                 var(--lavender-400);
  --ring-focus:           0 0 0 3px oklch(0.72 0.13 290 / 0.40);

  /* radii, space, motion */
  --radius-sm:  0.25rem;
  --radius-md:  0.375rem;
  --radius-lg:  0.5rem;
  --radius-xl:  0.75rem;

  --duration-instant:    80ms;
  --duration-fast:       160ms;
  --duration-base:       240ms;
  --duration-slow:       400ms;
  --duration-deliberate: 640ms;

  --ease-standard:   cubic-bezier(0.2, 0.0, 0.0, 1.0);
  --ease-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-civic:      cubic-bezier(0.65, 0.0, 0.35, 1.0);
}

.dark {
  --background:           var(--ink-950);
  --surface:              var(--ink-900);
  --surface-raised:       var(--ink-800);
  --surface-sunken:       var(--ink-950);
  --foreground:           var(--parchment-100);
  --foreground-muted:     var(--ink-300);
  --foreground-subtle:    var(--ink-400);
  --border:               var(--ink-700);
  --border-strong:        var(--ink-600);
  --primary:              var(--parchment-100);
  --primary-foreground:   var(--ink-950);
  --agentic:              var(--lavender-400);
  --agentic-soft:         var(--ink-800);
  --agentic-foreground:   var(--lavender-200);
  --authority:            var(--civic-gold-400);
  --authority-soft:       var(--ink-800);
  --authority-foreground: var(--civic-gold-200);
  --ring:                 var(--lavender-400);
}

@theme inline {
  --color-background:           var(--background);
  --color-surface:              var(--surface);
  --color-surface-raised:       var(--surface-raised);
  --color-surface-sunken:       var(--surface-sunken);
  --color-foreground:           var(--foreground);
  --color-foreground-muted:     var(--foreground-muted);
  --color-foreground-subtle:    var(--foreground-subtle);
  --color-border:               var(--border);
  --color-border-strong:        var(--border-strong);
  --color-primary:              var(--primary);
  --color-primary-foreground:   var(--primary-foreground);
  --color-agentic:              var(--agentic);
  --color-agentic-soft:         var(--agentic-soft);
  --color-agentic-foreground:   var(--agentic-foreground);
  --color-authority:            var(--authority);
  --color-authority-soft:       var(--authority-soft);
  --color-authority-foreground: var(--authority-foreground);
  --color-ring:                 var(--ring);
  --color-verdict-enacted:      var(--verdict-enacted);
  --color-verdict-pending:      var(--verdict-pending);
  --color-verdict-rejected:     var(--verdict-rejected);
  --color-verdict-draft:        var(--verdict-draft);

  --font-serif: "Newsreader", "Spectral", "Source Serif 4", Georgia, serif;
  --font-sans:  "Inter Variable", "Inter", "IBM Plex Sans", system-ui, sans-serif;
  --font-mono:  "JetBrains Mono Variable", "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: var(--duration-fast) !important;
    animation-iteration-count: 1 !important;
    transition-duration: var(--duration-fast) !important;
    transform: none !important;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

## Reference implementation

```tsx
// src/components/govops/Wordmark.tsx
// Text-rendered wordmark: "Gov0ps" with O-as-zero baked in.
// Use the PNG only for og:image / favicons; the live UI uses text for crispness + RTL.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontFamily: "var(--font-serif)", fontWeight: 600, letterSpacing: "-0.01em" }}
      aria-label="GovOps"
    >
      Gov0ps
    </span>
  );
}
```

```tsx
// src/components/govops/ProvenanceRibbon.tsx
import { useIntl } from "react-intl";

type Variant = "agent" | "human" | "hybrid" | "system" | "citizen" | "none";

const styles: Record<Variant, string> = {
  agent:   "bg-agentic",
  human:   "bg-authority",
  hybrid:  "bg-[linear-gradient(to_bottom,var(--agentic)_50%,var(--authority)_50%)]",
  system:  "bg-foreground-muted",
  citizen: "bg-verdict-enacted",
  none:    "bg-transparent",
};

export function ProvenanceRibbon({ variant }: { variant: Variant }) {
  const intl = useIntl();
  if (variant === "none") return null;
  return (
    <span
      role="img"
      aria-label={intl.formatMessage({ id: `provenance.${variant}` })}
      className={`block w-[3px] ${styles[variant]} self-stretch`}
      style={{ marginInlineEnd: "var(--space-3, 0.75rem)" }}
    />
  );
}
```

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Masthead } from "@/components/govops/Masthead";
import { SkipToContent } from "@/components/govops/SkipToContent";

export const Route = createRootRoute({
  component: () => (
    <>
      <SkipToContent />
      <Masthead />
      <main id="main" className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </>
  ),
});
```

## i18n

```yaml
locales_required: [en, fr, ar]
rtl_mirroring: auto
fallback_locale: en
library: react-intl   # ICU MessageFormat compliant
copy_keys:
  - app.name                    # "GovOps"
  - app.tagline                 # "Law as code, with provenance you can read."
  - nav.home
  - nav.about
  - nav.skip_to_content
  - theme.toggle.label          # "Toggle theme"
  - theme.light
  - theme.dark
  - lang.switcher.label         # "Language"
  - lang.en                     # "English"
  - lang.fr                     # "Français"
  - lang.ar                     # "العربية"
  - provenance.agent            # "Drafted by an agent"
  - provenance.human            # "Enacted by a human authority"
  - provenance.hybrid           # "Co-authored: agent draft, human ratification"
  - provenance.system           # "System-generated"
  - provenance.citizen          # "Citizen contribution"
```

When locale is `ar`, set `<html dir="rtl" lang="ar">`. All masthead spacing uses `padding-inline-*` / `margin-inline-*` / `inset-inline-*`. Numerals stay Latin in `ar` for v1 (document the choice; revisit later).

## a11y

```yaml
contrast: AA                    # AAA on body text where feasible
focus_visible: required          # use --ring-focus shadow, never outline:none without replacement
keyboard:
  - Tab / Shift+Tab through masthead, theme toggle, lang switcher, skip-link, main, footer
  - Enter activates buttons and links
  - Esc closes the language menu when open
aria_live: not_required          # shell has no streaming regions yet
reduced_motion: respect          # see styles.css @media block
color_independence: required     # provenance ribbon always pairs color + ARIA label
landmarks:
  - <header role="banner"> for masthead
  - <main id="main"> for content
  - <footer role="contentinfo"> for footer
skip_link: required              # first focusable element, jumps to #main
```

provenance: none

## Out of scope

- ConfigValue search / timeline / diff UI (deferred to `govops-003+`)
- Authentication, RBAC, login pages
- Supabase wiring of any kind (backend is FastAPI; see `src/lib/api.ts`)
- Real backend calls — the home route renders only static i18n strings
- shadcn/ui component library setup beyond what the masthead needs (defer Card, Dialog, etc. to feature specs)
- Storybook / component playground
- E2E tests (unit/component tests welcome but not required)
- Persisting language choice to backend (localStorage only for now)
- Numeral localization (Arabic-Indic) — stays Latin in `ar` v1
