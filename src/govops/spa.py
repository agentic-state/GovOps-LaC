"""Mount the built SPA on the FastAPI app for the v2.1 hosted demo.

Production architecture: ONE process. uvicorn serves the JSON API at
`/api/*` (existing routes), the docs at `/docs`/`/redoc`/`/openapi.json`,
and the static SPA at everything else — falling back to `index.html` for
SPA-routed paths so TanStack Router handles client-side routing.

Build is a multi-stage Dockerfile concern; this module just plugs the
already-built `dist/client/` directory into FastAPI when it exists. When
the directory is missing (e.g., local dev where contributors run
`vite dev` on a separate port per CONTRIBUTING.md), this module is a
no-op and the FastAPI app is unchanged.

The dist path is configurable via `GOVOPS_SPA_DIST` for portability;
the default `/app/web/dist/client` matches the Dockerfile layout.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_spa(app: FastAPI, dist_path: str | None = None) -> bool:
    """Mount static SPA assets + index.html fallback on `app`.

    Returns True if the SPA was mounted (dist exists), False if no-op
    (local dev / dist missing). Idempotent-safe to call multiple times
    against different paths during testing.
    """
    base = Path(dist_path or os.environ.get("GOVOPS_SPA_DIST", "/app/web/dist/client"))
    if not base.is_dir():
        return False

    index = base / "index.html"
    if not index.is_file():
        return False

    # Evict the legacy Jinja UI routes that `govops.api` registers at "/",
    # "/cases", "/authority", "/encode", "/admin", "/mvp". They're useful
    # as a no-Node-toolchain fallback in local dev (CONTRIBUTING.md), but
    # in the hosted demo we serve the SPA from those paths instead. Keep
    # everything matching the API surface (`/api/*`), the docs surfaces
    # (`/docs`, `/redoc`, `/openapi.json`), and the existing `/static`
    # mount used for Jinja's stylesheet (harmless if unused).
    api_keep_exact = {"/openapi.json", "/docs", "/redoc"}
    api_keep_prefixes = ("/api/", "/static")
    kept = []
    for route in app.router.routes:
        path = getattr(route, "path", "") or ""
        if path in api_keep_exact or any(path.startswith(p) for p in api_keep_prefixes):
            kept.append(route)
    app.router.routes = kept

    assets = base / "assets"
    if assets.is_dir():
        # Mount takes precedence over the catch-all GET below — Starlette
        # tries mounts before route patterns, so /assets/* hits the static
        # handler regardless of the fallback's `/{spa_path:path}` shape.
        app.mount(
            "/assets",
            StaticFiles(directory=str(assets)),
            name="spa-assets",
        )

    # Catch-all SPA fallback. Registered LAST, after every existing
    # /api/*, /docs, /redoc, /openapi.json route — FastAPI's router
    # tries routes in registration order, so prior routes take
    # precedence and only paths that don't match anything else hit
    # this fallback.
    @app.get("/{spa_path:path}", include_in_schema=False)
    async def _spa_fallback(spa_path: str):
        # Defensive: if a literal /api or /docs path somehow reached
        # here (route registration order broken), 404 instead of
        # serving the SPA shell. Never return HTML to an API caller.
        if spa_path.startswith("api/") or spa_path in {
            "docs",
            "redoc",
            "openapi.json",
        }:
            raise HTTPException(status_code=404)
        # Specific files in dist/ root (favicon, brand assets, robots.txt).
        target = base / spa_path
        if target.is_file():
            return FileResponse(str(target))
        # Otherwise serve the SPA shell — TanStack Router handles routing.
        return FileResponse(str(index))

    return True
