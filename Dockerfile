# GovOps v2.1 — single-container hosted demo image (HF Spaces / generic Docker)
#
# ONE process: uvicorn serves both the JSON API at /api/* and the static SPA
# (built once from web/, served via FastAPI StaticFiles + an /{spa_path:path}
# fallback to index.html so TanStack Router handles client-side routing).
#
# Multi-stage:
#   Stage 1 (web-builder)  Node image. npm ci + vite build → dist/client/.
#                          Skips the prebuild i18n validators (CI-only quality
#                          gates) and runs only what the build itself needs.
#   Stage 2 (runtime)      Python image. Copies dist/client/ from stage 1.
#                          No Node, no npm, no supervisor at runtime.
#
# Earlier v2.1 builds ran `vite dev` as the public-facing process. That fell
# over on HF Spaces' free tier because vite dev is a development server with
# no GC for its module graph or watcher (vite #6815, #8341, #21473), and the
# 253-request cold load of the SPA crashed the dev server within ~20-30s.
# This Dockerfile replaces that path entirely with a real production build.
# Original pivot rationale (Cloudflare Workers bundle, etc.) is no longer
# load-bearing now that we pass `cloudflare: false` and `tanstackStart.spa`
# to the Lovable preset in web/vite.config.ts.
#
# Required env vars (set as HF Space secrets — see DEPLOY.md):
#   DEMO_ADMIN_TOKEN=...                 (any random string)
#   GROQ_API_KEY=...                     (at least one provider required)
#   OPENROUTER_API_KEY=...               (recommended — fail-over)
#   GEMINI_API_KEY=...                   (optional — fail-over)
#   MISTRAL_API_KEY=...                  (optional — fail-over)
# Vars BAKED INTO the image (do NOT add as Space secrets — collision):
#   GOVOPS_DEMO_MODE=1, GOVOPS_SEED_DEMO=1, GOVOPS_DB_PATH=/data/govops.db,
#   GOVOPS_SPA_DIST=/app/web/dist/client, PORT=7860,
#   LLM_PROVIDERS=groq,openrouter,gemini,mistral

# ============================================================================
# Stage 1: Build the SPA
# ============================================================================
FROM node:20-bookworm-slim AS web-builder

WORKDIR /build/web

# Lockfile-first for layer cache
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Then the rest of the source
COPY web/ ./

# Run only the load-bearing prebuild step (route-tree generator). Skip the
# i18n validators — they're CI quality gates and can fail on translation
# debt without affecting whether the build itself produces a valid artifact.
#
# VITE_API_BASE_URL="" is load-bearing: vite inlines this env var AT BUILD
# TIME into the client bundle. Without it the bundle bakes in the api.ts
# fallback http://127.0.0.1:8000 — which from a visitor's browser hits
# THEIR localhost, not the HF container. Result: every API fetch from
# the browser fails with "Failed to fetch".
#
# The original v2.1 fix (commit fc19f64) set this env var on the supervisor
# script that ran `npm run dev`. When the Dockerfile pivoted from vite-dev
# at runtime to vite-build at build time (commit 35fb187), the env var
# didn't follow into the build RUN. Re-applied here.
#
# Empty string = browser uses same-origin relative URLs (/api/...). Those
# hit the FastAPI process inside the same uvicorn container directly.
RUN VITE_API_BASE_URL="" node scripts/clean-route-tree.mjs \
 && VITE_API_BASE_URL="" npx vite build \
 && node scripts/check-route-tree-duplicates.mjs \
 && node scripts/check-bundle-no-localhost.mjs

# ============================================================================
# Stage 2: Python runtime — single uvicorn process
# ============================================================================
FROM python:3.12-slim-bookworm AS runtime

# curl for healthchecks. No Node, no npm in the runtime image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps first — pyproject + src for layer cache
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir -e .

# Static lawcode YAML + schemas the runtime reads
COPY lawcode/ ./lawcode/
COPY schema/ ./schema/

# Built SPA from stage 1 (client bundles only — dist/server/ is the unused
# Workers output and isn't loaded at runtime). 3-4 MB total.
COPY --from=web-builder /build/web/dist/client/ /app/web/dist/client/

# HF Spaces persistent disk path (paid Spaces only; free Spaces re-hydrate
# from lawcode/ on cold boot per ADR-010).
RUN mkdir -p /data
ENV GOVOPS_DB_PATH=/data/govops.db
ENV GOVOPS_DEMO_MODE=1
ENV GOVOPS_SEED_DEMO=1
# Tell `govops.spa.mount_spa()` where the built SPA lives.
ENV GOVOPS_SPA_DIST=/app/web/dist/client
# HF Spaces requires the public process to listen on 0.0.0.0:7860.
ENV PORT=7860
EXPOSE 7860

# `govops.spa_app:app` = `govops.api:app` with the SPA mounted on top.
# `--access-log` so request lines surface in HF container logs.
CMD ["uvicorn", "govops.spa_app:app", "--host", "0.0.0.0", "--port", "7860", "--log-level", "info", "--access-log"]
