"""Locale-aware HTML rewriting for the prerendered SPA.

The HF-hosted demo serves a single `dist/client/index.html` produced once at
`vite build` time. There is no runtime SSR, so the prerendered HTML's
`<html lang="en">` and `<title>...</title>` cannot reflect a request's
`govops-locale` cookie. Visitors with a non-EN cookie see EN content briefly
before client-side hydration swaps to their locale -- a flicker that breaks
the SEO/social-share use case (indexers and link previews never run JS) and
the user-perspective M02 bench journey.

This module provides a thin in-process rewriter that reads each request's
`govops-locale` cookie, looks up the requested route's localized title from
the same `web/src/messages/*.json` catalogs the SPA hydrates from, and
rewrites the SPA shell HTML before serving. It is a runtime substitute for
per-request SSR -- cheap (single HTML parse + two regex swaps) and stays in
sync with the SPA because the source of truth for titles remains the i18n
catalogs.

Routes whose `head()` doesn't set a `title` fall back to the root title;
this module mirrors that contract by mapping unknown paths to a `_root` key.

When the catalogs aren't reachable (test envs without the web tree, or
deploy targets where contributors stripped the i18n source), the module
becomes a no-op -- it returns the original HTML unchanged.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional

# Locales the SPA ships -- mirrors web/src/lib/i18n.tsx and ssrLocale.ts.
SUPPORTED_LOCALES = ("en", "fr", "es-MX", "pt-BR", "de", "uk")

# Path -> title-key map for routes that set their own `head().meta.title`.
# Mirrors the `head()` declarations in web/src/routes/*.tsx. Routes not
# listed here use the root title (the EN default served by the prerender).
# Trailing slashes are stripped before lookup.
_PATH_TITLE_KEYS: dict[str, str] = {
    "/about": "about.title",
    "/authority": "nav.authority",
    "/check": "check.heading",
    "/check/life-event": "check.lifeEvent.heading",
    "/impact": "impact.heading",
    "/admin/federation": "admin.federation.heading",
}

# Path-prefix -> title-key for routes with parameters. The parameter is
# variable but the title-key is constant (the route's `head()` calls
# `t(key, locale)` regardless of the param value).
_PATH_PREFIX_TITLE_KEYS: tuple[tuple[str, str], ...] = (
    ("/compare/", "compare.heading"),
)

# The root title is hardcoded in the SPA's `__root.tsx` head -- it is NOT
# i18n-keyed (it's a static fallback used by the prerender + by routes that
# don't override it). Localizing it here keeps the cookie-honour contract
# uniform with the rest of the rewriter. New locales need an entry here.
_ROOT_TITLE_BY_LOCALE: dict[str, str] = {
    "en": "GovOps — Law as code, with provenance you can read",
    "fr": "GovOps — Le droit comme code, avec une provenance lisible",
    "es-MX": "GovOps — Ley como código, con procedencia legible",
    "pt-BR": "GovOps — Lei como código, com proveniência legível",
    "de": "GovOps — Recht als Code, mit lesbarer Provenienz",
    "uk": "GovOps — Право як код, із зрозумілим походженням",
}


_HTML_LANG_RE = re.compile(r'(<html[^>]*\blang=)"[^"]*"', re.IGNORECASE)
_TITLE_RE = re.compile(r"<title>[^<]*</title>", re.IGNORECASE)


def _default_messages_dir() -> Path:
    """Default path for the i18n catalogs.

    Resolved relative to the repo root: `<repo>/web/src/messages/`. In the
    Dockerfile-shaped deploy the catalogs live alongside the source tree and
    are copied into the container; locally they live in the worktree.
    """
    here = Path(__file__).resolve()
    return here.parent.parent.parent / "web" / "src" / "messages"


def _load_catalogs(messages_dir: Optional[Path] = None) -> dict[str, dict[str, str]]:
    """Load every supported locale's JSON catalog. Missing files yield {}."""
    base = messages_dir or Path(
        os.environ.get("GOVOPS_I18N_MESSAGES_DIR", str(_default_messages_dir()))
    )
    catalogs: dict[str, dict[str, str]] = {}
    if not base.is_dir():
        return catalogs
    for locale in SUPPORTED_LOCALES:
        path = base / f"{locale}.json"
        if not path.is_file():
            continue
        try:
            catalogs[locale] = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            # Bad file is non-fatal -- the rewriter falls back to EN.
            continue
    return catalogs


def _normalize_locale(raw: Optional[str]) -> str:
    """Pick a supported locale from a cookie value or Accept-Language header."""
    if not raw:
        return "en"
    raw = raw.strip()
    if raw in SUPPORTED_LOCALES:
        return raw
    head = raw.split(",")[0].strip()
    if head in SUPPORTED_LOCALES:
        return head
    two = head[:2].lower()
    if two == "es":
        return "es-MX"
    if two == "pt":
        return "pt-BR"
    if two == "fr":
        return "fr"
    if two == "de":
        return "de"
    if two == "uk":
        return "uk"
    return "en"


def _title_key_for_path(path: str) -> Optional[str]:
    """Return the i18n key for the path's <title>, or None for root fallback."""
    if not path:
        return None
    cleaned = path.rstrip("/") or "/"
    if cleaned in _PATH_TITLE_KEYS:
        return _PATH_TITLE_KEYS[cleaned]
    for prefix, key in _PATH_PREFIX_TITLE_KEYS:
        if cleaned.startswith(prefix):
            return key
    return None


def localized_title_for(
    path: str,
    locale: str,
    catalogs: dict[str, dict[str, str]],
) -> str:
    """Compute the localized <title> for a path + locale pair.

    Falls back through: requested-locale catalog -> EN catalog -> root title
    for the locale. Returns the root EN title if nothing else resolves.
    """
    key = _title_key_for_path(path)
    if key is not None:
        cat = catalogs.get(locale) or {}
        hit = cat.get(key)
        if isinstance(hit, str) and hit.strip():
            return hit
        en_cat = catalogs.get("en") or {}
        en_hit = en_cat.get(key)
        if isinstance(en_hit, str) and en_hit.strip():
            return en_hit
    return _ROOT_TITLE_BY_LOCALE.get(locale, _ROOT_TITLE_BY_LOCALE["en"])


def rewrite_html_for_locale(
    html: str,
    path: str,
    locale: str,
    catalogs: dict[str, dict[str, str]],
) -> str:
    """Return `html` with `<html lang>` and `<title>` rewritten for the locale.

    Idempotent: rewriting an already-localized HTML for the same locale
    produces an equivalent string. The lang attribute swap targets the FIRST
    `<html ... lang="...">` occurrence; the title swap targets the FIRST
    `<title>...</title>` occurrence. Both regexes are case-insensitive to
    survive future build-tool casing changes.
    """
    title = localized_title_for(path, locale, catalogs)
    out = _HTML_LANG_RE.sub(rf'\1"{locale}"', html, count=1)
    safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
    out = _TITLE_RE.sub(f"<title>{safe_title}</title>", out, count=1)
    return out


def parse_locale_cookie(cookie_header: Optional[str]) -> Optional[str]:
    """Extract the `govops-locale` value from a Cookie header, or None."""
    if not cookie_header:
        return None
    for chunk in cookie_header.split(";"):
        kv = chunk.strip().split("=", 1)
        if len(kv) == 2 and kv[0].strip() == "govops-locale":
            return kv[1].strip()
    return None
