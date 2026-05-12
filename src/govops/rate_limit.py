"""Per-IP rate limit middleware for the v2.1 hosted demo.

Two limits stacked:
  - per-minute: 5 req/min/IP   (env: RATE_LIMIT_PER_MINUTE, default 5)
  - per-day:   100 req/day/IP  (env: RATE_LIMIT_PER_DAY, default 100)

Only `/api/llm/chat` is rate-limited by default (the LLM proxy is the
expensive surface; everything else is free SQLite reads). Override the
guarded routes via `RATE_LIMITED_PATHS` env (comma-separated path prefixes).

In-process token bucket — no Redis, no external state. Acceptable for a
single-container HF Spaces deploy. When the container restarts, counters
reset; that's fine for a "best-effort abuse fence" on a free-tier demo.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


# ---------------------------------------------------------------------------
# Token bucket — sliding window with deque of timestamps per IP
# ---------------------------------------------------------------------------


class _SlidingWindowLimiter:
    """Allow N requests per window_seconds, enforced as a sliding window."""

    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> tuple[bool, int]:
        """Record a hit for `key`. Returns (allowed, remaining)."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                return False, 0
            bucket.append(now)
            return True, self.max_requests - len(bucket)


def _client_ip(request: Request) -> str:
    # Prefer X-Forwarded-For when behind a proxy (HF Spaces sets it).
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ---------------------------------------------------------------------------
# FastAPI middleware
# ---------------------------------------------------------------------------


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply per-IP minute + day limits to selected path prefixes.

    Activates only when at least one of the two limits is set via env. To
    enable in tests: set `RATE_LIMIT_PER_MINUTE=5` etc. before import.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.per_minute = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "5"))
        self.per_day = int(os.environ.get("RATE_LIMIT_PER_DAY", "100"))
        # Default guarded paths: only the LLM proxy (the actual cost surface)
        guarded_raw = os.environ.get("RATE_LIMITED_PATHS", "/api/llm/chat")
        self.guarded_prefixes: tuple[str, ...] = tuple(
            p.strip() for p in guarded_raw.split(",") if p.strip()
        )
        self._minute = _SlidingWindowLimiter(self.per_minute, 60.0)
        self._day = _SlidingWindowLimiter(self.per_day, 86400.0)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[JSONResponse]],
    ):
        path = request.url.path
        if not path.startswith(self.guarded_prefixes):
            return await call_next(request)

        ip = _client_ip(request)

        ok_min, remaining_min = self._minute.hit(ip)
        if not ok_min:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "rate limit exceeded (per-minute)",
                    "limit_per_minute": self.per_minute,
                    "retry_after_seconds": 60,
                },
                headers={"Retry-After": "60"},
            )

        ok_day, remaining_day = self._day.hit(ip)
        if not ok_day:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "rate limit exceeded (per-day)",
                    "limit_per_day": self.per_day,
                    "retry_after_seconds": 86400,
                },
                headers={"Retry-After": "86400"},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining-Minute"] = str(remaining_min)
        response.headers["X-RateLimit-Remaining-Day"] = str(remaining_day)
        return response
