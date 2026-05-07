"""Tests for the v2.1 demo-mode middleware + admin token helper."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from govops.demo_mode import (
    DemoModeMiddleware,
    demo_admin_token,
    is_demo_mode,
)


def _app_with_demo_middleware() -> FastAPI:
    app = FastAPI()
    app.add_middleware(DemoModeMiddleware)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return app


def test_is_demo_mode_off_by_default(monkeypatch):
    monkeypatch.delenv("GOVOPS_DEMO_MODE", raising=False)
    assert is_demo_mode() is False


@pytest.mark.parametrize("val", ["1", "true", "True", "yes", "ON"])
def test_is_demo_mode_truthy(monkeypatch, val):
    monkeypatch.setenv("GOVOPS_DEMO_MODE", val)
    assert is_demo_mode() is True


@pytest.mark.parametrize("val", ["0", "false", "no", "off", ""])
def test_is_demo_mode_falsy(monkeypatch, val):
    monkeypatch.setenv("GOVOPS_DEMO_MODE", val)
    assert is_demo_mode() is False


def test_admin_token_returns_none_when_unset(monkeypatch):
    monkeypatch.delenv("DEMO_ADMIN_TOKEN", raising=False)
    assert demo_admin_token() is None


def test_admin_token_returns_value(monkeypatch):
    monkeypatch.setenv("DEMO_ADMIN_TOKEN", "secret-123")
    assert demo_admin_token() == "secret-123"


def test_middleware_no_headers_when_demo_off(monkeypatch):
    monkeypatch.delenv("GOVOPS_DEMO_MODE", raising=False)
    client = TestClient(_app_with_demo_middleware())
    r = client.get("/ping")
    assert r.status_code == 200
    assert "X-GovOps-Demo-Mode" not in r.headers
    assert "X-GovOps-Demo-Banner" not in r.headers


def test_middleware_emits_headers_when_demo_on(monkeypatch):
    monkeypatch.setenv("GOVOPS_DEMO_MODE", "1")
    client = TestClient(_app_with_demo_middleware())
    r = client.get("/ping")
    assert r.status_code == 200
    assert r.headers.get("X-GovOps-Demo-Mode") == "1"
    banner = r.headers.get("X-GovOps-Demo-Banner", "")
    assert "auto-expires after 7 days" in banner
    assert "github.com/agentic-state/GovOps-LaC" in banner
