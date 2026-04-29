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
export default defineConfig({
  vite: {
    server: {
      allowedHosts: [
        "agentic-state-govops-lac.hf.space",
        ".hf.space", // future-proof for any HF Space URL pattern
      ],
    },
  },
});
