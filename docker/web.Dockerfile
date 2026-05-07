# GovOps v3 — `docker compose` web image (vite dev on :8080).
#
# Sister to docker/api.Dockerfile. Runs the TanStack Start UI in dev mode
# so a contributor's host-side edits to web/src/ hot-reload inside the
# container. vite's `server.proxy` config forwards `/api/*` to the
# `api` service via the compose-internal DNS name (set via
# VITE_API_BASE_URL=http://api:8000 — see docker-compose.yml).

FROM node:20-bookworm-slim AS runtime

WORKDIR /app/web

# Dependency manifests first for layer cache.
COPY web/package.json web/package-lock.json* web/bun.lockb* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Source after deps — typical edits are source-only and don't blow the cache.
COPY web/ ./

EXPOSE 8080

# `--host 0.0.0.0` so the host can reach :8080 from outside the container.
# `--port 8080` to match the local-dev port the README documents.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]
