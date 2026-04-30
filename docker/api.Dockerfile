# GovOps v3 — `docker compose` API image (FastAPI on :8000).
#
# Companion to docker-compose.yml at the repo root. Distinct from the
# top-level `Dockerfile` (which is the v2.1 single-container HF Space
# image with vite + uvicorn supervised by a shell wrapper). This image
# does ONE thing: run uvicorn against `govops.api:app`. The web service
# is a separate container — see `docker/web.Dockerfile`.
#
# Why split: v3's "Add your country in 5 minutes" adoption story (PLAN-v3
# §Phase H) wants two-process docker-compose so a contributor can edit
# `lawcode/<jur>/` on the host and the API picks up changes without a
# rebuild. The v2.1 image is for the hosted demo; v3's compose is for
# the local-dev / contributor flow.

FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

# Python deps first for layer cache. README.md is referenced from
# pyproject.toml's [project.readme] so it must be present at install time.
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir -e .

# Static substrate the runtime reads. The compose file mounts ./lawcode
# over this path so host edits show up live; the COPY here is the cold-boot
# fallback for when the volume isn't bound (e.g. `docker run` of this
# image standalone).
COPY lawcode/ ./lawcode/
COPY schema/ ./schema/

# In-memory SQLite by default (per ADR-010). Set GOVOPS_DB_PATH to a
# bind-mounted file if you want substrate edits to survive container restarts.
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "govops.api:app", "--host", "0.0.0.0", "--port", "8000"]
