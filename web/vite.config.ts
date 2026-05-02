// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `allowedHosts` opens the dev server to non-localhost callers — required when
// the dev server is the public-facing process inside the v2.1 hosted-demo
// container (Dockerfile runs `npm run dev -- --host 0.0.0.0`). Without this,
// vite refuses requests with a Host header that doesn't match its known list
// and returns 403 to anyone hitting the HF Space URL. Local dev is unaffected
// (localhost is always allowed).
//
// `cloudflare: false` skips the @cloudflare/vite-plugin so `vite build` does
// NOT emit a Workers bundle (which the v2.1 demo can't run). Combined with
// `tanstackStart.spa.enabled: true` and `prerender.enabled: true`, the build
// produces a static SPA in `dist/client/` (including a real `index.html`
// rendered once at build time, then hydrated client-side). FastAPI serves
// that directory directly — no vite at runtime, no Node at runtime, no
// supervisor. The hosted demo runs as one uvicorn process.
//
// Dev-server flags (HMR, watcher) are kept untouched: local dev still does
// `vite dev` with HMR on. Only the production build path changes.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    spa: {
      enabled: true,
      // outputPath: "/index" makes TanStack Start write the SPA shell at
      // dist/client/index.html (it appends ".html" for the SPA shell case;
      // see start-plugin-core/vite/prerender.js → `isSpaShell` branch).
      prerender: { enabled: true, outputPath: "/index" },
    },
  },
  vite: {
    server: {
      // `allowedHosts` is dev-only ergonomics; harmless in the build path.
      // Kept for any future case where someone wants `vite dev` reachable
      // from the HF Space subdomain (was load-bearing for the prior vite-dev
      // deploy; deliberately left in place so a contributor experimenting
      // with `npm run dev` doesn't trip over a 403).
      allowedHosts: [
        "agentic-state-govops-lac.hf.space",
        ".hf.space",
      ],
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
  },
});
