"""Multi-provider OpenAI-compatible LLM proxy.

Designed for v2.1 hosted-demo deploys (HF Spaces) where free-tier provider
quotas shift unpredictably. Configure an ordered provider chain via
`LLM_PROVIDERS` (default: `groq,openrouter,gemini,mistral`) and per-provider
API key + base URL + model. The proxy tries providers in order; on 429/5xx
it falls over to the next. If all providers exhaust, it raises
`LLMExhaustedError` (becomes a 503 at the API boundary).

Each provider must speak the OpenAI Chat Completions schema:
    POST {base_url}/chat/completions
    { "model": "...", "messages": [...], "max_tokens": ..., "temperature": ... }

Reference: the v2.1 plan in memory/v2_1_hosted_demo_plan.md (decision #3).
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

logger = logging.getLogger("govops.llm_proxy")

# ---------------------------------------------------------------------------
# Provider catalog — defaults match the v2.1 plan; each is overridable via env
# ---------------------------------------------------------------------------

# Each entry: env-var prefix → (default base URL, default model)
PROVIDER_DEFAULTS: dict[str, tuple[str, str]] = {
    "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "openrouter": ("https://openrouter.ai/api/v1", "meta-llama/llama-3.1-70b-instruct:free"),
    "gemini": (
        "https://generativelanguage.googleapis.com/v1beta/openai",
        "gemini-1.5-flash",
    ),
    "mistral": ("https://api.mistral.ai/v1", "mistral-small-latest"),
    # Anthropic doesn't speak the OpenAI schema natively; if needed, route via
    # OpenRouter (`anthropic/claude-3-haiku`) instead of adding here.
}


@dataclass
class ProviderConfig:
    name: str
    api_key: str
    base_url: str
    model: str

    @classmethod
    def from_env(cls, name: str) -> Optional["ProviderConfig"]:
        """Construct a provider config from env vars, or None if no key is set."""
        upper = name.upper()
        api_key = os.environ.get(f"{upper}_API_KEY")
        if not api_key:
            return None
        default_base, default_model = PROVIDER_DEFAULTS.get(name, ("", ""))
        base_url = os.environ.get(f"{upper}_BASE_URL", default_base)
        model = os.environ.get(f"{upper}_MODEL", default_model)
        if not base_url or not model:
            logger.warning(
                "llm_proxy: provider %r has API key but no base_url/model — skipping",
                name,
            )
            return None
        return cls(name=name, api_key=api_key, base_url=base_url, model=model)


class LLMExhaustedError(RuntimeError):
    """Raised when every provider in the chain returns a retryable error."""


class LLMConfigError(RuntimeError):
    """Raised when no providers are configured at all."""


@dataclass
class ChatResult:
    provider: str
    model: str
    content: str
    raw: dict[str, Any] = field(default_factory=dict)
    elapsed_ms: int = 0


# ---------------------------------------------------------------------------
# Provider chain assembly
# ---------------------------------------------------------------------------


def _provider_chain() -> list[ProviderConfig]:
    """Build the ordered provider chain from `LLM_PROVIDERS` env var.

    Default order matches the v2.1 plan: groq → openrouter → gemini → mistral.
    Providers without an API key configured are silently dropped from the chain.
    Returns at least one provider, or raises LLMConfigError.
    """
    raw = os.environ.get("LLM_PROVIDERS", "groq,openrouter,gemini,mistral")
    names = [n.strip().lower() for n in raw.split(",") if n.strip()]
    chain: list[ProviderConfig] = []
    for name in names:
        cfg = ProviderConfig.from_env(name)
        if cfg is not None:
            chain.append(cfg)
    if not chain:
        raise LLMConfigError(
            "No LLM providers configured. Set at least one of "
            f"{[f'{n.upper()}_API_KEY' for n in names]} in the environment."
        )
    return chain


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


# Retry on these HTTP statuses — server-side / rate-limit failures
_RETRYABLE_STATUSES: frozenset[int] = frozenset({408, 425, 429, 500, 502, 503, 504})


async def chat(
    messages: list[dict[str, Any]],
    *,
    max_tokens: int = 1024,
    temperature: float = 0.2,
    timeout_s: float = 30.0,
    chain: Optional[list[ProviderConfig]] = None,
) -> ChatResult:
    """Send a chat-completion request through the configured provider chain.

    Tries each provider in order; on retryable failure (429 / 5xx / network),
    falls over to the next. Returns the first successful response. Raises
    `LLMExhaustedError` if every provider fails.

    `messages` is the OpenAI shape: [{"role": "system"|"user"|"assistant", "content": "..."}].
    """
    chain = chain if chain is not None else _provider_chain()
    last_error: Optional[str] = None

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        for provider in chain:
            url = f"{provider.base_url.rstrip('/')}/chat/completions"
            payload = {
                "model": provider.model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            headers = {
                "Authorization": f"Bearer {provider.api_key}",
                "Content-Type": "application/json",
            }
            t0 = time.monotonic()
            try:
                resp = await client.post(url, json=payload, headers=headers)
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_error = f"{provider.name}: network/{type(exc).__name__}"
                logger.warning("llm_proxy: %s — failing over", last_error)
                continue
            elapsed_ms = int((time.monotonic() - t0) * 1000)

            if resp.status_code in _RETRYABLE_STATUSES:
                last_error = f"{provider.name}: HTTP {resp.status_code}"
                logger.warning(
                    "llm_proxy: %s after %dms — failing over",
                    last_error,
                    elapsed_ms,
                )
                continue

            if not resp.is_success:
                # Non-retryable error from this provider — fail over anyway, since
                # the next provider may still succeed.
                last_error = f"{provider.name}: HTTP {resp.status_code} {resp.text[:200]}"
                logger.warning("llm_proxy: %s — failing over", last_error)
                continue

            try:
                body = resp.json()
                content = body["choices"][0]["message"]["content"]
            except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
                last_error = f"{provider.name}: malformed response ({type(exc).__name__})"
                logger.warning("llm_proxy: %s — failing over", last_error)
                continue

            logger.info(
                "llm_proxy: %s succeeded in %dms (model=%s)",
                provider.name,
                elapsed_ms,
                provider.model,
            )
            return ChatResult(
                provider=provider.name,
                model=provider.model,
                content=content,
                raw=body,
                elapsed_ms=elapsed_ms,
            )

    raise LLMExhaustedError(
        f"All {len(chain)} provider(s) failed. Last error: {last_error}"
    )


def is_configured() -> bool:
    """Return True if at least one provider in the chain has credentials."""
    try:
        _provider_chain()
        return True
    except LLMConfigError:
        return False


def configured_providers() -> list[str]:
    """Return the list of currently-configured provider names (for /api/health)."""
    try:
        return [p.name for p in _provider_chain()]
    except LLMConfigError:
        return []
