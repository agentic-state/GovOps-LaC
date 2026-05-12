"""Internationalization support for GovOps.

Supported languages: en, fr, pt, es, de, uk
"""

from __future__ import annotations

from govops.legacy_constants import resolve_param  # populates LEGACY_CONSTANTS

SUPPORTED_LANGUAGES = resolve_param("global.config.supported_languages")
DEFAULT_LANGUAGE = resolve_param("global.config.default_language")

# ---------------------------------------------------------------------------
# Translation strings
# ---------------------------------------------------------------------------

# Translations live in LEGACY_CONSTANTS under ui.label.<key>.<lang> per ADR-004.
# Phase 6 retirement of Jinja templates will retire these entries alongside
# them; web/src/messages/*.json is the canonical translation source for the
# React frontend.


def t(key: str, lang: str = DEFAULT_LANGUAGE) -> str:
    """Get a translated string via the substrate / LEGACY_CONSTANTS.

    Falls back to English then to the key itself when the locale is missing.
    Uses the optional-default form of resolve_param so unknown keys return
    None instead of raising under AIA_CONFIG_STRICT=1.
    """
    value = resolve_param(f"ui.label.{key}.{lang}", default=None)
    if value is not None:
        return value
    if lang != "en":
        en_value = resolve_param(f"ui.label.{key}.en", default=None)
        if en_value is not None:
            return en_value
    return key


def get_translator(lang: str):
    """Return a translation function bound to a language."""
    def _t(key: str) -> str:
        return t(key, lang)
    return _t
