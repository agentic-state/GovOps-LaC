"""Demo-mode middleware for the v2.1 hosted demo.

When `GOVOPS_DEMO_MODE=1` is set, the middleware does NOT block writes —
the P0 persistence model is "shared SQLite, daily age-based GC". User-
created artefacts persist for up to 7 days and are visible to other
visitors (transparent banner makes this clear). The middleware exists to
add a header (`X-GovOps-Demo-Mode: 1`) that the frontend reads to render
the persistent demo banner.

Two reasons we keep it as a middleware rather than a simple env-var read:
  1. Single source of truth for "is this a demo deploy?" — the same env
     variable controls the banner, the warning header, the GC scheduler's
     behaviour (more aggressive sweeps when on demo), and any future
     "demo-only" UX hooks
  2. The header is set unconditionally on every response, not derived
     client-side from build-time env, so a contributor running the same
     image locally with `GOVOPS_DEMO_MODE=0` gets a non-demo experience
     immediately
"""

from __future__ import annotations

import os
from typing import Awaitable, Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


def is_demo_mode() -> bool:
    """Return True if `GOVOPS_DEMO_MODE` is truthy."""
    return os.environ.get("GOVOPS_DEMO_MODE", "0").strip().lower() in {"1", "true", "yes", "on"}


def demo_admin_token() -> str | None:
    """Token required by `/api/admin/gc` and other demo-admin routes."""
    return os.environ.get("DEMO_ADMIN_TOKEN") or None


class DemoModeMiddleware(BaseHTTPMiddleware):
    """Add `X-GovOps-Demo-Mode` and `X-GovOps-Demo-Banner` headers when active."""

    # ASCII-only — HTTP headers are latin-1 encoded (RFC 7230); curly dashes
    # would crash the response. The frontend renders its own typographically-
    # correct version using i18n catalog text.
    BANNER_TEXT = (
        "Public demo on free tier - anything you do here is visible to other "
        "visitors and auto-expires after 7 days. Seeded data and the demo cases "
        "stay forever. Source: github.com/agentic-state/GovOps-LaC"
    )

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.active = is_demo_mode()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable],
    ):
        response = await call_next(request)
        if self.active:
            response.headers["X-GovOps-Demo-Mode"] = "1"
            # Compact banner text in a header is awkward; the frontend reads
            # `X-GovOps-Demo-Mode` and renders its own copy. Banner text is
            # exposed here for non-browser callers (curl, scripts) that want a
            # human-readable explanation.
            response.headers["X-GovOps-Demo-Banner"] = self.BANNER_TEXT
        return response
