"""Tests for the v2.1 per-IP rate-limit middleware.

The middleware reads its limits from env at construction time, so each
test resets the env and rebuilds the FastAPI app to get a fresh limiter
state.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from govops.rate_limit import RateLimitMiddleware


def _build(app_path: str = "/api/llm/chat", per_minute: int = 3, per_day: int = 5):
    """Build a tiny app guarded by the rate-limit middleware."""
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.get(app_path)
    def guarded():
        return {"ok": True}

    @app.get("/api/free")
    def free():
        return {"ok": True}

    return app


@pytest.fixture(autouse=True)
def _set_low_limits(monkeypatch):
    """Use small limits so tests can exhaust them in a few requests."""
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "3")
    monkeypatch.setenv("RATE_LIMIT_PER_DAY", "5")
    monkeypatch.setenv("RATE_LIMITED_PATHS", "/api/llm/chat")


def test_unguarded_path_unaffected():
    client = TestClient(_build())
    for _ in range(20):
        r = client.get("/api/free")
        assert r.status_code == 200


def test_guarded_path_succeeds_within_limit():
    client = TestClient(_build())
    for _ in range(3):
        r = client.get("/api/llm/chat")
        assert r.status_code == 200
    # 4th request blocks (per-minute = 3)
    r = client.get("/api/llm/chat")
    assert r.status_code == 429
    body = r.json()
    assert body["detail"].startswith("rate limit exceeded")
    assert r.headers.get("Retry-After") == "60"


def test_remaining_headers_decrement():
    client = TestClient(_build())
    r1 = client.get("/api/llm/chat")
    r2 = client.get("/api/llm/chat")
    assert int(r1.headers["X-RateLimit-Remaining-Minute"]) == 2
    assert int(r2.headers["X-RateLimit-Remaining-Minute"]) == 1


def test_separate_ips_have_separate_buckets():
    client = TestClient(_build())
    # Exhaust IP A
    for _ in range(3):
        client.get("/api/llm/chat", headers={"x-forwarded-for": "1.1.1.1"})
    blocked = client.get("/api/llm/chat", headers={"x-forwarded-for": "1.1.1.1"})
    assert blocked.status_code == 429
    # IP B is fresh
    fresh = client.get("/api/llm/chat", headers={"x-forwarded-for": "2.2.2.2"})
    assert fresh.status_code == 200
