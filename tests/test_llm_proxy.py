"""Tests for the v2.1 multi-provider LLM proxy.

The proxy is HTTP-call-heavy by nature; we mock httpx.AsyncClient.post so
the tests stay fast and deterministic. Coverage: provider-chain assembly,
fail-over on 429/5xx, exhaustion error, malformed-response handling.
"""

from __future__ import annotations

import pytest

from govops import llm_proxy


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Strip all provider env vars so each test starts from a known state."""
    for key in [
        "LLM_PROVIDERS",
        "GROQ_API_KEY",
        "GROQ_BASE_URL",
        "GROQ_MODEL",
        "OPENROUTER_API_KEY",
        "OPENROUTER_BASE_URL",
        "OPENROUTER_MODEL",
        "GEMINI_API_KEY",
        "GEMINI_BASE_URL",
        "GEMINI_MODEL",
        "MISTRAL_API_KEY",
        "MISTRAL_BASE_URL",
        "MISTRAL_MODEL",
    ]:
        monkeypatch.delenv(key, raising=False)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


def test_no_providers_configured_raises(monkeypatch):
    assert not llm_proxy.is_configured()
    assert llm_proxy.configured_providers() == []
    with pytest.raises(llm_proxy.LLMConfigError):
        llm_proxy._provider_chain()


def test_single_provider_configured(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key-groq")
    chain = llm_proxy._provider_chain()
    assert len(chain) == 1
    assert chain[0].name == "groq"
    assert chain[0].api_key == "test-key-groq"
    # Default base_url and model resolve from PROVIDER_DEFAULTS
    assert "groq.com" in chain[0].base_url
    assert chain[0].model  # truthy


def test_provider_order_follows_LLM_PROVIDERS(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k1")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k2")
    monkeypatch.setenv("LLM_PROVIDERS", "openrouter,groq")
    chain = llm_proxy._provider_chain()
    assert [p.name for p in chain] == ["openrouter", "groq"]


def test_unconfigured_providers_dropped(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k1")  # configured
    # openrouter NOT configured — should be dropped silently
    monkeypatch.setenv("LLM_PROVIDERS", "openrouter,groq,gemini")
    chain = llm_proxy._provider_chain()
    assert [p.name for p in chain] == ["groq"]


def test_env_overrides_default_base_url_and_model(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k")
    monkeypatch.setenv("GROQ_BASE_URL", "https://override.example.com/v1")
    monkeypatch.setenv("GROQ_MODEL", "custom-model")
    chain = llm_proxy._provider_chain()
    assert chain[0].base_url == "https://override.example.com/v1"
    assert chain[0].model == "custom-model"


# ---------------------------------------------------------------------------
# chat() with mocked httpx
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code: int, body=None, text: str = ""):
        self.status_code = status_code
        self._body = body or {}
        self.text = text

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self):
        return self._body


class _FakeClient:
    """Async client that returns a queue of pre-built responses in order."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, json, headers):
        self.calls.append({"url": url, "json": json})
        if not self._responses:
            raise AssertionError("FakeClient ran out of queued responses")
        return self._responses.pop(0)


def _ok(content="hello"):
    return _FakeResponse(
        200,
        body={"choices": [{"message": {"content": content}}], "usage": {}},
    )


def _retryable(status=429):
    return _FakeResponse(status, text="rate limited")


@pytest.mark.asyncio
async def test_chat_first_provider_succeeds(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k1")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k2")
    fake = _FakeClient([_ok("first wins")])
    monkeypatch.setattr(llm_proxy.httpx, "AsyncClient", lambda **_: fake)

    result = await llm_proxy.chat(messages=[{"role": "user", "content": "hi"}])
    assert result.provider == "groq"
    assert result.content == "first wins"
    assert len(fake.calls) == 1


@pytest.mark.asyncio
async def test_chat_failover_on_429(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k1")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k2")
    monkeypatch.setenv("LLM_PROVIDERS", "groq,openrouter")
    fake = _FakeClient([_retryable(429), _ok("second wins")])
    monkeypatch.setattr(llm_proxy.httpx, "AsyncClient", lambda **_: fake)

    result = await llm_proxy.chat(messages=[{"role": "user", "content": "hi"}])
    assert result.provider == "openrouter"
    assert result.content == "second wins"
    assert len(fake.calls) == 2


@pytest.mark.asyncio
async def test_chat_failover_on_5xx(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k1")
    monkeypatch.setenv("GEMINI_API_KEY", "k2")
    monkeypatch.setenv("LLM_PROVIDERS", "groq,gemini")
    fake = _FakeClient([_retryable(503), _ok("gemini wins")])
    monkeypatch.setattr(llm_proxy.httpx, "AsyncClient", lambda **_: fake)

    result = await llm_proxy.chat(messages=[{"role": "user", "content": "hi"}])
    assert result.provider == "gemini"


@pytest.mark.asyncio
async def test_chat_exhausted_raises(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k1")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k2")
    monkeypatch.setenv("LLM_PROVIDERS", "groq,openrouter")
    fake = _FakeClient([_retryable(429), _retryable(503)])
    monkeypatch.setattr(llm_proxy.httpx, "AsyncClient", lambda **_: fake)

    with pytest.raises(llm_proxy.LLMExhaustedError) as exc_info:
        await llm_proxy.chat(messages=[{"role": "user", "content": "hi"}])
    assert "openrouter" in str(exc_info.value)


@pytest.mark.asyncio
async def test_chat_malformed_response_fails_over(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k1")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k2")
    monkeypatch.setenv("LLM_PROVIDERS", "groq,openrouter")
    fake = _FakeClient([
        _FakeResponse(200, body={"unexpected": "shape"}),
        _ok("recovered"),
    ])
    monkeypatch.setattr(llm_proxy.httpx, "AsyncClient", lambda **_: fake)

    result = await llm_proxy.chat(messages=[{"role": "user", "content": "hi"}])
    assert result.provider == "openrouter"
    assert result.content == "recovered"
